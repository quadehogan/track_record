const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API_BASE = "https://api.spotify.com/v1";

async function throwSpotifyError(res: Response, action: string): Promise<never> {
  const body = await res.text().catch(() => "");
  throw new Error(`${action} failed: ${res.status} ${res.statusText} — ${body}`);
}

interface CachedAppToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

let cachedAppToken: CachedAppToken | null = null;

/** App-level token via Client Credentials flow — no user Spotify login required. */
async function getAppAccessToken(): Promise<string> {
  if (cachedAppToken && cachedAppToken.expiresAt > Date.now() + 5_000) {
    return cachedAppToken.accessToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID!;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!;
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    throw new Error(`Failed to get Spotify app token: ${res.status}`);
  }

  const data = await res.json();
  cachedAppToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedAppToken.accessToken;
}

export interface SpotifyTrackResult {
  spotifyTrackId: string;
  trackName: string;
  artistName: string;
  albumArtUrl: string | null;
  spotifyUrl: string;
}

export async function searchTracks(query: string): Promise<SpotifyTrackResult[]> {
  if (!query.trim()) return [];
  const token = await getAppAccessToken();

  const url = new URL(`${API_BASE}/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("type", "track");
  url.searchParams.set("limit", "10");

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Spotify search failed: ${res.status}`);
  }

  const data = await res.json();
  interface SpotifyApiTrack {
    id: string;
    name: string;
    artists: Array<{ name: string }>;
    album: { images: Array<{ url: string }> };
    external_urls: { spotify: string };
  }
  return (data.tracks?.items ?? []).map((track: SpotifyApiTrack) => ({
    spotifyTrackId: track.id,
    trackName: track.name,
    artistName: track.artists.map((a) => a.name).join(", "),
    albumArtUrl: track.album.images[0]?.url ?? null,
    spotifyUrl: track.external_urls.spotify,
  }));
}

// --- Authorization Code flow (host playlist export) ---

const AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
const PLAYLIST_SCOPE = "playlist-modify-public playlist-modify-private";

export function getAuthorizeUrl(state: string): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", process.env.SPOTIFY_CLIENT_ID!);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", process.env.SPOTIFY_REDIRECT_URI!);
  url.searchParams.set("scope", PLAYLIST_SCOPE);
  url.searchParams.set("state", state);
  return url.toString();
}

interface UserTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

function basicAuthHeader(): string {
  const clientId = process.env.SPOTIFY_CLIENT_ID!;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!;
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

export async function exchangeCodeForToken(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
    }),
  });
  if (!res.ok) {
    await throwSpotifyError(res, "Exchange Spotify code");
  }
  const data: UserTokenResponse = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token!,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

export async function refreshUserAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    await throwSpotifyError(res, "Refresh Spotify token");
  }
  const data: UserTokenResponse = await res.json();
  return {
    accessToken: data.access_token,
    // Spotify doesn't always return a new refresh token — keep the old one if so.
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

export async function getSpotifyProfileId(accessToken: string): Promise<string> {
  const res = await fetch(`${API_BASE}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    await throwSpotifyError(res, "Fetch Spotify profile");
  }
  const data = await res.json();
  return data.id;
}

export async function createPlaylist(
  accessToken: string,
  spotifyProfileId: string,
  name: string,
): Promise<{ id: string; url: string }> {
  const res = await fetch(
    `${API_BASE}/users/${spotifyProfileId}/playlists`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        description: "Created by Track Record",
        public: false,
      }),
    },
  );
  if (!res.ok) {
    await throwSpotifyError(res, "Create Spotify playlist");
  }
  const data = await res.json();
  return { id: data.id, url: data.external_urls.spotify };
}

export async function addTracksToPlaylist(
  accessToken: string,
  playlistId: string,
  spotifyTrackIds: string[],
): Promise<void> {
  const uris = spotifyTrackIds.map((id) => `spotify:track:${id}`);
  // Spotify caps additions at 100 URIs per request.
  for (let i = 0; i < uris.length; i += 100) {
    const chunk = uris.slice(i, i + 100);
    const res = await fetch(
      `${API_BASE}/playlists/${playlistId}/tracks`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uris: chunk }),
      },
    );
    if (!res.ok) {
      await throwSpotifyError(res, "Add tracks to Spotify playlist");
    }
  }
}

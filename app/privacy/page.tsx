export const metadata = {
  title: "Privacy Policy — Track Record",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">
          Effective September 14, 2026
        </p>
      </div>

      <div className="flex flex-col gap-6 text-sm leading-relaxed text-foreground">
        <p>
          Track Record (&quot;we,&quot; &quot;us&quot;) is an async,
          group music-guessing game. This page explains what information we
          collect when you use it, why, and how to have it deleted.
        </p>

        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-lg font-medium">
            Information we collect
          </h2>
          <p className="font-medium">Account information</p>
          <p className="text-muted-foreground">
            If you create a real account, our authentication provider
            (Clerk) collects your email address and name from whichever
            sign-in method you use (Google, Apple, etc.). We don&apos;t see
            or store your password.
          </p>
          <p className="font-medium">Guest sessions</p>
          <p className="text-muted-foreground">
            If you play as a guest, we set a signed cookie containing a
            random identifier so you can be recognized as the same player
            within a game. It isn&apos;t tied to your name or email.
          </p>
          <p className="font-medium">Spotify integration</p>
          <p className="text-muted-foreground">
            Searching for songs sends your search text to Spotify but
            isn&apos;t tied to your identity. If a host connects their
            Spotify account to export a playlist, we store the resulting
            access and refresh tokens on our servers so we can create that
            playlist on their behalf.
          </p>
          <p className="font-medium">Game content</p>
          <p className="text-muted-foreground">
            Display names, submitted songs, and guesses are stored for as
            long as the game data exists.
          </p>
          <p className="font-medium">Automatically collected data</p>
          <p className="text-muted-foreground">
            Our hosting provider (Vercel) logs standard request data (IP
            address, timestamps) as part of normal web serving.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-lg font-medium">
            How we use this information
          </h2>
          <p className="text-muted-foreground">
            To run the game itself: creating games, matching guesses to
            submissions, computing scores, and — if you ask us to — creating
            a Spotify playlist. We don&apos;t sell your data or use it for
            advertising.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-lg font-medium">
            Who we share it with
          </h2>
          <p className="text-muted-foreground">
            We use a small number of service providers to run the app, each
            only for its own purpose:
          </p>
          <ul className="list-disc pl-5 text-muted-foreground">
            <li>Clerk — authentication and account management</li>
            <li>Neon — our database</li>
            <li>Vercel — hosting</li>
            <li>Spotify — song search and, if you connect your account, playlist creation</li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-lg font-medium">
            Your rights and deleting your data
          </h2>
          <p className="text-muted-foreground">
            If you have a real account, you can delete it yourself at any
            time from your{" "}
            <a href="/account" className="text-primary underline">
              account settings
            </a>
            . Deleting your account immediately removes your email, name,
            and any connected Spotify tokens. Your past guesses and
            submissions in shared games are anonymized (your name is
            replaced with &quot;Deleted user&quot;) rather than removed
            outright, since deleting them would also erase other players&apos;
            results in those games.
          </p>
          <p className="text-muted-foreground">
            If you played as a guest, clearing your browser&apos;s cookies
            for this site removes your guest identifier.
          </p>
          <p className="text-muted-foreground">
            For any other request about your data, contact us at the
            address below.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-lg font-medium">Cookies</h2>
          <p className="text-muted-foreground">
            We use a session cookie from Clerk (for signed-in accounts) and
            our own guest-session cookie described above. We don&apos;t use
            advertising or tracking cookies.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-lg font-medium">
            Children&apos;s privacy
          </h2>
          <p className="text-muted-foreground">
            Track Record isn&apos;t directed at children under 13, and we
            don&apos;t knowingly collect information from them.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-lg font-medium">
            Changes to this policy
          </h2>
          <p className="text-muted-foreground">
            If this policy changes, we&apos;ll update the effective date
            above.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-lg font-medium">Contact us</h2>
          <p className="text-muted-foreground">
            Questions about this policy or your data:{" "}
            <a
              href="mailto:hoganquade@gmail.com"
              className="text-primary underline"
            >
              hoganquade@gmail.com
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}

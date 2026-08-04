import { notFound } from "next/navigation";
import { readIdentity } from "@/lib/session";
import { getGameView } from "@/lib/queries/game-view";
import { GameScreen } from "@/components/game/game-screen";

export default async function GamePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const identity = await readIdentity();
  const view = await getGameView(code, identity);

  if (!view) notFound();

  return <GameScreen code={code.toUpperCase()} initialView={view} />;
}

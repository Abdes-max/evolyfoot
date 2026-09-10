import type { Metadata } from "next";
import { JoinView } from "./join-view";

export const metadata: Metadata = { title: "Rejoindre — EvolyFoot", robots: { index: false } };

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <JoinView token={token} />;
}

import type { Metadata } from "next";
import { StaffJoinView } from "./staff-join-view";

export const metadata: Metadata = { title: "Rejoindre le staff — EvolyFoot", robots: { index: false } };

export default async function StaffJoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <StaffJoinView token={token} />;
}

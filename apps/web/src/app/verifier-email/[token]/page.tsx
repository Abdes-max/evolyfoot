import type { Metadata } from "next";
import { VerifyEmailView } from "./verify-email-view";

export const metadata: Metadata = { title: "Confirmation d’e-mail — EvolyFoot", robots: { index: false } };

export default async function VerifyEmailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <VerifyEmailView token={token} />;
}

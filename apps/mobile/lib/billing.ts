import type { AuthContextValue } from "./auth-context";

export type BillingAccess = { state: "subscribed" } | { state: "trial"; daysLeft: number } | { state: "expired" };

export interface BillingState {
  enforced: boolean;
  access: BillingAccess;
}

export async function fetchBilling(apiRequest: AuthContextValue["apiRequest"]): Promise<BillingState | null> {
  const response = await apiRequest("/api/billing");
  const body = response?.ok ? await response.json().catch(() => null) : null;
  return body?.billing ?? null;
}

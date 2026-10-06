import { ServiceError } from "./database";
export async function subscription(userId: string) {
  const configured =
    process.env.BILLING_ENABLED === "true" &&
    !!process.env.REVENUECAT_SECRET_KEY;
  if (!configured)
    return {
      configured: false,
      pro: false,
      expiresAt: null,
      entitlement: "pro",
    };
  const response = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.REVENUECAT_SECRET_KEY}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(12000),
    },
  );
  if (response.status === 404)
    return {
      configured: true,
      pro: false,
      expiresAt: null,
      entitlement: process.env.REVENUECAT_ENTITLEMENT || "pro",
    };
  if (!response.ok)
    throw new ServiceError(
      503,
      "Subscription verification is temporarily unavailable.",
    );
  const result = await response.json();
  const entry =
    result.subscriber?.entitlements?.[
      process.env.REVENUECAT_ENTITLEMENT || "pro"
    ];
  const expiresAt = entry?.expires_date || null;
  const pro =
    !!entry && (!expiresAt || new Date(expiresAt).getTime() > Date.now());
  return {
    configured: true,
    pro,
    expiresAt,
    entitlement: process.env.REVENUECAT_ENTITLEMENT || "pro",
  };
}

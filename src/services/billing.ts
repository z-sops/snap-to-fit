import { Platform } from "react-native";
import Purchases, { type PurchasesPackage } from "react-native-purchases";
import { getSession } from "./storage";
import { api } from "./api";
let identity = "";
export async function billing() {
  if (Platform.OS === "web")
    throw new Error("Subscriptions are available in the Android and iOS app.");
  const session = await getSession();
  if (!session) throw new Error("Sign in to manage your subscription.");
  const server = await api<{ configured: boolean; pro: boolean }>(
    "/subscription/status",
    {},
  );
  if (!server.configured)
    throw new Error(
      "Paid plans are not enabled yet. All offline modules remain available.",
    );
  const apiKey =
    Platform.OS === "ios"
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
      : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
  if (!apiKey)
    throw new Error("Store billing is not configured for this build.");
  if (!identity) {
    Purchases.configure({ apiKey, appUserID: session.userId });
    identity = session.userId;
  } else if (identity !== session.userId) {
    await Purchases.logIn(session.userId);
    identity = session.userId;
  }
  return server;
}
export async function offers() {
  await billing();
  return (await Purchases.getOfferings()).current?.availablePackages || [];
}
export async function buy(pkg: PurchasesPackage) {
  await billing();
  await Purchases.purchasePackage(pkg);
  return api<{ pro: boolean }>("/subscription/status", {});
}
export async function restorePurchases() {
  await billing();
  await Purchases.restorePurchases();
  return api<{ pro: boolean }>("/subscription/status", {});
}
export async function managePurchases() {
  await billing();
  await Purchases.showManageSubscriptions();
}

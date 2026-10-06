import React, { useState, useEffect } from "react";
import type { PurchasesPackage } from "react-native-purchases";
import { router } from "expo-router";
import { Screen, Card, H, P, Button, act, notify } from "../components/ui";
import { api } from "../services/api";
import {
  offers,
  buy,
  restorePurchases,
  managePurchases,
} from "../services/billing";
export default function Subscription() {
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [pro, setPro] = useState(false);
  const [note, setNote] = useState("Loading plan availability…");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    offers()
      .then(async (p) => {
        const status = await api<{ pro: boolean }>("/subscription/status", {});
        if (active) {
          setPackages(p);
          setPro(status.pro);
          setNote(
            p.length
              ? "Store prices include the displayed billing period."
              : "No store products are available yet.",
          );
        }
      })
      .catch((e) => {
        if (active) setNote(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  const run = (fn: () => Promise<void>) =>
    act(async () => {
      setBusy(true);
      try {
        await fn();
      } finally {
        setBusy(false);
      }
    });
  return (
    <Screen
      title="Choose your pace."
      subtitle="Core tracking remains available offline."
    >
      <Card tint>
        <H>{pro ? "Snap to Fit Pro is active" : "Your fitness essentials"}</H>
        <P>
          Manual food and health logs, general fitness targets, workout plans,
          3D demonstrations and progress tracking are available without a
          subscription.
        </P>
        <P>{note}</P>
      </Card>
      {packages.map((pkg) => (
        <Card key={pkg.identifier}>
          <H>{pkg.product.title}</H>
          <P>{pkg.product.description}</P>
          <P>
            {pkg.product.priceString} · {pkg.packageType.toLowerCase()}
          </P>
          <P>
            Pro increases your daily AI allowance. Check the purchase
            confirmation for the exact billing period, renewal price and any
            introductory offer.
          </P>
          <Button
            disabled={busy || pro}
            title={"Continue · " + pkg.product.priceString}
            onPress={() =>
              run(async () => {
                const result = await buy(pkg);
                setPro(result.pro);
                notify(
                  result.pro
                    ? "Pro activated."
                    : "Purchase received. Entitlement confirmation may take a moment; restore purchases to refresh.",
                );
              })
            }
          />
        </Card>
      ))}
      <Card>
        <Button
          secondary
          disabled={busy}
          title="Restore purchases"
          onPress={() =>
            run(async () => {
              const result = await restorePurchases();
              setPro(result.pro);
              notify(
                result.pro
                  ? "Subscription restored."
                  : "No active Pro subscription found.",
              );
            })
          }
        />
        <Button
          secondary
          disabled={busy}
          title="Manage or cancel subscription"
          onPress={() => run(managePurchases)}
        />
        <P>
          Subscriptions renew automatically unless cancelled through your Apple
          or Google account. Removing the app or deleting its account does not
          cancel store billing.
        </P>
        <Button
          secondary
          title="Privacy and terms"
          onPress={() => router.push("/legal")}
        />
      </Card>
    </Screen>
  );
}

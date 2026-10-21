import { useT } from "../../i18n";
import React, { useRef, useState } from "react";
import { Platform, StyleSheet, Text, TextInput, View, Linking } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Sheet, PrimaryButton, palette } from "../design";
import { lookupBarcode, type BarcodeErrorKind } from "../../services/barcode";
import { validBarcode } from "../../core/barcode";
import { openFoodFactsCredit } from "../../core/food-sources";
import type { Food } from "../../core/foods";
import { haptic } from "../../services/feedback";

/** Camera barcode scanner with a type-in fallback; looks the code up on Open Food Facts. */
export function BarcodeScanner({ visible, onClose, onFound, onSearchInstead }: {
  visible: boolean; onClose: () => void; onFound: (f: Food) => void; onSearchInstead: () => void;
}) {
  const tr = useT();
  const [permission, requestPermission] = useCameraPermissions();
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "looking" | "missing" | "error">("idle");
  const [problem, setProblem] = useState<BarcodeErrorKind | "unknown" | null>(null);
  const busy = useRef(false);
  const camera = Platform.OS !== "web";

  const problemText: Record<BarcodeErrorKind | "unknown", string> = {
    invalid: tr("That does not look like a product barcode."),
    offline: tr("You appear to be offline. Search by name instead."),
    timeout: tr("The product database took too long to answer. Search by name instead."),
    unavailable: tr("The product database is busy. Try again or search by name."),
    unknown: tr("This product isn’t in the open database yet. Search by name or use Quick add with the label."),
  };

  const look = async (raw: string) => {
    const c = raw.replace(/\D/g, "");
    if (busy.current || !validBarcode(c)) return;
    busy.current = true;
    setCode(c);
    setStatus("looking");
    setProblem(null);
    haptic("tap");
    try {
      const food = await lookupBarcode(c);
      if (food) {
        haptic("success");
        setStatus("idle");
        onFound(food);
      } else {
        setStatus("missing");
        setProblem("unknown");
      }
    } catch (e) {
      setStatus("error");
      // The lookup reports why it failed; anything unexpected reads as offline.
      const kind = (e as { kind?: string })?.kind;
      setProblem(
        kind === "timeout" || kind === "offline" || kind === "unavailable" || kind === "invalid"
          ? kind
          : "offline",
      );
    } finally {
      busy.current = false;
    }
  };

  return (
    <Sheet visible={visible} title="Scan barcode" onClose={onClose}>
      {camera && permission?.granted ? (
        <View style={s.cameraWrap}>
          <CameraView style={StyleSheet.absoluteFill} facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"] }}
            onBarcodeScanned={status === "looking" ? undefined : (r) => void look(r.data)} />
          <View pointerEvents="none" style={s.frame}>
            {[s.tl, s.tr, s.bl, s.br].map((c, i) => <View key={i} style={[s.corner, c]} />)}
          </View>
          <Text style={s.cameraHint}>{status === "looking" ? tr("Looking up…") : tr("Point at the barcode on the package")}</Text>
        </View>
      ) : camera ? (
        <View style={s.permission}>
          <Text style={s.h}>{tr("Allow the camera to scan barcodes")}</Text>
          <Text style={s.note}>{tr("Only the barcode number is sent to Open Food Facts to find the product.")}</Text>
          {permission?.canAskAgain === false ? (
            <>
              <Text style={s.note}>{tr("Camera access is switched off for this app. Turn it on in your phone settings, or type the number below.")}</Text>
              <PrimaryButton title={tr("Open phone settings")} onPress={() => void Linking.openSettings()} />
            </>
          ) : (
            <PrimaryButton title={tr("Allow camera")} icon="camera" onPress={() => void requestPermission()} />
          )}
        </View>
      ) : null}
      <Text style={s.h}>{tr("Or type the number")}</Text>
      <TextInput value={code} onChangeText={setCode} keyboardType="number-pad" placeholder="e.g. 012345678905"
        placeholderTextColor={palette.muted} accessibilityLabel={tr("Barcode number")} style={s.input} maxLength={14} />
      <PrimaryButton title={status === "looking" ? tr("Looking up…") : tr("Find product")} disabled={status === "looking" || !validBarcode(code.replace(/\D/g, ""))} onPress={() => void look(code)} />
      {status === "missing" || status === "error" ? (
        <View style={s.alert}>
          <Text style={s.alertText}>{problem ? problemText[problem] : ""}</Text>
          <PrimaryButton title={tr("Search by name")} icon="search" onPress={() => { setStatus("idle"); setProblem(null); onSearchInstead(); }} />
        </View>
      ) : null}
      <Text style={s.credit}>{tr(openFoodFactsCredit)}</Text>
    </Sheet>
  );
}

const C = 34;
const s = StyleSheet.create({
  cameraWrap: { height: 320, borderRadius: 24, overflow: "hidden", backgroundColor: "#000", justifyContent: "flex-end" },
  frame: { position: "absolute", left: "12%", right: "12%", top: "25%", bottom: "30%" },
  corner: { position: "absolute", width: C, height: C, borderColor: "#fff" },
  tl: { left: 0, top: 0, borderLeftWidth: 4, borderTopWidth: 4, borderTopLeftRadius: 12 },
  tr: { right: 0, top: 0, borderRightWidth: 4, borderTopWidth: 4, borderTopRightRadius: 12 },
  bl: { left: 0, bottom: 0, borderLeftWidth: 4, borderBottomWidth: 4, borderBottomLeftRadius: 12 },
  br: { right: 0, bottom: 0, borderRightWidth: 4, borderBottomWidth: 4, borderBottomRightRadius: 12 },
  cameraHint: { color: "#fff", textAlign: "center", fontWeight: "700", padding: 14, backgroundColor: "rgba(0,0,0,0.35)" },
  permission: { backgroundColor: palette.card, borderRadius: 24, padding: 18, gap: 10 },
  h: { color: palette.ink, fontSize: 17, fontWeight: "800" },
  note: { color: palette.muted, fontSize: 14, lineHeight: 20 },
  input: { backgroundColor: palette.card, borderWidth: 1, borderColor: palette.line, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 14, fontSize: 18, letterSpacing: 1, color: palette.ink },
  alert: { backgroundColor: palette.warnSoft, borderRadius: 18, padding: 14, gap: 10 },
  alertText: { color: palette.warn, fontSize: 14, lineHeight: 20 },
  credit: { color: palette.muted, fontSize: 11, textAlign: "center" },
});

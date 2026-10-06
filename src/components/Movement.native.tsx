import React from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import { movementHTML } from "./movement-html";
import type { Exercise } from "../core/workouts";
export function Movement({ motion }: { motion: Exercise["motion"] }) {
  return (
    <View
      style={{
        height: 320,
        borderRadius: 20,
        overflow: "hidden",
        marginBottom: 16,
      }}
    >
      <WebView
        originWhitelist={["about:blank"]}
        source={{ html: movementHTML.replace("__MOTION__", motion) }}
        javaScriptEnabled
        scrollEnabled={false}
        onShouldStartLoadWithRequest={(r) => r.url === "about:blank"}
        accessibilityLabel="Illustrative 3D movement model"
      />
    </View>
  );
}

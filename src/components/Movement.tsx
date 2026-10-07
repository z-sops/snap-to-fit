import React from "react";
import { View } from "react-native";
import { movementHTML } from "./movement-html";
import type { Exercise } from "../core/workouts";
export function Movement({ motion }: { motion: Exercise["motion"] }) {
  return (
    <View
      style={{
        height: 420,
        borderRadius: 20,
        overflow: "hidden",
        marginBottom: 16,
      }}
    >
      <iframe
        title="Human 3D exercise demonstration"
        sandbox="allow-scripts"
        srcDoc={movementHTML.replace("__MOTION__", motion)}
        style={{ border: 0, width: "100%", height: "100%" }}
      />
    </View>
  );
}

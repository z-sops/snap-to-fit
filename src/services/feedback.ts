import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

/** Light haptic confirmation on phones; silently skipped on web and in tests. */
export function haptic(kind: "success" | "tap" | "warning" = "tap") {
  if (Platform.OS === "web") return;
  try {
    if (kind === "success") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (kind === "warning") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    else void Haptics.selectionAsync();
  } catch {
    // Haptics are a nicety; never block logging.
  }
}

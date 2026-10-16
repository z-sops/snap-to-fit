import { useContext } from "react";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";

// The side menu is a Modal drawn under the status bar / navigation bar, so it
// pads itself by the device insets from the root SafeAreaProvider.
export function useMenuInsets() {
  return useContext(SafeAreaInsetsContext) ?? { top: 0, bottom: 0, left: 0, right: 0 };
}

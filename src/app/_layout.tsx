import { MusicProvider } from "../services/music";
import React, { useEffect } from "react";
import { notificationNavigation } from "../services/notification-navigation";
import { Stack, router } from "expo-router";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { View, Text, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import { StoreProvider, useStore } from "../services/store";
import { colors } from "../components/ui";
import { doctorNotice, steroidNotice } from "../core/safety";
function Root() {
  const { ready, error, state } = useStore();
  useEffect(() => {
    if (!ready) return;
    return notificationNavigation((path) => router.push(path));
  }, [ready]);
  if (error)
    return (
      <View style={{ padding: 40 }}>
        <Text>{error}</Text>
        <Text>{doctorNotice}</Text>
        <Text>{steroidNotice}</Text>
      </View>
    );
  if (!ready) return (
    <View style={{ padding: 40 }}>
      <ActivityIndicator size="large" color={colors.green} />
      <Text>{doctorNotice}</Text>
      <Text>{steroidNotice}</Text>
    </View>
  );
  // Keep the navigator mounted at all times. Returning <Redirect> here instead
  // of the Stack unmounted every screen whenever an unprofiled user hit a
  // guarded route, which showed up as dead taps / white screens on device.
  const hasProfile = !!state.profile;
  return (
    <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
      <Stack.Protected guard={hasProfile}>
        <Stack.Screen name="index" />
        {guardedScreens.map((name) => (
          <Stack.Screen key={name} name={name} />
        ))}
      </Stack.Protected>
      {/* Reachable with or without a profile; onboarding is also used to edit
          an existing profile from Settings. */}
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="account" />
      <Stack.Screen name="legal" />
      <Stack.Screen name="gyms" />
    </Stack>
  );
}
const guardedScreens = [
  "food", "move", "health", "meal-plan", "metabolic", "journey", "medicines",
  "cgm", "coach", "education", "music", "settings", "subscription", "numbers", "report", "exercises",
] as const;
export default function Layout() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <StatusBar style="dark" />
        <StoreProvider>
          <MusicProvider><Root /></MusicProvider>
        </StoreProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

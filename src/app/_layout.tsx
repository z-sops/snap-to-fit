import { MusicProvider } from "../services/music";
import React, { useEffect } from "react";
import { notificationNavigation } from "../services/notification-navigation";
import { Stack, Redirect, usePathname, router } from "expo-router";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { View, Text, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import { StoreProvider, useStore } from "../services/store";
import { colors } from "../components/ui";
function Root() {
  const { ready, error, state } = useStore();
  const path = usePathname();
  useEffect(() => {
    if (!ready) return;
    return notificationNavigation((path) => router.push(path));
  }, [ready]);
  if (error)
    return (
      <View style={{ padding: 40 }}>
        <Text>{error}</Text>
      </View>
    );
  if (!ready) return <ActivityIndicator size="large" color={colors.green} />;
  if (!state.profile && !["/onboarding", "/account", "/legal", "/gyms"].includes(path))
    return <Redirect href="/onboarding" />;
  return <Stack screenOptions={{ headerShown: false, animation: "fade" }} />;
}
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

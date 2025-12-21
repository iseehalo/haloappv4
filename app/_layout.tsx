// app/_layout.tsx
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import "react-native-reanimated";
import { supabase } from "./supabaseClient"; // adjust path if needed

// Lato fonts
import { Lato_400Regular, Lato_700Bold, useFonts } from "@expo-google-fonts/lato";

import { useColorScheme } from "@/hooks/use-color-scheme";

export const unstable_settings = { anchor: "(tabs)" };

// Expo notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({ Lato_400Regular, Lato_700Bold });

  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);
  const realtimeChannel = useRef<any>(null);

  useEffect(() => {
    let userId: string | null = null;

    // Register push notifications
    (async () => {
      try {
        const token = await registerForPushNotificationsAsync();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          userId = user.id;
          if (token) {
            await supabase.from("users").update({ expo_push_token: token }).eq("id", user.id);
          }

          // Realtime channel subscription for notifications
          realtimeChannel.current = supabase
            .channel(`public:notifications_user_${user.id}`)
            .on(
              "postgres_changes",
              {
                event: "INSERT",
                schema: "public",
                table: "notifications",
                filter: `user_id=eq.${user.id}`,
              },
              (payload) => {
                console.log("New notification:", payload.new.content);

                // Trigger local push notification
                Notifications.scheduleNotificationAsync({
                  content: {
                    title: "New Notification",
                    body: payload.new.content,
                    sound: "default",
                  },
                  trigger: null,
                });
              }
            )
            .subscribe();
        }
      } catch (err) {
        console.warn("Notification setup error:", err);
      }
    })();

    // Foreground notification listener
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log("Notification received in foreground:", notification);
    });

    // User taps notification listener
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log("Notification tapped:", response);
    });

    return () => {
      // Cleanup listeners
      if (notificationListener.current) notificationListener.current.remove();
      if (responseListener.current) responseListener.current.remove();
      if (realtimeChannel.current) supabase.removeChannel(realtimeChannel.current);
    };
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#000" }}>
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <View style={{ flex: 1, paddingHorizontal: 10, backgroundColor: "#000" }}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="upload/index" options={{ presentation: "modal" }} />
          <Stack.Screen name="upload/details" options={{ presentation: "modal" }} />
          <Stack.Screen name="modal" options={{ presentation: "modal" }} />
        </Stack>
        <StatusBar style="auto" />
      </View>
    </ThemeProvider>
  );
}

/** Helper: ask permission + return Expo push token */
async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null;

  if (!Device.isDevice) {
    console.warn("Push notifications require a physical device.");
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.warn("Permission for push notifications not granted.");
    return null;
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync();
  token = tokenResponse.data;
  console.log("Expo Push Token:", token);

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  }

  return token;
}

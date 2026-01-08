import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef } from "react";
import { ActivityIndicator, Platform, View, Alert } from "react-native";
import * as Linking from "expo-linking";
import "react-native-reanimated";
import { supabase } from "./supabaseClient";

// Lato fonts
import { Lato_400Regular, Lato_700Bold, useFonts } from "@expo-google-fonts/lato";
import { useColorScheme } from "@/hooks/use-color-scheme";

// ✅ 1. Import your new Premium Context
import { PremiumProvider, usePremium } from "./PremiumContex";

export const unstable_settings = { anchor: "(tabs)" };

// FIXED: TypeScript Notification Handler properties added
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Lato_400Regular, Lato_700Bold });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#000" }}>
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  // ✅ 2. Wrap everything in the PremiumProvider
  return (
    <PremiumProvider>
      <LayoutContent />
    </PremiumProvider>
  );
}

/**
 * We create a separate component for the content so we can 
 * use the 'usePremium' hook inside it.
 */
function LayoutContent() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const url = Linking.useURL();
  
  // ✅ 3. Pull the refresh function from your Context
  const { refreshStatus } = usePremium();

  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);
  const realtimeChannel = useRef<any>(null);

  // --- Handle Deep Linking (The "Spotify Flow" Return Trip) ---
  useEffect(() => {
    if (url) {
      const { path } = Linking.parse(url);
      if (path === "success") {
        // ✅ 4. Re-check the database immediately so the UI unlocks
        refreshStatus();

        Alert.alert(
          "Premium Activated 🎉", 
          "Your account status has been updated. You can now use the credit system!",
          [{ text: "Great!", onPress: () => router.replace("/(tabs)") }]
        );
      }
    }
  }, [url]);

  // --- Notifications & Realtime Logic (Kept from your original) ---
  useEffect(() => {
    let userId: string | null = null;

    (async () => {
      try {
        const token = await registerForPushNotificationsAsync();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          userId = user.id;
          if (token) {
            await supabase.from("users").update({ expo_push_token: token }).eq("id", user.id);
          }

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

    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log("Notification received:", notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log("Notification tapped:", response);
    });

    return () => {
      if (notificationListener.current) notificationListener.current.remove();
      if (responseListener.current) responseListener.current.remove();
      if (realtimeChannel.current) supabase.removeChannel(realtimeChannel.current);
    };
  }, []);

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
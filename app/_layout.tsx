import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef } from "react";
import { ActivityIndicator, Platform, View, Alert } from "react-native";
import * as Linking from "expo-linking";
import Constants from 'expo-constants'; // Added for ProjectID
import "react-native-reanimated";
import { supabase } from "./supabaseClient";

// Fonts & Context
import { Lato_400Regular, Lato_700Bold, useFonts } from "@expo-google-fonts/lato";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { PremiumProvider, usePremium } from "./PremiumContex";

export const unstable_settings = { anchor: "(tabs)" };

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true, // Enabled for badge support
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

  return (
    <PremiumProvider>
      <LayoutContent />
    </PremiumProvider>
  );
}

function LayoutContent() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const url = Linking.useURL();
  const { refreshStatus } = usePremium();

  // FIX: Properly typed refs for notification subscriptions
  const notificationListener = useRef<Notifications.Subscription | undefined>(undefined);
  const responseListener = useRef<Notifications.Subscription | undefined>(undefined);

  useEffect(() => {
    if (url) {
      const { path } = Linking.parse(url);
      if (path === "success") {
        refreshStatus();
        Alert.alert(
          "Premium Activated 🎉", 
          "Your account status has been updated.",
          [{ text: "Great!", onPress: () => router.replace("/(tabs)") }]
        );
      }
    }
  }, [url]);

  useEffect(() => {
    let isMounted = true;

    async function initializePush() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const token = await registerForPushNotificationsAsync();
      
      if (token && isMounted) {
        await supabase
          .from("user_push_data")
          .upsert({ 
            user_id: user.id, 
            expo_push_token: token, 
            updated_at: new Date() 
          });
      }
    }

    initializePush();

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log("Notification Received:", notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data?.screen) {
        router.push(data.screen as any); 
      } else {
        router.push("/(tabs)/notifications" as any); 
      }
    });

    return () => {
      isMounted = false;
      // FIX: Standard cleanup for Expo Notifications
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
       responseListener.current.remove();
      }
    };
  }, []);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
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

async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) {
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  // FIX: Dynamic Project ID lookup from app.json
  const projectId = 
    Constants?.expoConfig?.extra?.eas?.projectId ?? 
    Constants?.easConfig?.projectId ?? 
    "ff22565a-4559-4f44-bcd1-fb0980cc2237"; // Fallback to your ID

  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    
    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#1DB954",
      });
    }

    return token;
  } catch (e) {
    console.error("Token error:", e);
    return null;
  }
}
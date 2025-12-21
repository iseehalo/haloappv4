// app/_layout.tsx
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';

// Lato fonts
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Lato_400Regular, Lato_700Bold, useFonts } from '@expo-google-fonts/lato';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [fontsLoaded] = useFonts({
    Lato_400Regular,
    Lato_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#000',
        }}
      >
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <View style={{ flex: 1 }}>
        <Stack
          initialRouteName="(tabs)"
          screenOptions={{
            headerShown: false, // hides top bar for all screens
          }}
        >
          {/* Main tab navigator */}
          <Stack.Screen name="(tabs)" />

          {/* Upload flow */}
          <Stack.Screen name="upload/index" />
          <Stack.Screen name="upload/details" />

          {/* Generic modal */}
          <Stack.Screen name="modal" />
        </Stack>
      </View>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

// app/(tabs)/_layout.tsx
import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import { Tabs, useRouter } from 'expo-router';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import Auth from '../auth';
import { supabase } from '../supabaseClient';

// --- Player Context Types ---
type Song = {
  id: string;
  title: string;
  artist: string;
  cover_url: string | null;
  audio_url: string | null;
  stream_count: number;
};

type PlayerContextType = {
  currentSong: Song | null;
  playSong: (song: Song) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  closePlayer: () => Promise<void>;
  isPlaying: boolean;
  positionMillis: number;
  durationMillis: number;
};

const PlayerContext = createContext<PlayerContextType | null>(null);
export const usePlayer = () => useContext(PlayerContext);

export default function Layout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // --- Notification Badge State ---
  const [unreadCount, setUnreadCount] = useState(0);

  // Player state
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);

  // 🔊 Configure audio mode
  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      interruptionModeIOS: InterruptionModeIOS.DuckOthers,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      playThroughEarpieceAndroid: false,
    }).catch(console.error);
  }, []);

  // 👤 Auth & Notification Listener
  useEffect(() => {
    const initializeAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      
      if (user) {
        fetchUnreadCount(user.id);
        setupNotificationSubscription(user.id);
      }
      
      setLoading(false);
    };

    const fetchUnreadCount = async (userId: string) => {
      // For now, we count all logs. Later you can add an 'is_read' column to filter.
      const { count, error } = await supabase
        .from('notifications_log')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      
      if (!error && count !== null) setUnreadCount(count);
    };

    const setupNotificationSubscription = (userId: string) => {
      supabase
        .channel(`unread-notifications-${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications_log',
            filter: `user_id=eq.${userId}`,
          },
          () => {
            setUnreadCount((prev) => prev + 1);
          }
        )
        .subscribe();
    };

    initializeAuth();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchUnreadCount(session.user.id);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (loading) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
      <ActivityIndicator size="large" color="#1DB954" />
    </View>
  );

  if (!user) return <Auth />;

  // --- Player functions (unchanged) ---
  const playSong = async (song: Song) => {
    if (!song.audio_url) return;
    try {
      if (sound) { try { await sound.stopAsync(); await sound.unloadAsync(); } catch {} }
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: song.audio_url },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded) {
            setPositionMillis(status.positionMillis);
            setDurationMillis(status.durationMillis || 0);
            setIsPlaying(status.isPlaying);
          }
        }
      );
      setSound(newSound);
      setCurrentSong(song);
      setIsPlaying(true);
    } catch (error) { console.error('Error playing song:', error); }
  };

  const togglePlayPause = async () => {
    if (!sound) return;
    if (isPlaying) { await sound.pauseAsync(); setIsPlaying(false); }
    else { await sound.playAsync(); setIsPlaying(true); }
  };

  const closePlayer = async () => {
    if (sound) { try { await sound.stopAsync(); await sound.unloadAsync(); } catch {} }
    setCurrentSong(null);
    setSound(null);
    setIsPlaying(false);
  };

  return (
    <PlayerContext.Provider value={{ currentSong, playSong, togglePlayPause, closePlayer, isPlaying, positionMillis, durationMillis }}>
      <View style={{ flex: 1 }}>
        <Tabs
          screenOptions={{
            tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
            headerShown: false,
            tabBarButton: HapticTab,
            tabBarStyle: { backgroundColor: '#000', borderTopWidth: 0 },
          }}
        >
          <Tabs.Screen
            name="index"
            options={{ title: 'Home', tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} /> }}
          />
          <Tabs.Screen
            name="explore"
            options={{ title: 'Shop', tabBarIcon: ({ color }) => <IconSymbol size={28} name="cart.fill" color={color} /> }}
          />
          
          {/* --- NEW NOTIFICATIONS TAB --- */}
          <Tabs.Screen
            name="notifications"
            options={{ 
              title: 'Inbox', 
              tabBarIcon: ({ color }) => <IconSymbol size={28} name="bell.fill" color={color} />,
              tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
              tabBarBadgeStyle: { backgroundColor: '#FF3B30' }
            }}
            listeners={{
                tabPress: () => setUnreadCount(0), // Clears badge when opened
            }}
          />

          <Tabs.Screen
            name="search"
            options={{ title: 'Search', tabBarIcon: ({ color }) => <IconSymbol size={28} name="magnifyingglass" color={color} /> }}
          />
          <Tabs.Screen
            name="premium"
            options={{ title: 'Premium', tabBarIcon: ({ color }) => <IconSymbol name="crown" size={28} color={color} /> }}
          />
          <Tabs.Screen
            name="profile"
            options={{ title: 'Profile', tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} /> }}
          />
        </Tabs>
      </View>
    </PlayerContext.Provider>
  );
}
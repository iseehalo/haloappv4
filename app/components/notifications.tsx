// app/components/notifications.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../supabaseClient';

// Updated to match our broadcast table structure
type Notification = {
  id: string;
  title: string;
  body: string;
  created_at: string;
};

const { width: WINDOW_WIDTH } = Dimensions.get('window');

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  // --- Fetch notifications specifically for the logged-in user ---
  const loadNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('notifications_log') // Pointing to our log table
      .select('*')
      .eq('user_id', user.id)   // Privacy check: only MY notifications
      .order('created_at', { ascending: false });

    if (!error && data) {
      setNotifications(data);
    }
  };

  useEffect(() => {
    loadNotifications();

    // --- Realtime subscription filtered to the current user ---
    const setupSubscription = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const channel = supabase
          .channel(`user_notifications_${user.id}`)
          .on(
            'postgres_changes',
            { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'notifications_log',
                filter: `user_id=eq.${user.id}` // Only listen for my updates
            },
            (payload) => {
              setNotifications(prev => [payload.new as Notification, ...prev]);
            }
          )
          .subscribe();

        return channel;
    };

    const channelPromise = setupSubscription();

    return () => {
      channelPromise.then(channel => {
          if (channel) supabase.removeChannel(channel);
      });
    };
  }, []);

  // --- Swipe right logic (Kept your original code) ---
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dx > 20,
    onPanResponderMove: Animated.event([null, { dx: pan.x }], { useNativeDriver: false }),
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dx > 120) {
        router.back();
      } else {
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
      }
    },
  });

  const renderNotification = ({ item }: { item: Notification }) => (
    <View style={styles.notificationCard}>
      <Text style={styles.titleText}>{item.title}</Text>
      <Text style={styles.bodyText}>{item.body}</Text>
      <Text style={styles.timeText}>
        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateX: pan.x }] }]}
      {...panResponder.panHandlers}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={item => item.id}
        renderItem={renderNotification}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={<Text style={styles.emptyText}>No notifications yet.</Text>}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, marginBottom: 12 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginLeft: 12 },
  notificationCard: { backgroundColor: '#111', padding: 15, marginHorizontal: 12, marginBottom: 8, borderRadius: 12, borderLeftWidth: 3, borderLeftColor: '#1DB954' },
  titleText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  bodyText: { color: '#bbb', fontSize: 14, marginTop: 4 },
  timeText: { color: '#666', fontSize: 11, marginTop: 8, textAlign: 'right' },
  emptyText: { color: '#444', textAlign: 'center', marginTop: 100, fontSize: 16 }
});
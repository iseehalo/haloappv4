import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../supabaseClient';

type TopSong = {
  id: string;
  title: string;
  artist: string;
  cover_url: string;
  stream_count: number;
  owned_copies: number;
};

type TopEarner = {
  id: string;
  username: string;
  profile_picture: string | null;
};

type Notification = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  song_cover?: string;
  user_picture?: string;
};

const { width: WINDOW_WIDTH } = Dimensions.get('window');

export default function HomePage() {
  const router = useRouter();
  const [topSongs, setTopSongs] = useState<TopSong[]>([]);
  const [topEarners, setTopEarners] = useState<TopEarner[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [hasUnread, setHasUnread] = useState(true);

  /** ---------------- FETCH TOP SONGS ---------------- **/
  const fetchTopSongs = async () => {
    const { data } = await supabase
      .from('songs')
      .select(`
        id,
        title,
        artist,
        cover_url,
        stream_count,
        song_copies ( owner )
      `)
      .order('stream_count', { ascending: false })
      .limit(5);

    if (!data) return;

    const formatted = data.map((song: any) => ({
      id: song.id,
      title: song.title,
      artist: song.artist,
      cover_url: song.cover_url,
      stream_count: song.stream_count,
      owned_copies: song.song_copies.filter((c: any) => c.owner !== null).length,
    }));

    setTopSongs(formatted);
  };

  /** ---------------- FETCH TOP EARNERS ---------------- **/
  const fetchTopEarners = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, username, profile_picture')
      .order('total_earned', { ascending: false })
      .limit(10);

    if (!data) return;
    setTopEarners(data);
  };

  /** ---------------- FETCH NOTIFICATIONS ---------------- **/
  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('id, content, created_at, user_id')
      .order('created_at', { ascending: false })
      .limit(5);

    if (!data) return;

    const enriched = await Promise.all(
      data.map(async (noti: any) => {
        const { data: userData } = await supabase
          .from('users')
          .select('username, profile_picture')
          .eq('id', noti.user_id)
          .single();

        let songCover;
        const match = noti.content.match(/"(.+?)"/);
        if (match) {
          const { data: songData } = await supabase
            .from('songs')
            .select('cover_url')
            .ilike('title', match[1])
            .single();
          songCover = songData?.cover_url;
        }

        return {
          ...noti,
          user_picture: userData?.profile_picture,
          song_cover: songCover,
          content: `${noti.content} from ${userData?.username ?? 'someone'}`,
        };
      })
    );

    setNotifications(enriched);
  };

  const refreshAll = async () => {
    setRefreshing(true);
    await fetchTopSongs();
    await fetchTopEarners();
    await fetchNotifications();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchTopSongs();
    fetchTopEarners();
    fetchNotifications();
  }, []);

  /** ---------------- CREDIT CALC ---------------- **/
  const calculateCredits = (streams: number, ownedCopies: number) => {
    return streams * (0.5 + ownedCopies * 0.25);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor="#fff" />
      }
    >
      {/* Trending */}
      <Text style={styles.trendingTitle}>Trending</Text>

      {topSongs.map((song, index) => {
        const totalCredits = calculateCredits(song.stream_count, song.owned_copies);

        return (
          <View key={song.id} style={styles.topSongRow}>
            <Text style={styles.rank}>{index + 1}</Text>
            <Image source={{ uri: song.cover_url }} style={styles.cover} />
            <View style={styles.songInfo}>
              <Text style={styles.title}>{song.title}</Text>
              <Text style={styles.artist}>{song.artist}</Text>
              <Text style={styles.credits}>{totalCredits.toFixed(2)} credits earned</Text>
            </View>
          </View>
        );
      })}

      {/* Top Earners (Horizontal) */}
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Top Earners</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {topEarners.map((user) => (
          <TouchableOpacity
            key={user.id}
            style={styles.earnerCard}
            onPress={() => router.push(`/profile/${user.id}`)}
          >
            <Image
              source={{ uri: user.profile_picture || undefined }}
              style={styles.earnerPic}
            />
            <Text style={styles.username}>{user.username}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Notifications */}
      <View style={styles.notificationsHeader}>
        <Text style={styles.sectionTitle}>Recent Notifications</Text>
        <TouchableOpacity
          onPress={() => {
            router.push('/components/notifications');
            setHasUnread(false);
          }}
        >
          <Ionicons name="notifications-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {notifications.map((noti) => (
        <View key={noti.id} style={styles.notificationRow}>
          {noti.user_picture && (
            <Image source={{ uri: noti.user_picture }} style={styles.notiUserPic} />
          )}
          {noti.song_cover && (
            <Image source={{ uri: noti.song_cover }} style={styles.notiSongCover} />
          )}
          <Text style={styles.notificationText}>{noti.content}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  scrollContent: { paddingTop: 40, paddingHorizontal: 16, paddingBottom: 20 },

  trendingTitle: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 20 },

  topSongRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },

  rank: { width: 24, color: '#aaa', fontWeight: '700' },
  cover: { width: 56, height: 56, borderRadius: 8, marginHorizontal: 12 },
  songInfo: { flex: 1 },
  title: { color: '#fff', fontWeight: '600' },
  artist: { color: '#aaa', fontSize: 12 },
  credits: { color: '#4ade80', fontSize: 12, marginTop: 4 },

  sectionTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },

  earnerCard: {
    alignItems: 'center',
    marginRight: 16,
    marginTop: 12,
  },

  earnerPic: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#333',
  },

  username: { color: '#fff', marginTop: 6, fontSize: 12 },

  notificationsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 12,
  },

  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },

  notiUserPic: { width: 36, height: 36, borderRadius: 18, marginRight: 8 },
  notiSongCover: { width: 36, height: 36, borderRadius: 6, marginRight: 8 },

  notificationText: { color: '#fff', flexShrink: 1 },
});

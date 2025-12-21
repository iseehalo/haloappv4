// app/MySongs.tsx
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from './supabaseClient';

type Song = {
  id: string;
  title: string;
  artist: string;
  cover_url: string;
  stream_count: number;
  created_at: string;
};

const PAGE_SIZE = 20;

const MySongs = () => {
  const navigation = useNavigation();
  const [user, setUser] = useState<any>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch current user on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }
        setUser(user);
        await fetchSongs(user.id, 0, true);
      } catch (err) {
        console.error('Error fetching user:', err);
        setLoading(false);
      }
    };
    initialize();
  }, []);

  // Refresh when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (user) onRefresh();
    }, [user])
  );

  const fetchSongs = async (userId: string, pageIndex: number, reset = false) => {
    if (!userId || (!hasMore && !reset)) return;
    if (pageIndex > 0 && !reset) setLoadingMore(true);

    try {
      const { data, error } = await supabase
        .from('songs')
        .select('id, title, artist, cover_url, stream_count, created_at')
        .eq('creator_id', userId)
        .order('created_at', { ascending: false })
        .range(pageIndex * PAGE_SIZE, pageIndex * PAGE_SIZE + PAGE_SIZE - 1);

      if (error) throw error;

      if (data && data.length > 0) {
        setSongs(prev => (reset ? data : [...prev, ...data]));
        setHasMore(data.length === PAGE_SIZE);
        setPage(pageIndex + 1);
      } else {
        if (reset) setSongs([]);
        setHasMore(false);
      }
    } catch (err) {
      console.error('Error fetching songs:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      if (refreshing) setRefreshing(false);
    }
  };

  const loadMore = () => {
    if (loadingMore || !hasMore || !user) return;
    fetchSongs(user.id, page);
  };

  const onRefresh = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    setHasMore(true);
    setPage(0);

    try {
      const { data, error } = await supabase
        .from('songs')
        .select('id, title, artist, cover_url, stream_count, created_at')
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false })
        .range(0, PAGE_SIZE - 1);

      if (error) throw error;
      setSongs(data || []);
      setPage(1);
      setHasMore(data?.length === PAGE_SIZE);
    } catch (err) {
      console.error('Error refreshing songs:', err);
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  if (loading && songs.length === 0) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#1DB954" />
        <Text style={styles.text}>Loading your songs...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>You are not signed in.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Back Arrow */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()} // <-- aligned with PurchasedCopies
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="arrow-back" size={28} color="#1DB954" />
      </TouchableOpacity>

      {songs.length === 0 ? (
        <Text style={styles.text}>You haven’t uploaded any songs yet.</Text>
      ) : (
        <FlatList
          data={songs}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: 16 }}
          initialNumToRender={5}
          windowSize={10}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1DB954" />
          }
          ListFooterComponent={
            loadingMore ? <ActivityIndicator size="small" color="#1DB954" style={{ margin: 12 }} /> : null
          }
          renderItem={({ item }) => {
            const uploadDate = new Date(item.created_at).toLocaleDateString();
            const creditsEarned = (item.stream_count * 0.5).toFixed(2);

            return (
              <View style={styles.songCard}>
                {item.cover_url ? (
                  <Image source={{ uri: item.cover_url }} style={styles.cover} />
                ) : (
                  <View style={[styles.cover, { backgroundColor: '#333' }]} />
                )}
                <View style={styles.songInfo}>
                  <Text style={styles.songTitle}>{item.title}</Text>
                  <Text style={styles.songArtist}>{item.artist}</Text>
                  <Text style={styles.songStreams}>Streams: {item.stream_count}</Text>
                  <Text style={styles.songCredits}>Credits Earned: {creditsEarned}</Text>
                  <Text style={styles.songDate}>Uploaded: {uploadDate}</Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
};

export default MySongs;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    paddingHorizontal: 16,
    paddingTop: 50,
  },
  text: {
    color: '#fff',
    fontSize: 18,
    marginTop: 16,
    textAlign: 'center',
  },
  backButton: {
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  songCard: {
    flexDirection: 'row',
    backgroundColor: '#111',
    padding: 12,
    marginBottom: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  cover: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 16,
  },
  songInfo: {
    flex: 1,
  },
  songTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  songArtist: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 4,
  },
  songStreams: {
    color: '#1DB954',
    fontSize: 14,
    marginBottom: 2,
  },
  songCredits: {
    color: '#1DB954',
    fontSize: 14,
    marginBottom: 2,
  },
  songDate: {
    color: '#888',
    fontSize: 12,
  },
});

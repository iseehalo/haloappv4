// app/(tabs)/search.tsx
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { Audio } from 'expo-av';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabaseClient';

// Types
type Song = {
  id: string;
  title: string;
  artist: string;
  cover_url: string | null;
  audio_url: string | null;
  stream_count: number;
  creator_id?: string;
};

type User = { id: string; email: string; };

const Search = () => {
  const { songId } = useLocalSearchParams<{ songId?: string }>();

  const [user, setUser] = useState<User | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);

  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fullPlayerVisible, setFullPlayerVisible] = useState(false);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Double-tap detection for back button
  let lastBackPress = 0;

  // Initialize audio mode
  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      interruptionModeIOS: 1,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      interruptionModeAndroid: 1,
      playThroughEarpieceAndroid: false,
    });
  }, []);

  // Fetch user
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user ? { id: user.id, email: user.email ?? '' } : null);
    };
    fetchUser();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email ?? '' } : null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Prefill search if navigated with songId and auto-play
  useEffect(() => {
    if (!songId) return;

    const fetchSong = async () => {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('id', songId)
        .single();

      if (!error && data) {
        setQuery(data.title);
        setResults([data]);
        playSong(data);
      }
    };

    fetchSong();
  }, [songId]);

  // Fetch all songs
  useEffect(() => {
    const fetchAllSongs = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('songs')
        .select('id, title, artist, cover_url, audio_url, stream_count, creator_id')
        .order('created_at', { ascending: false });

      if (error) console.error(error);
      else setResults(data ?? []);
      setLoading(false);
    };
    fetchAllSongs();
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query) return;

    const delay = setTimeout(async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('songs')
        .select('id, title, artist, cover_url, audio_url, stream_count, creator_id')
        .ilike('title', `%${query}%`);

      if (error) console.error(error);
      else setResults(data ?? []);
      setLoading(false);
    }, 300);

    return () => clearTimeout(delay);
  }, [query]);

  // Play song
  const playSong = async (song: Song) => {
    if (!song.audio_url) return;

    try {
      if (sound) {
        try {
          await sound.stopAsync();
          await sound.unloadAsync();
        } catch (e) {
          console.warn("Error unloading previous sound:", e);
        }
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: song.audio_url },
        { shouldPlay: true }
      );

      setSound(newSound);
      setCurrentSong(song);
      setIsPlaying(true);
      setFullPlayerVisible(true);
      setPositionMillis(0);
      setDurationMillis(0);

      let hasIncremented = false;
      newSound.setOnPlaybackStatusUpdate(async (status) => {
        if (!status.isLoaded) return;

        setPositionMillis(status.positionMillis);
        setDurationMillis(status.durationMillis || 0);
        setIsPlaying(status.isPlaying);

        if (!hasIncremented && status.positionMillis >= 10000) {
          hasIncremented = true;
          const { error } = await supabase.rpc("increment_stream", {
            song_uuid: song.id,
          });
          if (error) console.error("Error incrementing stream:", error);

          setResults((prev) =>
            prev.map((s) =>
              s.id === song.id
                ? { ...s, stream_count: s.stream_count + 1 }
                : s
            )
          );
        }

        // Autoplay next song
        if (status.didJustFinish && !status.isLooping) {
          const currentIndex = results.findIndex(s => s.id === song.id);
          const nextSong = results[currentIndex + 1];
          if (nextSong) {
            playSong(nextSong);
          }
        }
      });
    } catch (error) {
      console.error("Error playing song:", error);
    }
  };

  const togglePlayPause = async () => {
    if (!sound) return;
    if (isPlaying) { await sound.pauseAsync(); setIsPlaying(false); }
    else { await sound.playAsync(); setIsPlaying(true); }
  };

  const skipBack = async () => {
    const now = Date.now();
    if (now - lastBackPress < 300) {
      // double-tap → previous song
      const currentIndex = results.findIndex(s => s.id === currentSong?.id);
      const prevSong = results[currentIndex - 1];
      if (prevSong) playSong(prevSong);
      else if (currentSong) seekAudio(0);
    } else {
      // single tap → restart
      if (sound) await seekAudio(0);
    }
    lastBackPress = now;
  };

  const skipForward = async () => {
    const currentIndex = results.findIndex(s => s.id === currentSong?.id);
    const nextSong = results[currentIndex + 1];
    if (nextSong) playSong(nextSong);
  };

  const closePlayer = async () => {
    if (sound) {
      try { await sound.stopAsync(); await sound.unloadAsync(); } catch {}
    }
    setCurrentSong(null);
    setSound(null);
    setIsPlaying(false);
    setFullPlayerVisible(false);
    setPositionMillis(0);
    setDurationMillis(0);
  };

  const seekAudio = async (value: number) => {
    if (!sound) return;
    await sound.setPositionAsync(value);
    setPositionMillis(value);
  };

  const formatTime = (millis: number | undefined) => {
    if (!millis || isNaN(millis)) return '0:00';
    const minutes = Math.floor(millis / 60000);
    const seconds = Math.floor((millis % 60000) / 1000);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);

    const { data, error } = await supabase
      .from('songs')
      .select('id, title, artist, cover_url, audio_url, stream_count, creator_id')
      .order('created_at', { ascending: false });

    if (error) console.error(error);
    else setResults(data ?? []);

    setRefreshing(false);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <TextInput
        placeholder="Search for songs"
        placeholderTextColor="#aaa"
        value={query}
        onChangeText={setQuery}
        style={styles.input}
      />

      {loading && <ActivityIndicator size="small" color="#1DB954" style={{ marginBottom: 12 }} />}

      <FlatList
        style={{ flex: 1 }}
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.resultItem} onPress={() => playSong(item)}>
            {item.cover_url ? (
              <Image source={{ uri: item.cover_url }} style={styles.cover} />
            ) : (
              <View style={[styles.cover, { backgroundColor: '#333' }]} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.artist}>{item.artist}</Text>
              <Text style={styles.streamCount}>Streams: {item.stream_count}</Text>
            </View>
          </TouchableOpacity>
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1DB954" />
        }
      />

      {/* Mini Player */}
      {currentSong && !fullPlayerVisible && (
        <TouchableOpacity
          style={styles.miniPlayer}
          onPress={() => setFullPlayerVisible(true)}
          activeOpacity={1}
        >
          {currentSong.cover_url && (
            <Image source={{ uri: currentSong.cover_url }} style={styles.miniCover} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{currentSong.title}</Text>
            <Text style={styles.artist}>{currentSong.artist}</Text>
            <Slider
              style={{ width: '100%', height: 20 }}
              minimumValue={0}
              maximumValue={durationMillis}
              value={positionMillis}
              minimumTrackTintColor="#1DB954"
              maximumTrackTintColor="#555"
              onSlidingComplete={seekAudio}
            />
          </View>
          <TouchableOpacity onPress={togglePlayPause} style={{ marginRight: 12 }}>
            <Ionicons
              name={isPlaying ? 'pause-circle' : 'play-circle'}
              size={36}
              color="#1DB954"
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={closePlayer}>
            <Ionicons
              name="close-circle"
              size={32}
              color="#fff"
            />
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {/* Full Player */}
      {currentSong && fullPlayerVisible && (
        <ScrollView
          style={styles.fullPlayer}
          contentContainerStyle={{ 
            alignItems: 'center', 
            justifyContent: 'flex-start', 
            paddingBottom: 40,
            paddingTop: 100, // pushed down
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1DB954" />
          }
        >
          <TouchableOpacity
            style={styles.closeFullPlayerInside}
            onPress={() => setFullPlayerVisible(false)}
          >
            <Ionicons name="close-circle" size={36} color="#fff" />
          </TouchableOpacity>

          {currentSong.cover_url && (
            <Image source={{ uri: currentSong.cover_url }} style={styles.fullCover} />
          )}
          <Text style={styles.titleFull}>{currentSong.title}</Text>
          <Text style={styles.artistFull}>{currentSong.artist}</Text>

          <Slider
            style={{ width: '100%', height: 40 }}
            minimumValue={0}
            maximumValue={durationMillis}
            value={positionMillis}
            minimumTrackTintColor="#1DB954"
            maximumTrackTintColor="#fff"
            onSlidingComplete={seekAudio}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
            <Text style={{ color: '#fff' }}>{formatTime(positionMillis)}</Text>
            <Text style={{ color: '#fff' }}>{formatTime(durationMillis)}</Text>
          </View>

          {/* Full player controls: skip back / play / skip forward */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16 }}>
            <TouchableOpacity onPress={skipBack} style={{ marginHorizontal: 20 }}>
              <Ionicons name="play-skip-back-circle" size={48} color="#1DB954" />
            </TouchableOpacity>

            <TouchableOpacity onPress={togglePlayPause} style={{ marginHorizontal: 20 }}>
              <Ionicons
                name={isPlaying ? 'pause-circle' : 'play-circle'}
                size={64}
                color="#1DB954"
              />
            </TouchableOpacity>

            <TouchableOpacity onPress={skipForward} style={{ marginHorizontal: 20 }}>
              <Ionicons name="play-skip-forward-circle" size={48} color="#1DB954" />
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

export default Search;

// Styles
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 16 },
  input: { backgroundColor: '#111', color: '#fff', borderRadius: 12, padding: 12, marginBottom: 12 },
  resultItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomColor: '#222', borderBottomWidth: 1 },
  cover: { width: 50, height: 50, borderRadius: 8, marginRight: 12 },
  title: { color: '#fff', fontSize: 16, fontWeight: '600' },
  artist: { color: '#aaa', fontSize: 14 },
  streamCount: { color: '#888', fontSize: 12, marginTop: 2 },
  miniPlayer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#111', flexDirection: 'row', alignItems: 'center', padding: 10, borderTopColor: '#222', borderTopWidth: 1 },
  miniCover: { width: 50, height: 50, borderRadius: 8, marginRight: 12 },
  fullPlayer: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: '#000', paddingHorizontal: 16 },
  fullCover: { width: 300, height: 300, borderRadius: 16, marginBottom: 24 },
  titleFull: { color: '#fff', fontSize: 28, fontWeight: '700', marginBottom: 4, textAlign: 'center' },
  artistFull: { color: '#aaa', fontSize: 18, marginBottom: 24, textAlign: 'center' },
  playPauseButton: { backgroundColor: '#111', borderRadius: 50, padding: 20, marginTop: 16 },
  closeFullPlayerInside: { 
    alignSelf: 'flex-end', 
    marginBottom: 16, 
    marginRight: 10,
  },
});

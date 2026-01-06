// app/(tabs)/search.tsx
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { Audio } from 'expo-av';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Modal,
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

const { width } = Dimensions.get('window');
const CARD_SIZE = (width - 48) / 2;

type Song = {
  id: string;
  title: string;
  artist: string;
  cover_url: string | null;
  audio_url: string | null;
  stream_count: number;
  creator_id?: string;
};

type Playlist = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  creator_id: string | null;
};

type User = { id: string; email: string; };

const Search = () => {
  const [user, setUser] = useState<User | null>(null);
  const [query, setQuery] = useState('');
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fullPlayerVisible, setFullPlayerVisible] = useState(false);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [playlistSongs, setPlaylistSongs] = useState<Song[]>([]);
  const [activeList, setActiveList] = useState<Song[]>([]);

  let lastBackPress = 0;

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

  const fetchPlaylists = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('playlists')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) console.error(error);
    else setPlaylists(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPlaylists(); }, [fetchPlaylists]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPlaylists();
    setRefreshing(false);
  }, [fetchPlaylists]);

  const openPlaylist = async (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    setModalVisible(true);

    const { data, error } = await supabase
      .from('playlist_songs')
      .select(`song_id, songs(id, title, artist, cover_url, audio_url, stream_count, creator_id)`)
      .eq('playlist_id', playlist.id)
      .order('added_at', { ascending: true });

    if (error) console.error(error);
    else setPlaylistSongs(data?.map((d: any) => d.songs) ?? []);
  };

  useEffect(() => {
    if (!query) return setSearchResults([]);

    const timeout = setTimeout(async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .ilike('title', `%${query}%`)
        .order('created_at', { ascending: false });
      if (error) console.error(error);
      else setSearchResults(data ?? []);
      setLoading(false);
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  const playSong = async (song: Song, list?: Song[]) => {
    if (!song.audio_url) return;
    try {
      if (sound) { try { await sound.stopAsync(); await sound.unloadAsync(); } catch {} }

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

      setActiveList(list ?? (query.length > 0 ? searchResults : playlistSongs));

      let hasIncremented = false;
      newSound.setOnPlaybackStatusUpdate(async (status) => {
        if (!status.isLoaded) return;
        setPositionMillis(status.positionMillis);
        setDurationMillis(status.durationMillis || 0);
        setIsPlaying(status.isPlaying);

        if (!hasIncremented && status.positionMillis >= 10000) {
          hasIncremented = true;
          const { error } = await supabase.rpc("increment_stream", { song_uuid: song.id });
          if (error) console.error("Error incrementing stream:", error);
        }

        if (status.didJustFinish && !status.isLooping) {
          const currentIndex = activeList.findIndex(s => s.id === song.id);
          const nextSong = activeList[currentIndex + 1];
          if (nextSong) playSong(nextSong, activeList);
        }
      });
    } catch (error) { console.error(error); }
  };

  const togglePlayPause = async () => {
    if (!sound) return;
    if (isPlaying) { await sound.pauseAsync(); setIsPlaying(false); }
    else { await sound.playAsync(); setIsPlaying(true); }
  };

  const skipBack = async () => {
    const now = Date.now();
    if (now - lastBackPress < 300) {
      const currentIndex = activeList.findIndex(s => s.id === currentSong?.id);
      const prevSong = activeList[currentIndex - 1];
      if (prevSong) playSong(prevSong, activeList);
      else if (currentSong) await seekAudio(0);
    } else {
      if (sound) await seekAudio(0);
    }
    lastBackPress = now;
  };

  const skipForward = async () => {
    const currentIndex = activeList.findIndex(s => s.id === currentSong?.id);
    const nextSong = activeList[currentIndex + 1];
    if (nextSong) playSong(nextSong, activeList);
  };

  const closePlayer = async () => {
    if (sound) { try { await sound.stopAsync(); await sound.unloadAsync(); } catch {} }
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

  const formatTime = (millis?: number) => {
    if (!millis || isNaN(millis)) return '0:00';
    const minutes = Math.floor(millis / 60000);
    const seconds = Math.floor((millis % 60000) / 1000);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <TextInput
        placeholder="Search for songs..."
        placeholderTextColor="#aaa"
        value={query}
        onChangeText={setQuery}
        style={styles.input}
      />

      {loading && <ActivityIndicator size="small" color="#1DB954" style={{ marginBottom: 12 }} />}

      {query.length > 0 ? (
        <FlatList
          key="searchSongs"
          data={searchResults}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.resultItem} onPress={() => playSong(item, searchResults)}>
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1DB954" />}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          key="playlistsGrid"
          data={playlists}
          keyExtractor={item => item.id}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: 'space-between', marginBottom: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => openPlaylist(item)}>
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={styles.cardImage} />
              ) : (
                <View style={[styles.cardImage, { backgroundColor: '#222' }]} />
              )}
              <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
            </TouchableOpacity>
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1DB954" />}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Playlist Modal */}
      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
          
          <TouchableOpacity
            onPress={() => setModalVisible(false)}
            style={{
              position: 'absolute',
              top: 60,
              left: 16,
              zIndex: 10,
              backgroundColor: 'rgba(255,255,255,0.1)',
              padding: 8,
              borderRadius: 20,
            }}
          >
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </TouchableOpacity>

          <ScrollView contentContainerStyle={{ paddingTop: 80, paddingBottom: 40 }}>
            
            {selectedPlaylist?.image_url && (
              <Image
                source={{ uri: selectedPlaylist.image_url }}
                style={{
                  width: '100%',
                  height: 200,
                  borderRadius: 16,
                  marginBottom: 16,
                }}
              />
            )}

            <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700', marginBottom: 4, textAlign: 'center' }}>
              {selectedPlaylist?.name}
            </Text>
            {selectedPlaylist?.description && (
              <Text style={{ color: '#aaa', fontSize: 16, textAlign: 'center', marginBottom: 24 }}>
                {selectedPlaylist.description}
              </Text>
            )}

            <FlatList
              data={playlistSongs}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderBottomColor: '#222',
                    borderBottomWidth: 1,
                  }}
                  onPress={() => playSong(item, playlistSongs)}
                >
                  {item.cover_url ? (
                    <Image source={{ uri: item.cover_url }} style={{ width: 60, height: 60, borderRadius: 8, marginRight: 12 }} />
                  ) : (
                    <View style={{ width: 60, height: 60, borderRadius: 8, marginRight: 12, backgroundColor: '#333' }} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>{item.title}</Text>
                    <Text style={{ color: '#aaa', fontSize: 14 }}>{item.artist}</Text>
                  </View>
                  <Ionicons name="play-circle" size={32} color="#1DB954" />
                </TouchableOpacity>
              )}
              scrollEnabled={false}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Mini Player */}
      {currentSong && !fullPlayerVisible && (
        <TouchableOpacity
          style={styles.miniPlayer}
          onPress={() => setFullPlayerVisible(true)}
          activeOpacity={1}
        >
          {currentSong.cover_url && <Image source={{ uri: currentSong.cover_url }} style={styles.miniCover} />}
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
            <Ionicons name={isPlaying ? 'pause-circle' : 'play-circle'} size={36} color="#1DB954" />
          </TouchableOpacity>
          <TouchableOpacity onPress={closePlayer}>
            <Ionicons name="close-circle" size={32} color="#fff" />
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {/* Full Player */}
      {currentSong && fullPlayerVisible && (
        <ScrollView style={styles.fullPlayer} contentContainerStyle={{ alignItems: 'center', justifyContent: 'flex-start', paddingBottom: 40, paddingTop: 100 }}>
          <TouchableOpacity style={styles.closeFullPlayerInside} onPress={() => setFullPlayerVisible(false)}>
            <Ionicons name="close-circle" size={36} color="#fff" />
          </TouchableOpacity>

          {currentSong.cover_url && <Image source={{ uri: currentSong.cover_url }} style={styles.fullCover} />}
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

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16 }}>
            <TouchableOpacity onPress={skipBack} style={{ marginHorizontal: 20 }}>
              <Ionicons name="play-skip-back-circle" size={48} color="#1DB954" />
            </TouchableOpacity>

            <TouchableOpacity onPress={togglePlayPause} style={{ marginHorizontal: 20 }}>
              <Ionicons name={isPlaying ? 'pause-circle' : 'play-circle'} size={64} color="#1DB954" />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 16 },
  input: { backgroundColor: '#111', color: '#fff', borderRadius: 12, padding: 12, marginBottom: 12 },
  card: { width: CARD_SIZE, height: CARD_SIZE + 40, marginBottom: 16, borderRadius: 12, overflow: 'hidden', backgroundColor: '#111' },
  cardImage: { width: '100%', height: CARD_SIZE, borderRadius: 12 },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center', marginTop: 8 },
  resultItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomColor: '#222', borderBottomWidth: 1, paddingHorizontal: 16 },
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
  closeFullPlayerInside: { alignSelf: 'flex-end', marginBottom: 16, marginRight: 10 },
});

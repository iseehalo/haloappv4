import { Ionicons } from '@expo/vector-icons'; // <- added
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { supabase } from "../supabaseClient";

type UserProfile = {
  id: string;
  username: string;
  profile_picture: string | null;
  bio: string | null;
};

type OwnedSong = {
  id: string;
  title: string;
  artist: string;
  cover_url: string;
  stream_count: number;
  copies_owned: number;
};

export default function ProfilePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [songs, setSongs] = useState<OwnedSong[]>([]);

  /** ---------------- FETCH PROFILE ---------------- **/
  const fetchProfile = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, username, profile_picture, bio')
      .eq('id', id)
      .single();

    if (data) setProfile(data);
  };

  /** ---------------- FETCH OWNED SONGS ---------------- **/
  const fetchSongs = async () => {
    const { data } = await supabase
      .from('song_copies')
      .select(`
        song_id,
        songs (
          id,
          title,
          artist,
          cover_url,
          stream_count
        )
      `)
      .eq('owner', id);

    if (!data) return;

    const grouped: Record<string, OwnedSong> = {};

    data.forEach((row: any) => {
      const song = row.songs;
      if (!song) return;

      if (!grouped[song.id]) {
        grouped[song.id] = {
          id: song.id,
          title: song.title,
          artist: song.artist,
          cover_url: song.cover_url,
          stream_count: song.stream_count ?? 0,
          copies_owned: 1,
        };
      } else {
        grouped[song.id].copies_owned += 1;
      }
    });

    setSongs(Object.values(grouped));
  };

  useEffect(() => {
    fetchProfile();
    fetchSongs();
  }, []);

  /** ---------------- TOP 3 BY STREAMS ---------------- **/
  const topStreamedSongs = useMemo(() => {
    return [...songs]
      .sort((a, b) => b.stream_count - a.stream_count)
      .slice(0, 3);
  }, [songs]);

  /** ---------------- START DM ---------------- **/
  const startDM = async () => {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('No logged-in user', userError);
      return;
    }

    const { data, error } = await supabase.rpc('get_or_create_dm', {
      user1: user.id,
      user2: id,
    });

    if (!error && data) {
      router.push(`/dms/${data}`);
    } else {
      console.error('Error creating DM:', error);
    }
  };

  if (!profile) return null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* Back & DM Buttons */}
      <View style={styles.topRow}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={1}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={startDM}
          style={styles.dmBtn}
          activeOpacity={0.7}
        >
          <Ionicons
            name="paper-plane-outline"
            size={28}
            color="#60a5fa"
            style={{ transform: [{ rotate: '-20deg' }] }}
          />
        </TouchableOpacity>
      </View>

      {/* Profile Header */}
      <View style={styles.header}>
        <Image
          source={{ uri: profile.profile_picture || undefined }}
          style={styles.avatar}
        />
        <Text style={styles.username}>{profile.username}</Text>
        {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
      </View>

      {/* Owned Songs */}
      <Text style={styles.sectionTitle}>Your Hits</Text>

      {topStreamedSongs.length === 0 && (
        <Text style={styles.empty}>No songs yet</Text>
      )}

      {topStreamedSongs.map((song) => (
        <View key={song.id} style={styles.songRow}>
          <Image source={{ uri: song.cover_url }} style={styles.cover} />

          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{song.title}</Text>
            <Text style={styles.artist}>{song.artist}</Text>
            <Text style={styles.meta}>
              {song.stream_count} streams · {song.copies_owned} copies
            </Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },

  content: {
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },

  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  backBtn: {
    padding: 8,
  },

  backIcon: {
    color: '#60a5fa',
    fontSize: 20,
    fontWeight: '600',
  },

  dmBtn: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  header: {
    alignItems: 'center',
    marginBottom: 24,
  },

  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#333',
    marginBottom: 12,
  },

  username: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },

  bio: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 16,
  },

  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },

  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },

  cover: {
    width: 56,
    height: 56,
    borderRadius: 8,
    marginRight: 12,
  },

  title: {
    color: '#fff',
    fontWeight: '600',
  },

  artist: {
    color: '#aaa',
    fontSize: 12,
  },

  meta: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },

  empty: {
    color: '#777',
    fontSize: 14,
  },
});

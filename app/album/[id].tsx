import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { supabase } from "../supabaseClient";

type Song = {
  id: string;
  title: string;
  Track: number;
  Album: string;
  cover_url?: string | null;
};

export default function AlbumPage() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [album, setAlbum] = useState<any>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchAlbumAndSongs = async () => {
      setLoading(true);

      // Fetch album info
      const { data: albumData, error: albumError } = await supabase
        .from("albums")
        .select("*")
        .eq("id", id)
        .single();

      if (albumError) console.error("Error fetching album:", albumError);
      else setAlbum(albumData);

      // Fetch songs for this album, ordered by Track
      const { data: songData, error: songError } = await supabase
        .from("songs")
        .select("*")
        .eq("Album", id)
        .order("Track", { ascending: true });

      if (songError) console.error("Error fetching songs:", songError);
      else setSongs(songData ?? []);

      setLoading(false);
    };

    fetchAlbumAndSongs();
  }, [id]);

  if (loading || !album)
    return <Text style={{ color: "#fff", margin: 20 }}>Loading...</Text>;

  const goToSong = (songId: string) => {
    router.push(`/search?songId=${songId}`);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {/* Album Header */}
      <View style={styles.header}>
        <Image source={{ uri: album.cover_url ?? "" }} style={styles.cover} />
        <View style={styles.albumInfo}>
          <Text style={styles.albumTitle}>{album.title}</Text>
          <Text style={styles.albumArtist}>{album.artist}</Text>
          {album.release_date && (
            <Text style={styles.albumDate}>
              {new Date(album.release_date).toDateString()}
            </Text>
          )}
        </View>
      </View>

      {/* Tracklist */}
      <View style={styles.tracklist}>
        {songs.map((song) => (
          <TouchableOpacity
            key={song.id}
            style={styles.trackItem}
            onPress={() => goToSong(song.id)}
            activeOpacity={0.7}
          >
            <Text style={styles.trackNumber}>{song.Track}</Text>
            <Text style={styles.trackTitle}>{song.title}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  cover: {
    width: 250,
    height: 250,
    borderRadius: 16,
    marginTop: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  albumInfo: {
    alignItems: "center",
    marginTop: 16,
  },
  albumTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 4,
  },
  albumArtist: {
    color: "#b3b3b3",
    fontSize: 18,
    marginBottom: 2,
  },
  albumDate: {
    color: "#1db954",
    fontSize: 14,
    marginTop: 2,
  },
  tracklist: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  trackItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: "#1e1e1e",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  trackNumber: {
    color: "#b3b3b3",
    width: 30,
    textAlign: "right",
    marginRight: 12,
    fontSize: 16,
  },
  trackTitle: {
    color: "#fff",
    fontSize: 16,
    flexShrink: 1,
  },
});

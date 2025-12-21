// app/modal/plus.tsx
import { Lato_700Bold, useFonts } from "@expo-google-fonts/lato";
import { Audio } from "expo-av";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../supabaseClient";

const { width, height } = Dimensions.get("window");

export default function UploadModal() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({ Lato_700Bold });
  const [step, setStep] = useState<"pick" | "preview">("pick");

  // -------------------
  // IMAGE STATE
  // -------------------
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // -------------------
  // SONG STATE
  // -------------------
  const [search, setSearch] = useState("");
  const [songs, setSongs] = useState<any[]>([]);
  const [selectedSong, setSelectedSong] = useState<any>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const spinAnim = useRef(new Animated.Value(0)).current;

  // -------------------
  // CAPTION STATE
  // -------------------
  const [caption, setCaption] = useState("");

  // -------------------
  // Load songs from Supabase
  // -------------------
  const searchSongs = async (query: string) => {
    const { data, error } = await supabase
      .from("songs")
      .select("*")
      .ilike("title", `%${query}%`)
      .order("created_at", { ascending: false });
    if (!error && data) setSongs(data);
  };

  useEffect(() => {
    searchSongs(search);
  }, [search]);

  // -------------------
  // AUDIO HANDLING
  // -------------------
  const playSong = async (song: any) => {
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
      setSound(null);
    }
    const { sound: newSound } = await Audio.Sound.createAsync(
      { uri: song.audio_url },
      { shouldPlay: true }
    );
    setSound(newSound);
    startSpin();
  };

  const stopSong = async () => {
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
      setSound(null);
    }
    spinAnim.stopAnimation();
  };

  const startSpin = () => {
    spinAnim.setValue(0);
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 4000,
        useNativeDriver: true,
      })
    ).start();
  };

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  // -------------------
  // IMAGE PICKER & UPLOAD
  // -------------------
  const pickAndUploadImage = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "image/*",
        copyToCacheDirectory: true,
      });

      if (result.type === "success") {
        setImageUri(result.uri);
        setStep("preview");
        setUploading(true);

        // Read file as base64
        const base64 = await FileSystem.readAsStringAsync(result.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Convert base64 to Uint8Array
        const arrayBuffer = Uint8Array.from(
          atob(base64),
          (c) => c.charCodeAt(0)
        );

        const fileName = `${Date.now()}.jpg`;
        const filePath = `posting misc/${fileName}`;

        // Upload to Supabase
        const { error } = await supabase.storage
          .from("iseehalo music")
          .upload(filePath, arrayBuffer, {
            upsert: true,
            contentType: "image/jpeg",
          });

        if (error) throw error;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("iseehalo music")
          .getPublicUrl(filePath);

        setUploadedUrl(urlData.publicUrl);
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert("Upload failed", err.message);
    } finally {
      setUploading(false);
    }
  };

  // -------------------
  // POSTING
  // -------------------
  const postContent = async () => {
    if (!uploadedUrl || !selectedSong) return alert("Image and song are required");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be logged in");

      const { error: dbErr } = await supabase.from("posts").insert([
        {
          user_id: user.id,
          image_url: uploadedUrl,
          caption,
          song_id: selectedSong.id,
        },
      ]);

      if (dbErr) throw dbErr;

      alert("Post successful!");
      router.back();
    } catch (err: any) {
      console.error(err);
      alert(err.message);
    }
  };

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  if (step === "pick") {
    return (
      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.hero}>
          <Text style={styles.title}>Upload to Halo</Text>
          <TouchableOpacity style={styles.uploadButton} onPress={pickAndUploadImage}>
            <Text style={styles.uploadText}>
              {uploading ? "Uploading..." : "Select Photo"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // -------------------
  // PREVIEW STEP
  // -------------------
  return (
    <KeyboardAvoidingView style={styles.previewContainer} behavior="padding">
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => setStep("pick")}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={postContent}>
          <Text style={styles.postButton}>Post</Text>
        </TouchableOpacity>
      </View>

      {uploadedUrl ? (
        <Image source={{ uri: uploadedUrl }} style={styles.previewImage} />
      ) : (
        <ActivityIndicator size="large" color="#1DB954" style={{ marginTop: 50 }} />
      )}

      <TextInput
        style={styles.captionInput}
        placeholder="Write a caption..."
        placeholderTextColor="#ccc"
        value={caption}
        onChangeText={setCaption}
      />

      <View style={styles.songSearchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search for a song..."
          placeholderTextColor="#888"
          value={search}
          onChangeText={setSearch}
        />
        <FlatList
          data={songs}
          keyExtractor={(item) => item.id}
          style={{ flexGrow: 0 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.songItem,
                selectedSong?.id === item.id && { backgroundColor: "#1DB95422" },
              ]}
              onPress={() => setSelectedSong(item)}
            >
              <Animated.Image
                source={{ uri: item.cover_url }}
                style={[
                  styles.songDisc,
                  selectedSong?.id === item.id ? { transform: [{ rotate: spin }] } : {},
                ]}
              />
              <View style={styles.songInfo}>
                <Text style={styles.songTitle}>{item.title}</Text>
                <Text style={styles.songArtist}>{item.artist}</Text>
              </View>
              <TouchableOpacity
                style={styles.playButton}
                onPress={() =>
                  sound && selectedSong?.id === item.id ? stopSong() : playSong(item)
                }
              >
                <Text style={{ color: "#1DB954", fontWeight: "bold" }}>
                  {sound && selectedSong?.id === item.id ? "⏸" : "▶"}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#111" },
  container: { flex: 1, backgroundColor: "#111" },
  previewContainer: { flex: 1, backgroundColor: "#111" },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    alignItems: "center",
  },
  closeButton: { color: "#fff", fontSize: 28, fontWeight: "700" },
  postButton: { color: "#1DB954", fontWeight: "700", fontSize: 18 },
  hero: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontFamily: "Lato_700Bold", color: "#1DB954", fontSize: 36, fontWeight: "900", textAlign: "center", marginBottom: 40 },
  uploadButton: { backgroundColor: "#1DB954", paddingVertical: 16, paddingHorizontal: 48, borderRadius: 12 },
  uploadText: { fontFamily: "Lato_700Bold", color: "#fff", fontSize: 18, fontWeight: "700" },
  previewImage: { width, height: height * 0.55, resizeMode: "cover", marginBottom: 12 },
  captionInput: {
    backgroundColor: "#222",
    margin: 12,
    padding: 12,
    borderRadius: 12,
    color: "#fff",
    fontSize: 16,
  },
  songSearchContainer: { flex: 1, marginHorizontal: 12 },
  searchInput: { backgroundColor: "#222", padding: 10, borderRadius: 12, color: "#fff", marginBottom: 8 },
  songItem: { flexDirection: "row", alignItems: "center", padding: 10, marginBottom: 8, borderRadius: 12, backgroundColor: "#222" },
  songDisc: { width: 50, height: 50, borderRadius: 25, marginRight: 12 },
  songInfo: { flex: 1 },
  songTitle: { color: "#fff", fontWeight: "bold" },
  songArtist: { color: "#aaa", fontSize: 12 },
  playButton: { padding: 8 },
});

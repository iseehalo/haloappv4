// app/modal/preview.tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

export default function Preview() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const uri = params.uri ? decodeURIComponent(params.uri as string) : null;

  if (!uri) {
    return (
      <View style={styles.center}>
        <Text style={{ color: "#fff" }}>No image found.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
      </View>

      <Image source={{ uri }} style={styles.image} />

      <TextInput
        style={styles.captionInput}
        placeholder="Write a caption..."
        placeholderTextColor="#888"
      />

      <TouchableOpacity style={styles.postButton}>
        <Text style={styles.postText}>Post</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: "#111", padding: 16, alignItems: "center" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#111" },
  topBar: { flexDirection: "row", justifyContent: "flex-start", width: "100%", marginBottom: 16 },
  closeButton: { color: "#fff", fontSize: 28, fontWeight: "700" },
  image: { width: "100%", height: 400, borderRadius: 12, marginBottom: 20, resizeMode: "cover" },
  captionInput: { width: "100%", borderWidth: 1, borderColor: "#333", borderRadius: 12, padding: 12, color: "#fff", fontSize: 16, marginBottom: 16 },
  postButton: { backgroundColor: "#1DB954", paddingVertical: 16, borderRadius: 12, alignItems: "center", width: "100%" },
  postText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});

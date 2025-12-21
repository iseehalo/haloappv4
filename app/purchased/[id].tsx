import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";

import {
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { supabase } from "../supabaseClient";

export default function PurchasedCopyDetail() {
  const router = useRouter();
  const { id, title, cover_url, count, earnings } = useLocalSearchParams();

  const [resellEnabled, setResellEnabled] = useState(false);
  const [price, setPrice] = useState("");

  // Fetch current listing status and price when page loads
  useEffect(() => {
    const fetchCopy = async () => {
      if (!id) return;

      const { data, error } = await supabase
        .from("song_copies")
        .select("is_listed, listing_price")
        .eq("id", id)
        .single();

      if (error) {
        console.error(error);
        return;
      }

      setResellEnabled(data.is_listed ?? false);
      setPrice(data.listing_price?.toString() ?? "");
    };

    fetchCopy();
  }, [id]);

  const handleConfirmResell = async () => {
    if (!price) {
      Alert.alert("Error", "Please enter a price before listing.");
      return;
    }

    // Update copy to be listed with the price
    const { error } = await supabase
      .from("song_copies")
      .update({ is_listed: true, listing_price: Number(price) })
      .eq("id", id);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    setResellEnabled(true);
    Alert.alert(
      "Success",
      `Listed copy of "${title}" for ${price} credits.`
    );
    router.back();
  };

  const handleToggle = async (value: boolean) => {
    setResellEnabled(value);

    // If turning OFF, unlist copy in DB
    if (!value) {
      const { error } = await supabase
        .from("song_copies")
        .update({ is_listed: false })
        .eq("id", id);

      if (error) console.error("Error unlisting copy:", error.message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          {cover_url ? (
            <Image source={{ uri: cover_url as string }} style={styles.cover} />
          ) : (
            <View style={[styles.cover, { backgroundColor: "#333" }]} />
          )}

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.text}>Copies Owned: {count}</Text>
          <Text style={styles.text}>
            Earnings: {Number(earnings).toFixed(2)} credits
          </Text>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.label}>List for Resale</Text>
            <Switch
              value={resellEnabled}
              onValueChange={handleToggle}
              trackColor={{ false: "#555", true: "#1DB954" }}
              thumbColor="#fff"
            />
          </View>

          {resellEnabled && (
            <View style={styles.resellSection}>
              <Text style={styles.label}>Set Price (credits):</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter price"
                placeholderTextColor="#666"
                keyboardType="numeric"
                value={price}
                onChangeText={setPrice}
              />
              <TouchableOpacity
                style={styles.button}
                onPress={handleConfirmResell}
              >
                <Text style={styles.buttonText}>Confirm Listing</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    padding: 16,
  },
  backBtn: {
    alignSelf: "flex-start",
    marginBottom: 16,
    padding: 6,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  cover: {
    width: 220,
    height: 220,
    borderRadius: 12,
    marginBottom: 20,
  },
  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  text: { color: "#aaa", fontSize: 16, marginBottom: 4 },
  divider: {
    width: "100%",
    height: 1,
    backgroundColor: "#222",
    marginVertical: 20,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  label: { color: "#fff", fontSize: 16 },
  resellSection: {
    width: "100%",
    marginTop: 16,
  },
  input: {
    borderColor: "#1DB954",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    color: "#fff",
    marginTop: 8,
  },
  button: {
    backgroundColor: "#1DB954",
    padding: 14,
    borderRadius: 12,
    marginTop: 16,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});

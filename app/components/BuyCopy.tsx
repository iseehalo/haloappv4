// app/components/BuyCopy.tsx
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../supabaseClient";

export default function BuyCopy() {
  const router = useRouter();
  const { copy_id, title, cover_url, listing_price } = useLocalSearchParams<{
    copy_id: string;
    title: string;
    cover_url: string;
    listing_price: string;
  }>();

  const [sellerName, setSellerName] = useState<string>("");

  // Fetch seller info
  useEffect(() => {
    const fetchSeller = async () => {
      if (!copy_id) return;
      const { data: copyData, error } = await supabase
        .from("song_copies")
        .select("owner")
        .eq("id", copy_id)
        .single();
      if (error || !copyData) return;

      const { data: userData } = await supabase
        .from("users")
        .select("username")
        .eq("id", copyData.owner)
        .single();

      if (userData?.username) setSellerName(userData.username);
    };
    fetchSeller();
  }, [copy_id]);

  const handleBuy = async () => {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      Alert.alert("Error", "You must be logged in to buy a copy.");
      return;
    }

    Alert.alert(
      "Confirm Purchase",
      `Are you sure you want to buy "${title}" from ${sellerName || "the seller"} for ${listing_price} credits?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Buy",
          onPress: async () => {
            try {
              // Get the current copy info
              const { data: copyData, error: copyError } = await supabase
                .from("song_copies")
                .select("owner, listing_price")
                .eq("id", copy_id)
                .single();

              if (copyError || !copyData) {
                Alert.alert("Error", "Could not find the copy.");
                return;
              }

              const sellerId = copyData.owner;
              const price = copyData.listing_price;

              if (!price) {
                Alert.alert("Error", "This copy is not for sale.");
                return;
              }

              // Check buyer credits
              const { data: buyerData, error: buyerError } = await supabase
                .from("users")
                .select("credits")
                .eq("id", user.id)
                .single();

              if (buyerError || !buyerData) {
                Alert.alert("Error", "Could not fetch your credits.");
                return;
              }

              if (buyerData.credits < price) {
                Alert.alert("Error", "Not enough credits to buy this copy.");
                return;
              }

              // Perform purchase via RPC
              const { error: updateError } = await supabase.rpc("buy_song_copy_by_user", {
                buyer_uuid: user.id,
                copy_uuid: copy_id,
                price_input: price,
              });

              if (updateError) {
                Alert.alert("Error", updateError.message);
                return;
              }

              Alert.alert("Success", `You bought "${title}" for ${price} credits!`);
              router.back();
            } catch (err: any) {
              Alert.alert("Error", err.message);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Confirm Purchase</Text>
        </View>

        {/* Cover */}
        {cover_url ? (
          <Image source={{ uri: cover_url }} style={styles.cover} />
        ) : (
          <View style={[styles.cover, { backgroundColor: "#333" }]} />
        )}

        {/* Song Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.songTitle}>{title}</Text>
          <Text style={styles.seller}>Seller: {sellerName || "Loading..."}</Text>
          <Text style={styles.price}>{listing_price} credits</Text>
        </View>

        {/* Buy Button */}
        <TouchableOpacity style={styles.button} onPress={handleBuy}>
          <Text style={styles.buttonText}>Buy Now</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#121212",
  },
  container: {
    alignItems: "center",
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 24,
  },
  backBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginRight: 12,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  cover: {
    width: 250,
    height: 250,
    borderRadius: 16,
    marginBottom: 24,
  },
  infoCard: {
    width: "90%",
    backgroundColor: "#1E1E1E",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginBottom: 40,
  },
  songTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  seller: {
    color: "#aaa",
    fontSize: 16,
    marginBottom: 12,
  },
  price: {
    color: "#1DB954",
    fontSize: 20,
    fontWeight: "600",
  },
  button: {
    backgroundColor: "#1DB954",
    padding: 16,
    borderRadius: 16,
    width: "80%",
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 18,
  },
});

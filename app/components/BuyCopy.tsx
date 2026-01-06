// app/components/BuyCopy.tsx
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Linking,
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
  const [isPremium, setIsPremium] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  // Fetch seller info
  useEffect(() => {
    const fetchSeller = async () => {
      if (!copy_id) return;

      const { data: copyData } = await supabase
        .from("song_copies")
        .select("owner")
        .eq("id", copy_id)
        .single();

      if (!copyData?.owner) return;

      const { data: userData } = await supabase
        .from("users")
        .select("username")
        .eq("id", copyData.owner)
        .single();

      if (userData?.username) setSellerName(userData.username);
    };

    fetchSeller();
  }, [copy_id]);

  // Fetch premium status (UI only)
  useEffect(() => {
    const fetchPremium = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("users")
        .select("is_premium")
        .eq("id", user.id)
        .single();

      setIsPremium(!!data?.is_premium);
    };

    fetchPremium();
  }, []);

  const handleBuy = async () => {
    if (!isPremium) {
      setShowUpgrade(true);
      return;
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      Alert.alert("Error", "You must be logged in to buy a copy.");
      return;
    }

    Alert.alert(
      "Confirm Purchase",
      `Are you sure you want to buy "${title}" for ${listing_price} credits?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Buy",
          onPress: () => {
            Alert.alert("Success", "Purchase flow continues here.");
            router.back();
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

        {/* Song Info */}
        <View style={styles.infoCard}>
          <Text style={styles.songTitle}>{title}</Text>
          <Text style={styles.seller}>Seller: {sellerName || "Loading..."}</Text>
          <Text style={styles.price}>{listing_price} credits</Text>
        </View>

        {/* Buy Button */}
        <TouchableOpacity
          style={[
            styles.button,
            isPremium ? styles.premiumButton : styles.disabledButton,
          ]}
          onPress={handleBuy}
          activeOpacity={isPremium ? 0.7 : 1}
        >
          <Text style={styles.buttonText}>
            {isPremium ? "Buy Now" : "Upgrade to Premium"}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* GRAYED OUT OVERLAY */}
      {showUpgrade && (
        <View style={styles.overlay}>
          <View style={styles.upgradeBox}>
            <Text style={styles.upgradeTitle}>
              Upgrade to premium to buy copies
            </Text>

            <TouchableOpacity
              style={styles.upgradeBtn}
              onPress={() =>
                Linking.openURL("https://iseehalo-web.onrender.com/")
              }
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>Get Premium</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.upgradeBtn, { marginTop: 12, backgroundColor: "#555" }]}
              onPress={() => setShowUpgrade(false)}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
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
    marginBottom: 32,
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
    padding: 16,
    borderRadius: 16,
    width: "80%",
    alignItems: "center",
  },
  premiumButton: {
    backgroundColor: "#1DB954",
  },
  disabledButton: {
    backgroundColor: "#FF3B30", // keep the red locked look
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 18,
  },

  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  upgradeBox: {
    backgroundColor: "#1E1E1E",
    padding: 24,
    borderRadius: 20,
    width: "80%",
    alignItems: "center",
  },
  upgradeTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 16,
  },
  upgradeBtn: {
    backgroundColor: "#FF3B30",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
  },
});

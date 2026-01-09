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
  Modal,
  Pressable,
} from "react-native";
import { supabase } from "../supabaseClient";
import { usePremium } from "../PremiumContex"; // Using the context for consistency

export default function BuyCopy() {
  const router = useRouter();
  const { isPremium } = usePremium();
  const { copy_id, title, cover_url, listing_price } = useLocalSearchParams<{
    copy_id: string;
    title: string;
    cover_url: string;
    listing_price: string;
  }>();

  const [sellerName, setSellerName] = useState<string>("");
  const [upsellVisible, setUpsellVisible] = useState(false);

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

  const handleBuyPress = () => {
    if (!isPremium) {
      // Show the Spotify-style upsell instead of a hard error or external link
      setUpsellVisible(true);
    } else {
      confirmPurchase();
    }
  };

  const confirmPurchase = async () => {
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

        {/* Buy Button - Always looks active, but gates by premium */}
        <TouchableOpacity
          style={styles.buyButton}
          onPress={handleBuyPress}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Buy Now</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* --- Spotify-Style Upsell Modal --- */}
      <Modal 
        animationType="slide" 
        transparent={true} 
        visible={upsellVisible}
        onRequestClose={() => setUpsellVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setUpsellVisible(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.dragHandle} />
            
            <View style={styles.modalBrandRow}>
               <Image source={require('../../assets/images/ishlogo4.png')} style={styles.miniLogo} />
               <Text style={styles.premiumLabel}>PREMIUM</Text>
            </View>

            <Image source={{ uri: cover_url || '' }} style={styles.upsellImage} />

            <Text style={styles.upsellTitle}>Want to buy this copy?</Text>
            <Text style={styles.upsellSubtitle}>
              The Trading System and song ownership are exclusive Premium features. 
              Upgrade to start your collection and support artists.
            </Text>

            <TouchableOpacity 
              style={styles.exploreButton}
              onPress={() => {
                setUpsellVisible(false);
                router.push('/premium'); 
              }}
            >
              <Text style={styles.exploreButtonText}>Explore Premium</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.dismissButton} 
              onPress={() => setUpsellVisible(false)}
            >
              <Text style={styles.dismissText}>Dismiss</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#000" },
  container: { alignItems: "center", padding: 16, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", width: "100%", marginBottom: 24, marginTop: 10 },
  backBtn: { padding: 8, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", marginRight: 12 },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  cover: { width: 280, height: 280, borderRadius: 16, marginBottom: 24 },
  infoCard: { width: "100%", backgroundColor: "#1E1E1E", borderRadius: 16, padding: 20, alignItems: "center", marginBottom: 32 },
  songTitle: { color: "#fff", fontSize: 22, fontWeight: "700", marginBottom: 8, textAlign: "center" },
  seller: { color: "#aaa", fontSize: 16, marginBottom: 12 },
  price: { color: "#1DB954", fontSize: 20, fontWeight: "600" },
  
  buyButton: { backgroundColor: "#1DB954", padding: 18, borderRadius: 30, width: "100%", alignItems: "center" },
  buttonText: { color: "#000", fontWeight: "700", fontSize: 18 },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { 
    backgroundColor: '#121212', 
    borderTopLeftRadius: 28, 
    borderTopRightRadius: 28, 
    padding: 24, 
    alignItems: 'center', 
    paddingBottom: 60,
    borderWidth: 1,
    borderColor: '#282828'
  },
  dragHandle: { width: 40, height: 4, backgroundColor: '#444', borderRadius: 2, marginBottom: 20 },
  modalBrandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  miniLogo: { width: 18, height: 18, marginRight: 8 },
  premiumLabel: { color: '#1DB954', fontWeight: 'bold', fontSize: 12, letterSpacing: 2 },
  upsellImage: { width: 180, height: 180, borderRadius: 12, marginBottom: 25 },
  upsellTitle: { color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 10 },
  upsellSubtitle: { color: '#A7A7A7', fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 30, paddingHorizontal: 15 },
  exploreButton: { backgroundColor: '#1DB954', width: '100%', paddingVertical: 16, borderRadius: 30, alignItems: 'center' },
  exploreButtonText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
  dismissButton: { marginTop: 20, paddingVertical: 10, width: '100%', alignItems: 'center' },
  dismissText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
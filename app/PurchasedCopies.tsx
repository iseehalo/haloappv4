import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "./supabaseClient";

type PurchasedCopy = {
  id: string;
  song_id: string;
  title: string;
  cover_url: string | null;
  earnings: number;
  is_listed: boolean;
};

const PurchasedCopies = () => {
  const navigation = useNavigation();
  const [copies, setCopies] = useState<PurchasedCopy[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchCopies();
  }, []);

  const fetchCopies = async () => {
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!authUser) return;

      const { data, error } = await supabase
        .from("song_copies")
        .select("id, song_id, is_listed, songs!inner(title, cover_url, stream_count)")
        .eq("owner", authUser.id);

      if (error) throw error;

      const { data: allCopies, error: copiesError } = await supabase
        .from("song_copies")
        .select("song_id");

      if (copiesError) throw copiesError;

      const totalCopiesBySong: Record<string, number> = {};
      allCopies?.forEach((row) => {
        totalCopiesBySong[row.song_id] =
          (totalCopiesBySong[row.song_id] || 0) + 1;
      });

      const copyCountMap: Record<string, number> = {};
      const copiesList: PurchasedCopy[] =
        data?.map((row: any) => {
          const songId = row.song_id;
          copyCountMap[songId] = (copyCountMap[songId] || 0) + 1;
          const totalCopies = totalCopiesBySong[songId] || 1;
          const perCopyEarnings = (row.songs.stream_count * 0.5) / totalCopies;

          return {
            id: row.id,
            song_id: songId,
            title: `${row.songs.title} (Copy ${copyCountMap[songId]})`,
            cover_url: row.songs.cover_url,
            earnings: perCopyEarnings,
            is_listed: row.is_listed || false,
          };
        }) || [];

      setCopies(copiesList);
    } catch (err: any) {
      console.error(err);
      Alert.alert("Error", "Could not fetch purchased copies.");
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCopies();
    setRefreshing(false);
  };

  // Glowing circle component
  const GlowCircle = ({ isLive }: { isLive: boolean }) => {
    const scale = new Animated.Value(1);

    useEffect(() => {
      if (isLive) {
        Animated.loop(
          Animated.sequence([
            Animated.timing(scale, {
              toValue: 1.4,
              duration: 800,
              easing: Easing.ease,
              useNativeDriver: true,
            }),
            Animated.timing(scale, {
              toValue: 1,
              duration: 800,
              easing: Easing.ease,
              useNativeDriver: true,
            }),
          ])
        ).start();
      } else {
        scale.setValue(1);
      }
    }, [isLive]);

    return (
      <Animated.View
        style={[
          styles.statusCircle,
          isLive ? styles.liveCircle : styles.offlineCircle,
          isLive && { transform: [{ scale }] },
        ]}
      />
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Owned Copies</Text>
      </View>

      {copies.length === 0 ? (
        <Text style={styles.text}>You haven't purchased any copies yet.</Text>
      ) : (
        <FlatList
          data={copies}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() =>
                navigation.navigate("purchased/[id]", {
                  id: item.id,
                  song_id: item.song_id,
                  title: item.title,
                  cover_url: item.cover_url,
                  earnings: item.earnings,
                })
              }
            >
              <View style={styles.copyItem}>
                {item.cover_url ? (
                  <Image source={{ uri: item.cover_url }} style={styles.cover} />
                ) : (
                  <View style={[styles.cover, { backgroundColor: "#333" }]} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.copyText}>{item.title}</Text>
                  <Text style={styles.earningsText}>
                    Earnings: {item.earnings.toFixed(2)} credits
                  </Text>
                </View>
                <GlowCircle isLive={item.is_listed} />
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
};

export default PurchasedCopies;

const styles = StyleSheet.create({
  container: { flex: 1, width: "100%", padding: 16, backgroundColor: "#000" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 40,
    marginBottom: 20,
  },
  backBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginRight: 10,
  },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  copyItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomColor: "#222",
    borderBottomWidth: 1,
  },
  cover: { width: 50, height: 50, borderRadius: 8, marginRight: 12 },
  copyText: { color: "#fff", fontSize: 16, flexShrink: 1 },
  earningsText: { color: "#1DB954", fontSize: 14, marginTop: 2 },
  text: { color: "#fff", fontSize: 16, textAlign: "center", marginTop: 16 },

  // Status circle
  statusCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginLeft: 1,
  },
  liveCircle: {
    backgroundColor: "#00ff73",
    shadowColor: "#00ff73",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  offlineCircle: {
    backgroundColor: "#555",
  },
});

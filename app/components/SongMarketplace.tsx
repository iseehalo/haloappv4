import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    Dimensions,
    FlatList,
    Image,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { supabase } from "../supabaseClient";

const { width } = Dimensions.get("window");
const ITEM_WIDTH = (width - 48) / 2; // two columns + padding

export type ListedCopy = {
  id: string;
  listing_price: number;
  owner_uuid: string | null;
  owner_username: string | null;
  song: {
    id: string;
    title: string;
    artist: string;
    cover_url: string | null;
    audio_url: string | null;
    stream_count: number;
  };
};

export default function SongMarketplace() {
  const router = useRouter();
  const [listedCopies, setListedCopies] = useState<ListedCopy[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchListedCopies = useCallback(async () => {
    const { data: copies, error } = await supabase
      .from("song_copies")
      .select(
        "id, listing_price, owner, song:songs(id, title, artist, cover_url, audio_url, stream_count)"
      )
      .eq("is_listed", true)
      .order("listing_price", { ascending: false })
      .limit(50);

    if (error) {
      console.error(error);
      return;
    }

    if (!copies) return;

    const ownerUuids = copies.map((c: any) => c.owner).filter(Boolean);
    const { data: users } = await supabase
      .from("users")
      .select("id, username")
      .in("id", ownerUuids);

    const userMap =
      users?.reduce((acc: any, u: any) => {
        acc[u.id] = u.username;
        return acc;
      }, {} as Record<string, string>) || {};

    setListedCopies(
      copies.map((copy: any) => ({
        id: copy.id,
        listing_price: copy.listing_price,
        owner_uuid: copy.owner,
        owner_username: copy.owner
          ? userMap[copy.owner] || "Unknown"
          : "Unknown",
        song: copy.song,
      }))
    );
  }, []);

  useEffect(() => {
    fetchListedCopies();
  }, [fetchListedCopies]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchListedCopies();
    setRefreshing(false);
  };

  const goToCopy = (copy: ListedCopy) => {
    router.push({
      pathname: "/components/BuyCopy",
      params: {
        copy_id: copy.id,
        title: copy.song.title,
        cover_url: copy.song.cover_url ?? "",
        listing_price: copy.listing_price.toString(),
      },
    });
  };

  const renderCopyItem = ({ item }: { item: ListedCopy }) => (
    <TouchableOpacity style={styles.songItem} onPress={() => goToCopy(item)}>
      <Image source={{ uri: item.song.cover_url ?? "" }} style={styles.cover} />
      <Text numberOfLines={2} style={styles.title}>
        {item.song.title}
      </Text>
      <Text numberOfLines={1} style={styles.artist}>
        {item.song.artist}
      </Text>
      <Text numberOfLines={1} style={styles.owner}>
        Seller: {item.owner_username}
      </Text>
      <Text numberOfLines={1} style={styles.price}>
        {item.listing_price.toFixed(2)} credits
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Subheader */}
      <Text style={styles.subHeader}>Buy Copies</Text>

      {/* Listed Copies */}
      <FlatList
        data={listedCopies}
        keyExtractor={(item) => item.id}
        numColumns={2}
        renderItem={renderCopyItem}
        columnWrapperStyle={{
          justifyContent: "space-between",
          marginBottom: 16,
        }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 100,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#fff"
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  subHeader: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginVertical: 16,
    marginLeft: 16,
  },
  songItem: { width: ITEM_WIDTH, marginBottom: 12 },
  cover: {
    width: "100%",
    height: ITEM_WIDTH,
    borderRadius: 12,
    marginBottom: 8,
  },
  title: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
    marginBottom: 2,
  },
  artist: { color: "#aaa", fontSize: 12, marginBottom: 2 },
  owner: { color: "#ccc", fontSize: 12, marginBottom: 2 },
  price: { color: "#1DB954", fontSize: 12, fontWeight: "500" },
});

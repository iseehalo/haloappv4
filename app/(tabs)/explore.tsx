// app/(tabs)/marketplace.tsx
import React, { useRef, useState } from "react";
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import PagerView from "react-native-pager-view";
import { SafeAreaView } from "react-native-safe-area-context";
import ProductMarketplace from "../components/ProductMarketplace";
import SongMarketplace from "../components/SongMarketplace";

const { width } = Dimensions.get("window");

export default function MarketplaceScreen() {
  const pagerRef = useRef<PagerView>(null);
  const [page, setPage] = useState(0);

  const handlePageChange = (event: any) => {
    setPage(event.nativeEvent.position);
  };

  const goToPage = (index: number) => {
    pagerRef.current?.setPage(index);
    setPage(index);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          onPress={() => goToPage(0)}
          style={[styles.tab, page === 0 && styles.activeTabContainer]}
        >
          <Text style={[styles.tabText, page === 0 && styles.activeTabText]}>
            Song Copies
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => goToPage(1)}
          style={[styles.tab, page === 1 && styles.activeTabContainer]}
        >
          <Text style={[styles.tabText, page === 1 && styles.activeTabText]}>
            Products
          </Text>
        </TouchableOpacity>
      </View>

      {/* Swipeable Pager */}
      <PagerView
        style={{ flex: 1 }}
        initialPage={0}
        onPageSelected={handlePageChange}
        ref={pagerRef}
      >
        <View key="1">
          <SongMarketplace />
        </View>
        <View key="2">
          <ProductMarketplace />
        </View>
      </PagerView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingTop: 10, // small space below the SafeAreaView top
  },
  tabContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 10,
    borderBottomColor: "#222",
    borderBottomWidth: 1,
  },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  tabText: {
    color: "#888",
    fontSize: 16,
    fontWeight: "600",
  },
  activeTabText: {
    color: "#fff",
  },
  activeTabContainer: {
    backgroundColor: "#1DB95422",
  },
});

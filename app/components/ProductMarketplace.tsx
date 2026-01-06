// app/components/ProductMarketplace.tsx
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../supabaseClient'; // one folder up

const { width, height } = Dimensions.get('window');

type FeaturedProduct = {
  id: string;
  image_url: string;
  brand_id: string;
  brand_name: string | null;
  short_description: string | null;
};

export default function ProductMarketplace() {
  const [featured, setFeatured] = useState<FeaturedProduct[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetchFeatured();
  }, []);

  const fetchFeatured = async () => {
    const { data, error } = await supabase
      .from('featured_products')
      .select('id, image_url, brand_id, brand_name, short_description')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching featured products:', error);
      return;
    }

    if (data) setFeatured(data);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {featured.map((item) => (
        <View key={item.id} style={styles.heroContainer}>
          <Image source={{ uri: item.image_url }} style={styles.heroImage} />

          <View style={styles.overlay}>
            {item.brand_name && <Text style={styles.eyebrow}>{item.brand_name}</Text>}
            {item.short_description && <Text style={styles.title}>{item.short_description}</Text>}

            <TouchableOpacity
              style={styles.shopButton}
              onPress={() =>
                router.push(
                  `/products/BrandCatalogue?brandId=${item.brand_id}&brandName=${encodeURIComponent(
                    item.brand_name || ''
                  )}`
                )
              }
            >
              <Text style={styles.shopText}>Shop</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  heroContainer: { width, height: height * 0.9, position: 'relative' },

  heroImage: { width: '100%', height: '100%', resizeMode: 'cover' },

  overlay: { position: 'absolute', left: 20, bottom: 40, right: 20 },

  eyebrow: { color: '#fff', fontSize: 14, opacity: 0.85, marginBottom: 6 },

  title: { color: '#fff', fontSize: 28, fontWeight: '600', marginBottom: 14 },

  shopButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 999,
  },

  shopText: { color: '#000', fontSize: 16, fontWeight: '500' },
});

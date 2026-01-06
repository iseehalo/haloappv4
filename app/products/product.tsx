// app/products/product.tsx
import { useRouter, useSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Picker,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { supabase } from '../supabaseClient'; // fixed: one folder up

type Product = {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  in_stock: boolean;
  image_url: string | null;
  sizes: string[]; // available sizes
};

export default function ProductPage() {
  const { productId } = useSearchParams<{ productId: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string>('');

  useEffect(() => {
    if (!productId) return;

    const fetchProduct = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('id, name, description, price_cents, in_stock, image_url, sizes')
        .eq('id', productId)
        .single();

      if (error) {
        console.error('Error fetching product:', error);
        Alert.alert('Error', 'Could not fetch product.');
      } else {
        setProduct(data);
        setSelectedSize(data.sizes?.[0] || '');
      }
      setLoading(false);
    };

    fetchProduct();
  }, [productId]);

  const handlePurchase = async () => {
    if (!product || !selectedSize) {
      Alert.alert('Select a size', 'Please select a size before purchasing.');
      return;
    }
    setBuying(true);

    const { data, error } = await supabase.rpc('buy_product', {
      user_uuid: supabase.auth.user()?.id,
      product_uuid: product.id,
      size: selectedSize,
      quantity: 1,
      shipping_address: 'Default Address', // replace with user input if needed
    });

    setBuying(false);

    if (error) {
      console.error('Purchase error:', error);
      Alert.alert('Error', 'Could not complete purchase.');
    } else {
      Alert.alert('Success', 'Purchase completed!');
      router.back();
    }
  };

  if (loading) return <ActivityIndicator size="large" color="#1DB954" style={{ marginTop: 50 }} />;

  if (!product) return <Text style={styles.errorText}>Product not found.</Text>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 50 }}>
      {product.image_url ? (
        <Image source={{ uri: product.image_url }} style={styles.image} />
      ) : (
        <View style={[styles.image, { backgroundColor: '#ccc', justifyContent: 'center', alignItems: 'center' }]}>
          <Text>No Image</Text>
        </View>
      )}

      <Text style={styles.name}>{product.name}</Text>
      <Text style={styles.description}>{product.description}</Text>
      <Text style={styles.price}>{product.price_cents} credits</Text>
      <Text style={[styles.inStock, { color: product.in_stock ? '#1DB954' : '#FF3B30' }]}>
        {product.in_stock ? 'In Stock' : 'Out of Stock'}
      </Text>

      {/* Size Picker */}
      {product.sizes?.length > 0 && (
        <View style={styles.sizePickerContainer}>
          <Text style={styles.sizeLabel}>Select Size:</Text>
          <Picker
            selectedValue={selectedSize}
            onValueChange={(itemValue) => setSelectedSize(itemValue)}
            style={styles.picker}
          >
            {product.sizes.map((size) => (
              <Picker.Item key={size} label={size} value={size} />
            ))}
          </Picker>
        </View>
      )}

      <TouchableOpacity
        style={[styles.buyButton, { opacity: product.in_stock && !buying ? 1 : 0.5 }]}
        disabled={!product.in_stock || buying}
        onPress={handlePurchase}
      >
        <Text style={styles.buyButtonText}>{buying ? 'Processing...' : 'Buy Now'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 16 },
  image: { width: '100%', height: 300, borderRadius: 12, marginBottom: 16 },
  name: { color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 8 },
  description: { color: '#aaa', fontSize: 16, marginBottom: 8 },
  price: { color: '#fff', fontSize: 20, fontWeight: '600', marginBottom: 8 },
  inStock: { fontSize: 14, fontWeight: '500', marginBottom: 16 },
  sizePickerContainer: { marginBottom: 20 },
  sizeLabel: { color: '#fff', fontSize: 16, marginBottom: 6 },
  picker: { color: '#fff', backgroundColor: '#111', borderRadius: 8 },
  buyButton: {
    backgroundColor: '#1DB954',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buyButtonText: { color: '#000', fontSize: 18, fontWeight: '700' },
  errorText: { color: '#fff', textAlign: 'center', marginTop: 50, fontSize: 16 },
});

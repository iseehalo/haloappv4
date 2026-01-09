// app/products/product.tsx
import { useRouter, useLocalSearchParams } from 'expo-router'; 
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Modal,
    Pressable,
    SafeAreaView
} from 'react-native';
import { Picker } from '@react-native-picker/picker'; 
import { supabase } from '../supabaseClient';
import { usePremium } from '../PremiumContex'; 

type Product = {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  in_stock: boolean;
  image_url: string | null;
  sizes: string[];
};

export default function ProductPage() {
  const { productId } = useLocalSearchParams<{ productId: string }>(); 
  const router = useRouter();
  
  // 1. Hook into the Premium Context
  const { isPremium } = usePremium();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string>('');
  
  // 2. Control for the Spotify-style Upsell
  const [upsellVisible, setUpsellVisible] = useState(false);

  useEffect(() => {
    if (!productId) return;

    const fetchProduct = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('id, name, description, price_cents, in_stock, image_url, sizes')
        .eq('id', productId)
        .single();

      if (!error && data) {
        setProduct(data);
        setSelectedSize(data.sizes?.[0] || '');
      }
      setLoading(false);
    };

    fetchProduct();
  }, [productId]);

  // 3. The "Gatekeeper" function
  const handlePurchasePress = () => {
    if (!isPremium) {
      // If not premium, show the native bottom sheet
      setUpsellVisible(true);
    } else {
      // If premium, allow the credits transaction
      handlePurchase();
    }
  };

  const handlePurchase = async () => {
    if (!product || !selectedSize) {
      Alert.alert('Select a size', 'Please select a size before purchasing.');
      return;
    }
    setBuying(true);

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.rpc('buy_product', {
      user_uuid: user?.id,
      product_uuid: product.id,
      size: selectedSize,
      quantity: 1,
      shipping_address: 'Default Address',
    });

    setBuying(false);

    if (error) {
      Alert.alert('Error', 'Could not complete purchase.');
    } else {
      Alert.alert('Success', 'Purchase completed!');
      router.back();
    }
  };

  if (loading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#1DB954" />
    </View>
  );

  if (!product) return <Text style={styles.errorText}>Product not found.</Text>;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 50 }}>
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder}><Text style={{color: '#444'}}>No Image</Text></View>
        )}

        <View style={styles.detailsContainer}>
            <Text style={styles.name}>{product.name}</Text>
            <Text style={styles.description}>{product.description}</Text>
            <Text style={styles.price}>{product.price_cents} credits</Text>
            
            {product.sizes?.length > 0 && (
                <View style={styles.sizePickerContainer}>
                  <Text style={styles.sizeLabel}>Select Size:</Text>
                  <View style={styles.pickerWrapper}>
                      <Picker
                          selectedValue={selectedSize}
                          onValueChange={(v) => setSelectedSize(v)}
                          style={styles.picker}
                          dropdownIconColor="#fff"
                      >
                          {product.sizes.map((s) => (
                          <Picker.Item key={s} label={s} value={s} color="#fff" />
                          ))}
                      </Picker>
                  </View>
                </View>
            )}

            <TouchableOpacity
                style={[styles.buyButton, { opacity: product.in_stock && !buying ? 1 : 0.5 }]}
                disabled={!product.in_stock || buying}
                onPress={handlePurchasePress}
                activeOpacity={0.7}
            >
                <Text style={styles.buyButtonText}>{buying ? 'Processing...' : 'Buy Now'}</Text>
            </TouchableOpacity>
        </View>
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

            <Image source={{ uri: product.image_url || '' }} style={styles.upsellImage} />

            <Text style={styles.upsellTitle}>Want to purchase this product?</Text>
            <Text style={styles.upsellSubtitle}>
              Exclusive merch and song copies are only available to our Premium members. 
              Join the community to unlock full access.
            </Text>

            <TouchableOpacity 
              style={styles.exploreButton}
              activeOpacity={0.8}
              onPress={() => {
                setUpsellVisible(false);
                router.push('/premium'); 
              }}
            >
              <Text style={styles.exploreButtonText}>Explore Premium</Text>
            </TouchableOpacity>

            {/* Crucial for Apple Approval: The Dismiss Button */}
            <TouchableOpacity 
              style={styles.dismissButton} 
              onPress={() => setUpsellVisible(false)}
              activeOpacity={0.7}
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
  safeArea: { flex: 1, backgroundColor: '#000' },
  container: { flex: 1 },
  loadingContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  image: { width: '100%', height: 400, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  imagePlaceholder: { width: '100%', height: 400, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  detailsContainer: { padding: 20 },
  name: { color: '#fff', fontSize: 28, fontWeight: '800', marginBottom: 10 },
  description: { color: '#B3B3B3', fontSize: 16, marginBottom: 15, lineHeight: 22 },
  price: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 25 },
  sizePickerContainer: { marginBottom: 30 },
  sizeLabel: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 10 },
  pickerWrapper: { backgroundColor: '#121212', borderRadius: 12, borderWidth: 1, borderColor: '#333' },
  picker: { color: '#fff', height: 50 },
  buyButton: { backgroundColor: '#1DB954', paddingVertical: 18, borderRadius: 30, alignItems: 'center' },
  buyButtonText: { color: '#000', fontSize: 18, fontWeight: '700' },
  errorText: { color: '#fff', textAlign: 'center', marginTop: 50, fontSize: 16 },

  // Modal Styles (Reflecting IMG_6050.png)
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
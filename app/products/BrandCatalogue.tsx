// app/products/BrandCatalogue.tsx
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { supabase } from '../supabaseClient';

const { width } = Dimensions.get('window');

type Product = {
  id: string;
  name: string;
  description?: string;
  image_url: string | null;
  price_cents: number;
  in_stock: boolean;
};

export default function BrandCatalogue() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { brandId, brandName } = route.params || {};

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal & checkout states
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [shippingAddress, setShippingAddress] = useState('');
  const [customName, setCustomName] = useState('');
  const [size, setSize] = useState<'Small' | 'Medium' | 'Large' | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!brandId) return;

    const fetchProducts = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('id, name, description, image_url, price_cents, in_stock')
        .eq('brand_id', brandId);

      if (error) console.error('Error fetching products:', error);
      else setProducts(data ?? []);
      setLoading(false);
    };

    fetchProducts();
  }, [brandId]);

  const handlePurchase = async () => {
    if (!selectedProduct) return;
    if (!size) return alert('Select a size');
    if (!quantity || parseInt(quantity, 10) < 1) return alert('Enter a valid quantity');
    if (!shippingAddress.trim()) return alert('Enter a shipping address');

    setConfirming(true);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      setConfirming(false);
      return alert('User not logged in');
    }

    const qty = parseInt(quantity, 10);

    const { data, error } = await supabase.rpc('buy_product', {
      user_uuid: user.id,
      product_uuid: selectedProduct.id,
      quantity: qty,
      shipping_address: shippingAddress,
    });

    setConfirming(false);

    if (error) alert(error.message);
    else {
      alert('Purchase successful!');
      // Reset checkout fields
      setSelectedProduct(null);
      setQuantity('1');
      setShippingAddress('');
      setCustomName('');
      setSize(null);
    }
  };

  if (loading)
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.centeredText}>Loading products for {brandName}...</Text>
      </SafeAreaView>
    );

  if (!products.length)
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.centeredText}>No products found for {brandName}</Text>
      </SafeAreaView>
    );

  const totalPrice = selectedProduct
    ? selectedProduct.price_cents * (parseInt(quantity || '0', 10) || 0)
    : 0;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header with Back */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{brandName}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {products.map((product) => (
          <TouchableOpacity
            key={product.id}
            style={styles.productCard}
            onPress={() => setSelectedProduct(product)}
          >
            {product.image_url ? (
              <Image source={{ uri: product.image_url }} style={styles.image} />
            ) : (
              <View
                style={[
                  styles.image,
                  { backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' },
                ]}
              >
                <Text style={{ color: '#fff' }}>No Image</Text>
              </View>
            )}
            <Text style={styles.name}>{product.name}</Text>
            <Text style={styles.price}>{product.price_cents} credits</Text>
            <Text
              style={[
                styles.inStock,
                { color: product.in_stock ? '#1DB954' : '#FF3B30' },
              ]}
            >
              {product.in_stock ? 'In Stock' : 'Out of Stock'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Checkout Modal */}
      <Modal
        visible={!!selectedProduct}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedProduct(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {/* Back button inside modal */}
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setSelectedProduct(null)}
              >
                <Text style={styles.backButtonText}>← Back</Text>
              </TouchableOpacity>

              {selectedProduct && (
                <>
                  {selectedProduct.image_url && (
                    <Image source={{ uri: selectedProduct.image_url }} style={styles.modalImage} />
                  )}
                  <Text style={styles.modalName}>{selectedProduct.name}</Text>
                  <Text style={styles.modalPrice}>{selectedProduct.price_cents} credits</Text>
                  <Text style={styles.modalDescription}>{selectedProduct.description}</Text>
                  <Text style={[styles.inStock, { color: selectedProduct.in_stock ? '#1DB954' : '#FF3B30' }]}>
                    {selectedProduct.in_stock ? 'In Stock' : 'Out of Stock'}
                  </Text>

                  {/* Size selection */}
                  <View style={{ flexDirection: 'row', marginVertical: 8 }}>
                    {['Small', 'Medium', 'Large'].map((s) => (
                      <TouchableOpacity
                        key={s}
                        style={[
                          styles.sizeButton,
                          size === s && { backgroundColor: '#1DB954' },
                        ]}
                        onPress={() => setSize(s as 'Small' | 'Medium' | 'Large')}
                      >
                        <Text style={{ color: size === s ? '#000' : '#fff' }}>{s}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Custom name input */}
                  <TextInput
                    style={styles.input}
                    placeholder="Enter Name / Engraving (optional)"
                    value={customName}
                    onChangeText={setCustomName}
                    placeholderTextColor="#888"
                  />

                  {/* Quantity input */}
                  <TextInput
                    style={styles.input}
                    placeholder="Quantity"
                    keyboardType="number-pad"
                    value={quantity}
                    onChangeText={setQuantity}
                    placeholderTextColor="#888"
                  />

                  {/* Shipping address */}
                  <TextInput
                    style={styles.input}
                    placeholder="Shipping Address"
                    value={shippingAddress}
                    onChangeText={setShippingAddress}
                    placeholderTextColor="#888"
                  />

                  {/* Total price */}
                  <Text style={{ color: '#fff', marginVertical: 8, fontWeight: '600' }}>
                    Total: {totalPrice} credits
                  </Text>

                  {/* Confirm button */}
                  <TouchableOpacity
                    style={[styles.buyButton, { opacity: selectedProduct.in_stock && !confirming ? 1 : 0.5 }]}
                    disabled={!selectedProduct.in_stock || confirming}
                    onPress={handlePurchase}
                  >
                    <Text style={styles.buyButtonText}>{confirming ? 'Processing...' : 'Confirm Purchase'}</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#333',
  },
  backButton: { padding: 8, marginRight: 12 },
  backButtonText: { color: '#1DB954', fontSize: 16, fontWeight: '600' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },

  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 40,
  },
  productCard: {
    width: width / 2 - 15,
    marginBottom: 20,
    backgroundColor: '#111',
    borderRadius: 12,
    overflow: 'hidden',
    padding: 6,
  },
  image: { width: '100%', height: 150, borderRadius: 8, marginBottom: 6 },
  name: { color: '#fff', fontSize: 16, fontWeight: '600' },
  price: { color: '#fff', fontSize: 14, marginBottom: 4 },
  inStock: { fontSize: 12, fontWeight: '500' },
  centeredText: { color: '#fff', textAlign: 'center', marginTop: 50 },

  modalContainer: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)' },
  modalContent: { flex: 1, backgroundColor: '#111', padding: 16 },
  modalImage: { width: '100%', height: 250, borderRadius: 12, marginBottom: 16 },
  modalName: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  modalPrice: { color: '#1DB954', fontSize: 18, fontWeight: '600', marginBottom: 8 },
  modalDescription: { color: '#ccc', fontSize: 14, marginBottom: 8 },

  sizeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#fff',
    padding: 10,
    marginRight: 8,
    borderRadius: 8,
    alignItems: 'center',
  },

  input: {
    backgroundColor: '#222',
    color: '#fff',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },

  buyButton: {
    backgroundColor: '#1DB954',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buyButtonText: { color: '#000', fontWeight: '700' },
});

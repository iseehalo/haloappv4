
// app/(tabs)/store.tsx
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { supabase } from '../supabaseClient';

type Product = {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  in_stock: boolean;
  image_url: string | null;
};

export default function Store() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productToBuy, setProductToBuy] = useState<Product | null>(null);

  const [quantity, setQuantity] = useState('1');
  const [shippingAddress, setShippingAddress] = useState('');
  const [purchasing, setPurchasing] = useState(false);

  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [ordersModalVisible, setOrdersModalVisible] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const router = useRouter();

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('id, name, price_cents, in_stock, image_url, description');

    if (error) console.error('Error fetching products:', error);
    else setProducts(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProducts();
    setRefreshing(false);
  };

  const handlePurchase = async (product: Product) => {
    setPurchasing(true);
    const qty = parseInt(quantity, 10);

    if (!qty || qty < 1) {
      alert('Enter a valid quantity');
      setPurchasing(false);
      return;
    }

    if (!shippingAddress.trim()) {
      alert('Enter shipping address');
      setPurchasing(false);
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      alert('User not logged in');
      setPurchasing(false);
      return;
    }

    const { data, error } = await supabase.rpc('buy_product', {
      user_uuid: user.id,
      product_uuid: product.id,
      quantity: qty,
      shipping_address: shippingAddress,
    });

    if (error) alert(error.message);
    else alert(data);

    setPurchasing(false);
    setConfirmModalVisible(false);
    setProductToBuy(null);
    setQuantity('1');
    setShippingAddress('');
  };

  const fetchOrders = async () => {
    setLoadingOrders(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      alert('User not logged in');
      setLoadingOrders(false);
      return;
    }

    const { data, error } = await supabase
      .from('orders')
      .select('id, created_at, address, order_items (quantity, price_cents, products(name))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) alert(error.message);
    else setOrders(data ?? []);

    setLoadingOrders(false);
  };

  const renderProduct = ({ item }: { item: Product }) => (
    <TouchableOpacity
      style={styles.productItem}
      onPress={() => setSelectedProduct(item)}
    >
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={styles.image} />
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
      <Text style={styles.name}>{item.name}</Text>
      <Text style={styles.price}>{item.price_cents} credits</Text>
      <Text style={[styles.inStock, { color: item.in_stock ? '#1DB954' : '#FF3B30' }]}>
        {item.in_stock ? 'In Stock' : 'Out of Stock'}
      </Text>
    </TouchableOpacity>
  );

  const totalCost =
    productToBuy && parseInt(quantity || '0', 10) > 0
      ? productToBuy.price_cents * parseInt(quantity, 10)
      : 0;

  return (
    <View style={styles.container}>
      {loading && (
        <ActivityIndicator size="large" color="#1DB954" style={{ marginTop: 20 }} />
      )}

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        renderItem={renderProduct}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: 'space-between', marginBottom: 16 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100, paddingTop: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1DB954" />
        }
      />

      {/* Product Detail Modal */}
      <Modal
        visible={!!selectedProduct}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSelectedProduct(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {selectedProduct && (
                <>
                  {selectedProduct.image_url && (
                    <Image
                      source={{ uri: selectedProduct.image_url }}
                      style={styles.modalImage}
                    />
                  )}
                  <Text style={styles.modalName}>{selectedProduct.name}</Text>
                  <Text style={styles.modalPrice}>{selectedProduct.price_cents} credits</Text>
                  <Text style={styles.modalDescription}>{selectedProduct.description}</Text>

                  <TextInput
                    style={styles.input}
                    placeholder="Quantity"
                    keyboardType="number-pad"
                    value={quantity}
                    onChangeText={setQuantity}
                    placeholderTextColor="#888"
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Shipping Address"
                    value={shippingAddress}
                    onChangeText={setShippingAddress}
                    placeholderTextColor="#888"
                  />

                  <TouchableOpacity
                    style={styles.buyButton}
                    onPress={() => {
                      setProductToBuy(selectedProduct);
                      setConfirmModalVisible(true);
                      setSelectedProduct(null);
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                      Review Order
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setSelectedProduct(null)}
                  >
                    <Text style={{ color: '#fff' }}>Cancel</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Confirm Purchase Modal */}
      <Modal
        visible={confirmModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setConfirmModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {productToBuy && (
              <>
                <Text style={styles.modalName}>Confirm Your Order</Text>
                <Text style={styles.modalDescription}>Item: {productToBuy.name}</Text>
                <Text style={styles.modalDescription}>Price: {productToBuy.price_cents} credits</Text>
                <Text style={styles.modalDescription}>Quantity: {quantity}</Text>
                <Text style={styles.modalDescription}>Address: {shippingAddress}</Text>
                <Text style={[styles.modalPrice, { marginTop: 12 }]}>
                  Total: {totalCost} credits
                </Text>

                <TouchableOpacity
                  style={styles.buyButton}
                  onPress={() => handlePurchase(productToBuy)}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                    {purchasing ? 'Processing...' : 'Confirm Purchase'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setConfirmModalVisible(false)}
                >
                  <Text style={{ color: '#fff' }}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Orders Modal */}
      <Modal
        visible={ordersModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setOrdersModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 12 }}>
              My Orders
            </Text>
            {loadingOrders ? (
              <ActivityIndicator color="#1DB954" size="large" />
            ) : (
              <ScrollView>
                {orders.length === 0 && <Text style={{ color: '#fff' }}>No orders yet</Text>}
                {orders.map((order) => (
                  <View
                    key={order.id}
                    style={{
                      marginBottom: 16,
                      borderBottomWidth: 1,
                      borderBottomColor: '#333',
                      paddingBottom: 8,
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '600' }}>
                      Order ID: {order.id}
                    </Text>
                    <Text style={{ color: '#aaa', fontSize: 12 }}>
                      Date: {new Date(order.created_at).toLocaleString()}
                    </Text>
                    <Text style={{ color: '#ccc', marginTop: 4 }}>Address: {order.address}</Text>
                    {order.order_items?.map((item: any, idx: number) => (
                      <Text key={idx} style={{ color: '#fff', marginTop: 2 }}>
                        {item.products.name} × {item.quantity} ({item.price_cents} credits each)
                      </Text>
                    ))}
                  </View>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setOrdersModalVisible(false)}
            >
              <Text style={{ color: '#fff' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Floating Orders Button */}
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => {
          setOrdersModalVisible(true);
          fetchOrders();
        }}
      >
        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>📦</Text>
      </TouchableOpacity>
    </View>
  );
}

export const storeOptions = {
  title: 'Shop',
  tabBarIcon: ({ color }: { color: string }) => <IconSymbol size={28} name="cart.fill" color={color} />,
  headerStyle: { backgroundColor: '#000' },
  headerTitleStyle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  productItem: { width: '48%', marginBottom: 16 },
  image: { width: '100%', height: 150, borderRadius: 12, marginBottom: 8 },
  name: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  price: { color: '#aaa', fontSize: 14, marginBottom: 2 },
  inStock: { fontSize: 12, fontWeight: '500' },
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
  cancelButton: {
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#555',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalContent: {
    margin: 16,
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    maxHeight: '90%',
  },
  modalImage: { width: '100%', height: 250, borderRadius: 12, marginBottom: 16 },
  modalName: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  modalPrice: { color: '#1DB954', fontSize: 18, fontWeight: '600', marginBottom: 8 },
  modalDescription: { color: '#ccc', fontSize: 14, marginBottom: 8 },
  floatingButton: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    backgroundColor: '#1DB954',
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
});


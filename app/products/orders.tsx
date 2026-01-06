// app/products/orders.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Image,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { supabase } from '../supabaseClient';

interface Product {
  id: string;
  name: string;
  image_url: string;
}

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  price_cents: number;
  product?: Product;
}

interface Order {
  id: string;
  created_at: string;
  address: string;
  items: OrderItem[];
}

const Orders = () => {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = useCallback(async () => {
    setRefreshing(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setOrders([]);
        setRefreshing(false);
        return;
      }

      // Fetch orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, created_at, address')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      const ordersWithItems: Order[] = [];

      for (const order of ordersData || []) {
        // Fetch order items
        const { data: itemsData, error: itemsError } = await supabase
          .from('order_items')
          .select('id, product_id, quantity, price_cents')
          .eq('order_id', order.id);

        if (itemsError) throw itemsError;

        // For each item, fetch the product
        const itemsWithProduct: OrderItem[] = [];
        for (const item of itemsData || []) {
          const { data: productData, error: productError } = await supabase
            .from('products')
            .select('id, name, image_url')
            .eq('id', item.product_id)
            .single();
          if (productError) throw productError;

          itemsWithProduct.push({ ...item, product: productData });
        }

        ordersWithItems.push({ ...order, items: itemsWithProduct });
      }

      setOrders(ordersWithItems);
    } catch (err: any) {
      console.error(err);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.text}>Loading your orders...</Text>
      </SafeAreaView>
    );
  }

  if (!orders.length) {
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity style={styles.arrowBack} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color="#1DB954" />
        </TouchableOpacity>
        <Text style={styles.text}>You haven't placed any orders yet.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={{ width: '100%' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchOrders} tintColor="#1DB954" />}
      >
        <TouchableOpacity style={styles.arrowBack} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color="#1DB954" />
        </TouchableOpacity>

        <Text style={styles.title}>My Orders</Text>

        {orders.map((order) => (
          <View key={order.id} style={styles.orderCard}>
            <View style={styles.orderHeader}>
              <Text style={styles.orderId}>Order #{order.id.slice(0, 6)}</Text>
              <Text style={styles.date}>{new Date(order.created_at).toLocaleDateString()}</Text>
            </View>
            <Text style={styles.address}>Shipping: {order.address}</Text>

            {order.items.map((item) => (
              <View key={item.id} style={styles.itemCard}>
                <Image
                  source={{ uri: item.product?.image_url || 'https://via.placeholder.com/80' }}
                  style={styles.itemImage}
                />
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.product?.name || 'Product'}</Text>
                  <Text style={styles.itemDetails}>Quantity: {item.quantity}</Text>
                  <Text style={styles.itemDetails}>Spent: {item.price_cents} credits</Text>
                </View>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

export default Orders;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  text: { color: '#fff', fontSize: 18, marginTop: 40, textAlign: 'center' },
  title: { color: '#1DB954', fontSize: 28, fontWeight: '700', marginBottom: 16, alignSelf: 'center' },
  arrowBack: { marginBottom: 16, padding: 6 },

  orderCard: {
    backgroundColor: '#121212',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 5,
  },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  orderId: { color: '#fff', fontWeight: '700', fontSize: 16 },
  date: { color: '#888', fontSize: 12 },
  address: { color: '#aaa', fontSize: 13, marginBottom: 12 },

  itemCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    alignItems: 'center',
  },
  itemImage: { width: 60, height: 60, borderRadius: 12, marginRight: 12 },
  itemInfo: { flex: 1 },
  itemName: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  itemDetails: { color: '#aaa', fontSize: 13 },
});

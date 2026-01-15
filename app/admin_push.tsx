import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { supabase } from './supabaseClient';
import { useRouter } from 'expo-router';

export default function AdminPushScreen() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  // 1. SECURITY CHECK: Only let YOU in
  useEffect(() => {
    async function checkAccess() {
      const { data: { user } } = await supabase.auth.getUser();
      
      // PASTE YOUR ACTUAL SUPABASE USER ID HERE
      const MY_ID = "2664d72a-4db6-4e41-8963-949bafed8922";

      if (user?.id === MY_ID) {
        setIsAdmin(true);
      } else {
        Alert.alert("Unauthorized", "You do not have permission to access this page.");
        router.replace("/(tabs)");
      }
    }
    checkAccess();
  }, []);

  const handleBroadcast = async () => {
    if (!title || !body) return Alert.alert("Error", "Fill in all fields");

    setLoading(true);
    try {
      // 2. GET TOKENS (The "Addresses")
      const { data: devices, error: deviceError } = await supabase
        .from('user_push_data')
        .select('user_id, expo_push_token');

      if (deviceError || !devices || devices.length === 0) {
        throw new Error("No registered devices found.");
      }

      // 3. CREATE LOGS (The "Inbox" history for each user)
      const logs: any[] = devices.map(d => ({
        user_id: d.user_id,
        title: title,
        body: body,
      }));

      const { error: logError } = await supabase.from('notifications_log').insert(logs);
      if (logError) throw logError;

      // 4. FIRE PUSH (Telling Expo to notify the phones)
      const pushMessages = devices.map(d => ({
        to: d.expo_push_token,
        title: title,
        body: body,
        sound: 'default',
        data: { screen: "/(tabs)/notifications" } // Tells the app where to go when tapped
      }));

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pushMessages),
      });

      if (response.ok) {
        Alert.alert("Success! 🎉", `Broadcast sent to ${devices.length} users.`);
        setTitle('');
        setBody('');
      }
    } catch (err: any) {
      Alert.alert("Failed", err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) return <View style={styles.container}><ActivityIndicator color="#1DB954" /></View>;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Broadcast Center</Text>
      <Text style={styles.subHeader}>Send a notification to all users</Text>
      
      <View style={styles.card}>
        <Text style={styles.label}>Notification Title</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. New Music Drop!"
          placeholderTextColor="#666"
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>Message Body</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="e.g. Check out the new track in the marketplace..."
          placeholderTextColor="#666"
          value={body}
          onChangeText={setBody}
          multiline
        />

        <TouchableOpacity 
          style={[styles.button, loading && { opacity: 0.5 }]} 
          onPress={handleBroadcast}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Send Push to Everyone</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#000', padding: 20, justifyContent: 'center' },
  header: { color: '#fff', fontSize: 28, fontWeight: 'bold', textAlign: 'center' },
  subHeader: { color: '#888', textAlign: 'center', marginBottom: 30, fontSize: 14 },
  card: { backgroundColor: '#111', padding: 20, borderRadius: 15, borderWidth: 1, borderColor: '#333' },
  label: { color: '#1DB954', fontWeight: 'bold', marginBottom: 8, fontSize: 12, textTransform: 'uppercase' },
  input: { backgroundColor: '#000', color: '#fff', padding: 15, borderRadius: 10, marginBottom: 20, borderWidth: 1, borderColor: '#444' },
  textArea: { height: 120, textAlignVertical: 'top' },
  button: { backgroundColor: '#1DB954', padding: 18, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
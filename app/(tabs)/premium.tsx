import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, SafeAreaView, ActivityIndicator } from 'react-native';
import * as Linking from 'expo-linking';
import { FontAwesome5 } from '@expo/vector-icons';
import { supabase } from '../supabaseClient'; 

// ✅ Import the context to check status
import { usePremium } from '../PremiumContex'; 

export default function PremiumTab() {
  // ✅ Get premium status and loading state
  const { isPremium, loading } = usePremium();

  const handleUpgrade = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert("Sign In Required", "Please log in to your account to upgrade to Premium.");
        return;
      }

      // The URL that triggers your Stripe flow on Render
      const webUrl = `https://iseehalo-web.onrender.com/?user_id=${user.id}`;
      
      const supported = await Linking.canOpenURL(webUrl);
      if (supported) {
        await Linking.openURL(webUrl);
      } else {
        Alert.alert("Error", "Could not open the browser. Please visit iseehalo-web.onrender.com directly.");
      }
      
    } catch (error) {
      console.error("Link error:", error);
      Alert.alert("Error", "Could not open the upgrade page.");
    }
  };

  // Show a loader while checking the database
  if (loading) {
    return (
      <View style={[styles.safeArea, {justifyContent: 'center', alignItems: 'center'}]}>
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <FontAwesome5 name="crown" size={50} color="#1DB954" />
          <Text style={styles.title}>Iseehalo Premium</Text>
          <Text style={styles.subtitle}>The ultimate music experience</Text>
        </View>

        <View style={styles.card}>
          {isPremium ? (
            /* --- WHAT PREMIUM USERS SEE --- */
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
              <FontAwesome5 name="check-circle" size={60} color="#1DB954" />
              <Text style={[styles.cardTitle, { marginTop: 20, textAlign: 'center' }]}>Premium Active</Text>
              <Text style={[styles.featureText, { textAlign: 'center', marginLeft: 0 }]}>
                You are currently a Premium member. Thank you for supporting Iseehalo!
              </Text>
            </View>
          ) : (
            /* --- WHAT FREE USERS SEE --- */
            <>
              <Text style={styles.cardTitle}>Premium Features</Text>
              
              <View style={styles.featureRow}>
                <FontAwesome5 name="check" size={18} color="#1DB954" />
                <Text style={styles.featureText}>Ad-free music listening</Text>
              </View>
              
              <View style={styles.featureRow}>
                <FontAwesome5 name="check" size={18} color="#1DB954" />
                <Text style={styles.featureText}>Access to the Credit System</Text>
              </View>

              <View style={styles.featureRow}>
                <FontAwesome5 name="check" size={18} color="#1DB954" />
                <Text style={styles.featureText}>High-quality audio</Text>
              </View>

              <View style={styles.featureRow}>
                <FontAwesome5 name="check" size={18} color="#1DB954" />
                <Text style={styles.featureText}>Unlimited skips</Text>
              </View>

              <TouchableOpacity style={styles.button} onPress={handleUpgrade}>
                <Text style={styles.buttonText}>GET PREMIUM</Text>
              </TouchableOpacity>
              
              <Text style={styles.footerText}>Only $9.99/month. Recurring billing. Cancel anytime.</Text>
            </>
          )}
        </View>

        {!isPremium && (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Clicking 'Get Premium' will take you to our secure checkout page on the web to complete your purchase via Stripe.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#000' },
  container: { flex: 1 },
  header: { paddingVertical: 50, alignItems: 'center' },
  title: { color: '#fff', fontSize: 32, fontWeight: 'bold', marginTop: 15 },
  subtitle: { color: '#888', fontSize: 16, marginTop: 5 },
  card: { backgroundColor: '#121212', marginHorizontal: 20, padding: 30, borderRadius: 20, borderWidth: 1, borderColor: '#333' },
  cardTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 25 },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  featureText: { color: '#fff', marginLeft: 15, fontSize: 16, lineHeight: 22 },
  button: { backgroundColor: '#1DB954', paddingVertical: 18, borderRadius: 35, marginTop: 20, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  footerText: { color: '#666', textAlign: 'center', marginTop: 20, fontSize: 12 },
  infoBox: { padding: 40 },
  infoText: { color: '#444', textAlign: 'center', fontSize: 13, lineHeight: 20 }
});
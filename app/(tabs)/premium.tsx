import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, SafeAreaView, ActivityIndicator } from 'react-native';
import * as Linking from 'expo-linking';
import { FontAwesome5 } from '@expo/vector-icons';
import { supabase } from '../supabaseClient'; 
import { usePremium } from '../PremiumContex'; 

export default function PremiumTab() {
  const { isPremium, loading } = usePremium();

  const handleUpgrade = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert("Sign In Required", "Please log in to your account to upgrade to Premium.");
        return;
      }

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

  if (loading) {
    return (
      <View style={[styles.safeArea, {justifyContent: 'center', alignItems: 'center'}]}>
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        
        {/* Header Section */}
        <View style={styles.header}>
          <FontAwesome5 name="crown" size={44} color="#1DB954" style={{ marginBottom: 15 }} />
          <Text style={styles.mainTitle}>Iseehalo Premium</Text>
          <Text style={styles.mainSubtitle}>The ultimate music experience</Text>
        </View>

        {/* Pricing Card */}
        <View style={styles.pricingCard}>
          {isPremium ? (
            /* --- PREMIUM ACTIVE STATE --- */
            <View style={{ alignItems: 'center', paddingVertical: 10 }}>
              <FontAwesome5 name="check-circle" size={50} color="#1DB954" />
              <Text style={styles.planTitle}>Premium Active</Text>
              <Text style={styles.termsText}>
                You are currently a Premium member. Thank you for supporting Iseehalo!
              </Text>
            </View>
          ) : (
           
            <>
              <Text style={styles.planTitle}>Individual Premium</Text>
              <Text style={styles.priceText}>$7.99 / month</Text>

              <View style={styles.featureList}>
                <View style={styles.featureRow}>
                  <FontAwesome5 name="check" size={14} color="#1DB954" />
                  <Text style={styles.featureText}>1 Premium account</Text>
                </View>
                <View style={styles.featureRow}>
                  <FontAwesome5 name="check" size={14} color="#1DB954" />
                  <Text style={styles.featureText}>Access to the Credit System</Text>
                </View>
                <View style={styles.featureRow}>
                  <FontAwesome5 name="check" size={14} color="#1DB954" />
                  <Text style={styles.featureText}>Access to the Trading System</Text>
                </View>
                <View style={styles.featureRow}>
                  <FontAwesome5 name="check" size={14} color="#1DB954" />
                  <Text style={styles.featureText}>Cancel Anytime</Text>
                </View>
              </View>

              <TouchableOpacity 
                style={styles.premiumButton} 
                activeOpacity={0.8}
                onPress={handleUpgrade}
              >
                <Text style={styles.buttonText}>Get Premium</Text>
              </TouchableOpacity>

              <Text style={styles.termsText}>
                By clicking this button you'll be taken to our website. Terms apply.
              </Text>
            </>
          )}
        </View>

        <Text style={styles.footerNote}>
          Experience music like never before with exclusive releases and priority access.
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#000' },
  container: { flex: 1, paddingHorizontal: 16 },
  header: { alignItems: 'center', marginTop: 40, marginBottom: 30 },
  mainTitle: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  mainSubtitle: { color: '#A7A7A7', fontSize: 16, marginTop: 4, fontWeight: '500' },
  
  pricingCard: { 
    backgroundColor: '#121212', // Lighter than background to pop
    borderRadius: 12, 
    padding: 24, 
    borderWidth: 1, 
    borderColor: '#282828', // Subtle border for definition
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  planTitle: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 6 },
  priceText: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 20 },
  
  featureList: { marginBottom: 25 },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  featureText: { color: '#fff', marginLeft: 12, fontSize: 15, fontWeight: '500' },
  
  premiumButton: { 
    backgroundColor: '#1DB954', // Spotify Green
    paddingVertical: 14, 
    borderRadius: 25, 
    alignItems: 'center',
    marginBottom: 16
  },
  buttonText: { color: '#000', fontSize: 16, fontWeight: '700' }, // Black text on Green is more professional
  termsText: { color: '#A7A7A7', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  footerNote: { color: '#535353', fontSize: 13, textAlign: 'center', marginTop: 40, paddingHorizontal: 20 }
});
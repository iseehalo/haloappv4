// app/(tabs)/profile.tsx
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../supabaseClient';

const Profile = () => {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [totalCredits, setTotalCredits] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Modal state for editing
  const [editVisible, setEditVisible] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newBio, setNewBio] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    let channel: any;

    const initialize = async () => {
      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        
        if (!authUser) {
          setLoading(false);
          return;
        }

        // --- ADMIN CHECK ---
        // Replace this string with your ID from Supabase Auth Dashboard
        const MY_ADMIN_ID = "3b24ccdf-175d-4284-9fbe-1cebc9fdbe8c";
        if (authUser.id === MY_ADMIN_ID) {
          setIsAdmin(true);
        }

        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('id, email, username, bio, profile_picture, credits')
          .eq('id', authUser.id)
          .single();

        if (profileError) throw profileError;

        setUser(profile);
        setTotalCredits(profile.credits || 0);

        channel = supabase
          .channel(`user-profile-${profile.id}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'users',
              filter: `id=eq.${profile.id}`,
            },
            async ({ new: updated }) => {
              setUser(updated);
              setTotalCredits(updated.credits || 0);
            }
          )
          .subscribe();
      } catch (err) {
        console.error(err);
        Alert.alert('Error', 'Could not fetch user info.');
      } finally {
        setLoading(false);
      }
    };

    initialize();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const onRefresh = useCallback(async () => {
    if (!user?.id) return setRefreshing(false);

    setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('credits, username, bio, profile_picture')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      setUser({ ...user, ...data });
      setTotalCredits(data.credits || 0);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to refresh profile.');
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('Error', error.message);
  };

  const pickProfilePic = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
        allowsEditing: true,
      });
      if (res.canceled) return;

      const uri = res.assets[0].uri;
      const ext = uri.split('.').pop();
      const filename = `${user.id}-${Date.now()}.${ext}`;
      setUploading(true);

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const arrayBuffer = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

      const { error } = await supabase.storage
        .from('iseehalo songs')
        .upload(filename, arrayBuffer, { upsert: true });
      if (error) throw error;

      const publicUrl = supabase.storage
        .from('iseehalo songs')
        .getPublicUrl(filename).data.publicUrl;

      const { error: updateError } = await supabase
        .from('users')
        .update({ profile_picture: publicUrl })
        .eq('id', user.id);
      if (updateError) throw updateError;

      setUser({ ...user, profile_picture: publicUrl });
      Alert.alert('Success', 'Profile picture updated!');
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err.message);
    } finally {
      setUploading(false);
    }
  };

  if (loading)
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );

  if (!user)
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Not signed in.</Text>
      </View>
    );

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ width: '100%' }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1DB954" />
        }
      >
        {/* Top Section */}
        <View style={styles.topContainer}>
          <View style={{ position: 'relative' }}>
            {user.profile_picture ? (
              <Image source={{ uri: user.profile_picture }} style={styles.profilePic} />
            ) : (
              <View style={[styles.profilePic, { backgroundColor: '#333' }]} />
            )}
            <TouchableOpacity style={styles.cameraIcon} onPress={pickProfilePic} disabled={uploading}>
              <Ionicons name="camera" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.username}>{user.username || 'No username'}</Text>
            {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
          </View>
        </View>

        <Text style={styles.email}>{user.email}</Text>

        <TouchableOpacity
          style={[styles.button, { marginTop: 16 }]}
          onPress={() => {
            setNewUsername(user.username || '');
            setNewBio(user.bio || '');
            setEditVisible(true);
          }}
        >
          <Text style={styles.buttonText}>Edit Profile</Text>
        </TouchableOpacity>

        {/* Total Credits */}
        <View style={{ marginTop: 24 }}>
          <Text style={styles.label}>Total Credits:</Text>
          <Text style={[styles.text, { color: '#1DB954' }]}>{totalCredits.toFixed(2)}</Text>
        </View>

        {/* Navigation Buttons */}
        <TouchableOpacity 
           style={[styles.button, styles.navButton]} 
           onPress={() => router.push('/PurchasedCopies' as any)}
        >
          <Text style={styles.buttonText}>Purchased Copies</Text>
        </TouchableOpacity>

        <TouchableOpacity 
           style={[styles.button, styles.navButton]} 
           onPress={() => router.push('/products/orders' as any)}
        >
          <Text style={styles.buttonText}>My Orders</Text>
        </TouchableOpacity>

        <TouchableOpacity 
           style={[styles.button, styles.navButton]} 
           onPress={() => router.push(`/MySongs?userId=${user.id}` as any)}
        >
          <Text style={styles.buttonText}>My Uploaded Songs</Text>
        </TouchableOpacity>

        {/* --- ADMIN BROADCAST BUTTON --- */}
        {isAdmin && (
          <TouchableOpacity
            style={[styles.button, { marginTop: 24, backgroundColor: '#FF3B30' }]}
            onPress={() => router.push('/admin_push' as any)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="megaphone" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.buttonText}>Broadcast Center (Admin)</Text>
            </View>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[styles.button, { marginTop: 24 }]} onPress={signOut}>
          <Text style={styles.buttonText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Edit Modal */}
      {editVisible && (
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <Text style={styles.modalLabel}>Username</Text>
            <TextInput style={styles.modalInput} value={newUsername} onChangeText={setNewUsername} />
            <Text style={styles.modalLabel}>Bio</Text>
            <TextInput
              style={[styles.modalInput, { height: 80 }]}
              value={newBio}
              onChangeText={setNewBio}
              multiline
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
              <TouchableOpacity style={[styles.button, { flex: 1, marginRight: 8 }]} onPress={() => setEditVisible(false)}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { flex: 1, marginLeft: 8 }]}
                onPress={async () => {
                  setSavingEdit(true);
                  try {
                    const { error } = await supabase
                      .from('users')
                      .update({ username: newUsername, bio: newBio })
                      .eq('id', user.id);
                    if (error) throw error;
                    setUser({ ...user, username: newUsername, bio: newBio });
                    setEditVisible(false);
                  } catch (err: any) {
                    Alert.alert('Error', err.message);
                  } finally {
                    setSavingEdit(false);
                  }
                }}
                disabled={savingEdit}
              >
                <Text style={styles.buttonText}>{savingEdit ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default Profile;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 16, alignItems: 'center' },
  topContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 32 },
  profilePic: { width: 80, height: 80, borderRadius: 40 },
  cameraIcon: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#1DB954', padding: 4, borderRadius: 16 },
  userInfo: { marginLeft: 16, flex: 1 },
  username: { color: '#fff', fontSize: 18, fontWeight: '700' },
  bio: { color: '#aaa', fontSize: 14, marginTop: 4 },
  email: { color: '#888', fontSize: 14, marginTop: 8, alignSelf: 'flex-start' },
  label: { color: '#aaa', fontSize: 16 },
  text: { color: '#fff', fontSize: 18, marginBottom: 12 },
  button: { backgroundColor: '#1DB954', padding: 12, borderRadius: 12, width: '100%', alignItems: 'center' },
  navButton: { marginTop: 16, backgroundColor: '#444' },
  buttonText: { color: '#fff', fontWeight: '600' },
  modalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', zIndex: 999 },
  modalContainer: { backgroundColor: '#121212', padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  modalLabel: { color: '#aaa', fontSize: 14, marginTop: 8 },
  modalInput: { color: '#fff', borderBottomWidth: 1, borderColor: '#1DB954', fontSize: 16, marginTop: 4, paddingVertical: 4 },
});

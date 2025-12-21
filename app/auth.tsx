import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import React, { useState } from 'react';
import {
  Alert,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { supabase } from './supabaseClient';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState(0); // 0 = sign in, 1 = username/profile, 2 = bio
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [profilePic, setProfilePic] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // ------------------- HELPERS -------------------
  const base64ToArrayBuffer = (base64: string) => {
    let binary = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const lookup = new Uint8Array(256);
    for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;

    let bufferLength = base64.length * 0.75;
    if (base64[base64.length - 1] === '=') bufferLength--;
    if (base64[base64.length - 2] === '=') bufferLength--;

    const arrayBuffer = new Uint8Array(bufferLength);
    let p = 0;

    for (let i = 0; i < base64.length; i += 4) {
      const encoded1 = lookup[base64.charCodeAt(i)];
      const encoded2 = lookup[base64.charCodeAt(i + 1)];
      const encoded3 = lookup[base64.charCodeAt(i + 2)];
      const encoded4 = lookup[base64.charCodeAt(i + 3)];

      arrayBuffer[p++] = (encoded1 << 2) | (encoded2 >> 4);
      if (encoded3 !== 64) arrayBuffer[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
      if (encoded4 !== 64) arrayBuffer[p++] = ((encoded3 & 3) << 6) | encoded4;
    }
    return arrayBuffer;
  };

  // Helper: generate unique username
  async function generateUniqueUsername() {
    let uname: string;
    let exists = true;

    while (exists) {
      uname = 'user_' + Math.floor(100000 + Math.random() * 900000); // 6-digit suffix
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('username', uname)
        .maybeSingle();

      if (!error && !data) {
        exists = false;
      }
    }
    return uname;
  }

  // ------------------- FILE PICKER -------------------
  const pickProfilePic = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: 'image/*', copyToCacheDirectory: true });
    if (!res.canceled && res.assets.length > 0) setProfilePic(res.assets[0]);
    else Alert.alert('No image selected');
  };

  // ------------------- SIGN IN -------------------
  const signIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password.');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) Alert.alert('Error', error.message);
      else Alert.alert('Success', 'Signed in!');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  // ------------------- EMAIL AUTH BEFORE ACCOUNT CREATION -------------------
  const startAccountCreation = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Enter email and password first');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        Alert.alert('Error', error.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        // Generate username
        const genUsername = await generateUniqueUsername();

        // Default profile picture
        const defaultProfilePic =
          'https://eanzstoycfuxqguwjuom.supabase.co/storage/v1/object/public/iseehalo%20songs/profile-icon-design-free-vector.jpg';

        // Insert user row
        const { error: insertError } = await supabase
          .from('users')
          .insert([{ id: data.user.id, email: data.user.email, username: genUsername, profile_picture: defaultProfilePic }]);
        if (insertError) throw insertError;

        Alert.alert('Welcome!', `Your username is ${genUsername}. Please sign in to continue.`);
      }

      // Reset state and go back to sign-in
      setStep(0);
      setEmail('');
      setPassword('');
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // ------------------- UPLOAD PROFILE PIC -------------------
  const uploadProfilePic = async (userId: string) => {
    if (!profilePic) return null;
    const ext = profilePic.name.split('.').pop();
    const filename = `${Date.now()}-${username}.${ext}`;
    const base64 = await FileSystem.readAsStringAsync(profilePic.uri, { encoding: FileSystem.EncodingType.Base64 });
    const data = base64ToArrayBuffer(base64);
    const { error } = await supabase.storage.from('iseehalo songs').upload(filename, data, { upsert: true });
    if (error) throw error;
    const publicUrl = supabase.storage.from('iseehalo songs').getPublicUrl(filename).data.publicUrl;
    return publicUrl;
  };

  // ------------------- FINISH ACCOUNT CREATION -------------------
  const finishAccountCreation = async () => {
    setLoading(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error('No authenticated user');
      const profileUrl = await uploadProfilePic(user.id);

      const { error } = await supabase
        .from('users')
        .update({ username, profile_picture: profileUrl, bio })
        .eq('id', user.id);
      if (error) throw error;

      Alert.alert('Success', 'Account created!');
      setStep(0);
      setEmail('');
      setPassword('');
      setUsername('');
      setBio('');
      setProfilePic(null);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // ------------------- RENDER SLIDER STEPS -------------------
  const renderStep = () => {
    if (step === 0) {
      return (
        <>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#aaa"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#aaa"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <TouchableOpacity style={styles.button} onPress={signIn} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? 'Loading...' : 'Sign In'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.linkButton, { marginTop: 12 }]} onPress={startAccountCreation}>
            <Text style={styles.linkText}>Create Account</Text>
          </TouchableOpacity>
        </>
      );
    } else if (step === 1) {
      return (
        <>
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor="#aaa"
            value={username}
            onChangeText={setUsername}
          />
          <TouchableOpacity style={styles.pickButton} onPress={pickProfilePic}>
            <Text style={styles.buttonText}>{profilePic ? 'Change Profile Pic' : 'Pick Profile Pic'}</Text>
          </TouchableOpacity>

          {profilePic && <Image source={{ uri: profilePic.uri }} style={styles.profilePreview} />}

          <Text style={styles.signInText}>
            Already have an account?{' '}
            <Text style={styles.signInLink} onPress={() => setStep(0)}>
              Sign In
            </Text>
          </Text>
        </>
      );
    } else if (step === 2) {
      return (
        <>
          <TextInput
            style={[styles.input, { height: 100 }]}
            placeholder="Bio"
            placeholderTextColor="#aaa"
            value={bio}
            onChangeText={setBio}
            multiline
          />
          <Text style={styles.signInText}>
            Already have an account?{' '}
            <Text style={styles.signInLink} onPress={() => setStep(0)}>
              Sign In
            </Text>
          </Text>
        </>
      );
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>
        <Text style={styles.logoIsee}>isee</Text>
        <Text style={styles.logoHalo}>halo</Text>
      </Text>

      <View style={{ width: '100%', alignItems: 'center' }}>{renderStep()}</View>

      {/* Navigation arrows */}
      {step > 0 && (
        <View style={styles.navRow}>
          <TouchableOpacity onPress={() => setStep(step - 1)}>
            <Ionicons name="arrow-back-circle-outline" size={40} color="#fff" />
          </TouchableOpacity>
          {step < 2 && (
            <TouchableOpacity onPress={() => setStep(step + 1)}>
              <Ionicons name="arrow-forward-circle-outline" size={40} color="#fff" />
            </TouchableOpacity>
          )}
          {step === 2 && (
            <TouchableOpacity onPress={finishAccountCreation}>
              <Ionicons name="checkmark-circle-outline" size={40} color="#1DB954" />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

export default Auth;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    fontSize: 36,
    fontFamily: 'Lato_700Bold',
    marginBottom: 32,
    flexDirection: 'row',
  },
  logoIsee: { color: '#fff', fontFamily: 'Lato_700Bold' },
  logoHalo: { color: '#FFFF33', fontFamily: 'Lato_700Bold' },
  input: {
    width: '100%',
    backgroundColor: '#111',
    color: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    fontFamily: 'Lato_400Regular',
  },
  button: {
    backgroundColor: '#1DB954',
    padding: 12,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600', fontFamily: 'Lato_700Bold' },
  pickButton: {
    padding: 12,
    backgroundColor: '#1DB954',
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  profilePreview: { width: 120, height: 120, borderRadius: 60, marginTop: 8, marginBottom: 12 },
  linkButton: { marginTop: 8 },
  linkText: { color: '#1DB954', fontWeight: '600' },
  navRow: {
    position: 'absolute',
    top: 40,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  signInText: { color: '#aaa', marginTop: 12 },
  signInLink: { color: '#1DB954', fontWeight: 'bold' },
});


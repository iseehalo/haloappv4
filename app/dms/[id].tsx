import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../supabaseClient';

type Message = {
  id: string;
  sender_id: string;
  sender_profile_picture?: string | null;
  content: string;
  created_at: string;
};

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [recipientId, setRecipientId] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);

  /** ---------------- GET CURRENT USER ---------------- **/
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setCurrentUserId(data.user.id);
    });
  }, []);

  /** ---------------- FETCH RECIPIENT ---------------- **/
  useEffect(() => {
    const fetchRecipient = async () => {
      if (!currentUserId) return;

      // Replace with your table that links users to conversations
      const { data } = await supabase
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', id);

      if (data) {
        const otherUser = data.find((p: any) => p.user_id !== currentUserId);
        if (otherUser) setRecipientId(otherUser.user_id);
      }
    };

    fetchRecipient();
  }, [currentUserId, id]);

  /** ---------------- FETCH MESSAGES ---------------- **/
  const fetchMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select(
        `
        *,
        sender:users (
          profile_picture
        )
      `
      )
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });

    if (!data) return;

    setMessages(
      data.map((m: any) => ({
        ...m,
        sender_profile_picture: m.sender?.profile_picture,
      }))
    );
  };

  /** ---------------- SEND MESSAGE ---------------- **/
  const sendMessage = async () => {
    if (!input.trim() || !currentUserId) return;

    const temp: Message = {
      id: Math.random().toString(),
      sender_id: currentUserId,
      content: input.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, temp]);
    setInput('');

    await supabase.rpc('send_message', {
      conv: id,
      sender: currentUserId,
      msg: temp.content,
    });
  };

  /** ---------------- SEND CREDITS ---------------- **/
  const sendCredits = async () => {
    if (!currentUserId || !recipientId) {
      Alert.alert('Error', 'No recipient found.');
      return;
    }

    Alert.prompt(
      'Send Credits',
      'Enter the amount of credits to send:',
      async (amountStr) => {
        if (!amountStr) return;
        const amount = parseFloat(amountStr);
        if (isNaN(amount) || amount <= 0) {
          Alert.alert('Invalid amount', 'Please enter a valid number.');
          return;
        }

        const { data, error } = await supabase.rpc('send_credits', {
          sender_uuid: currentUserId,
          receiver_uuid: recipientId,
          amount,
        });

        if (error) {
          Alert.alert('Error', error.message);
          return;
        }

        if (data === 'Not enough credits') {
          Alert.alert('Failed', 'Not enough credits to send.');
        } else {
          Alert.alert('Success', `Sent ${amount} credits successfully!`);
        }
      },
      'plain-text'
    );
  };

  /** ---------------- REAL-TIME ---------------- **/
  useEffect(() => {
    fetchMessages();

    const channel = supabase
      .channel(`conversation-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${id}`,
        },
        (payload) => {
          setMessages((prev) => {
            if (
              prev.some(
                (m) =>
                  m.content === payload.new.content &&
                  m.sender_id === payload.new.sender_id
              )
            ) {
              return prev;
            }
            return [...prev, payload.new];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  /** ---------------- AUTO-SCROLL ---------------- **/
  useEffect(() => {
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chat</Text>
        <TouchableOpacity onPress={sendCredits} style={{ marginLeft: 'auto' }}>
          <Ionicons name="cash-outline" size={28} color="#4ade80" />
        </TouchableOpacity>
      </View>

      {/* Messages + Input */}
      <View style={styles.content}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16 }}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
          renderItem={({ item }) => {
            const isMe = item.sender_id === currentUserId;

            return (
              <View
                style={{
                  flexDirection: isMe ? 'row-reverse' : 'row',
                  alignItems: 'flex-end',
                  marginVertical: 4,
                }}
              >
                {!isMe && item.sender_profile_picture && (
                  <Image
                    source={{ uri: item.sender_profile_picture }}
                    style={styles.avatar}
                  />
                )}

                <View
                  style={[
                    styles.bubble,
                    isMe ? styles.myMessage : styles.theirMessage,
                  ]}
                >
                  <Text style={styles.text}>{item.content}</Text>
                </View>
              </View>
            );
          }}
        />

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Type a message…"
            placeholderTextColor="#777"
            onSubmitEditing={sendMessage}
            returnKeyType="send"
          />
          <TouchableOpacity onPress={sendMessage}>
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

/** ---------------- STYLES ---------------- **/
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 12,
  },

  content: {
    flex: 1,
  },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 8,
  },

  bubble: {
    padding: 10,
    borderRadius: 8,
    maxWidth: '70%',
  },
  myMessage: {
    backgroundColor: '#4ade80',
  },
  theirMessage: {
    backgroundColor: '#222',
  },
  text: {
    color: '#fff',
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#222',
    backgroundColor: '#0a0a0a',
  },
  input: {
    flex: 1,
    backgroundColor: '#121212',
    color: '#fff',
    padding: 10,
    borderRadius: 8,
    marginRight: 8,
  },
});

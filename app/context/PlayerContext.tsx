// app/context/PlayerContext.tsx
import { Audio } from 'expo-av';
import React, { createContext, useContext, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { Song } from '../types';

type PlayerContextType = {
  currentSong: Song | null;
  playSong: (song: Song) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  closePlayer: () => Promise<void>;
  isPlaying: boolean;
  positionMillis: number;
  durationMillis: number;
  sound: Audio.Sound | null;
};

const PlayerContext = createContext<PlayerContextType | null>(null);
export const usePlayer = () => useContext(PlayerContext);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);

  const playSong = async (song: Song) => {
    if (!song.audio_url) return;

    try {
      // 🔥 Instant increment stream count in DB
      const { error } = await supabase.rpc('increment_stream', { song_uuid: song.id });
      if (error) console.error('Error incrementing stream:', error);

      // Stop/unload previous sound if exists
      if (sound) {
        try {
          await sound.stopAsync();
          await sound.unloadAsync();
        } catch {}
      }

      // Create and play new sound
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: song.audio_url },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded) {
            setPositionMillis(status.positionMillis);
            setDurationMillis(status.durationMillis || 0);
            setIsPlaying(status.isPlaying);
          }
        }
      );

      setSound(newSound);
      setCurrentSong(song);
      setIsPlaying(true);
      setPositionMillis(0);
      setDurationMillis(0);
    } catch (err) {
      console.error('Error playing song:', err);
    }
  };

  const togglePlayPause = async () => {
    if (!sound) return;
    if (isPlaying) {
      await sound.pauseAsync();
      setIsPlaying(false);
    } else {
      await sound.playAsync();
      setIsPlaying(true);
    }
  };

  const closePlayer = async () => {
    if (sound) {
      try {
        await sound.stopAsync();
        await sound.unloadAsync();
      } catch {}
    }
    setCurrentSong(null);
    setSound(null);
    setIsPlaying(false);
    setPositionMillis(0);
    setDurationMillis(0);
  };

  return (
    <PlayerContext.Provider
      value={{
        currentSong,
        playSong,
        togglePlayPause,
        closePlayer,
        isPlaying,
        positionMillis,
        durationMillis,
        sound,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Platform, Linking } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import { useStore } from './store';
import { validateLocalTrack, type LocalTrack, musicServices } from '../core/music';
import { deviceAudioUri } from './device-audio';
import type { DeviceTrack } from './device-audio-types';
function useMusicController() {
  const player = useAudioPlayer(null, { updateInterval: 1000 });
  const status = useAudioPlayerStatus(player);
  const generation = useRef(0);
  const [track, setTrack] = useState<LocalTrack | null>(null);
  const [repeat, setRepeat] = useState(false);
  useEffect(() => () => { generation.current++; }, []);
  const clear = () => { generation.current++; player.pause(); if (Platform.OS !== 'web') player.setActiveForLockScreen(false); setTrack(null); };
  async function choose() {
    const owner = generation.current;
    const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', multiple: false, copyToCacheDirectory: true, base64: false });
    if (result.canceled || owner !== generation.current) return;
    const next = validateLocalTrack(result.assets[0]);
    clear(); player.replace({ uri: next.uri }); setTrack(next);
  }
  // A song picked from the in-app list (Android media store). MediaStore has
  // already classified it as audio; the file stays on the phone.
  async function chooseDevice(item: DeviceTrack) {
    const owner = generation.current;
    const uri = await deviceAudioUri(item.id);
    if (owner !== generation.current) return;
    const next = validateLocalTrack({ name: item.name, uri, mimeType: 'audio/*' });
    clear(); player.replace({ uri: next.uri }); setTrack(next);
  }
  async function toggle() {
    if (!track || !status.isLoaded) return;
    if (status.playing) { player.pause(); return; }
    const owner = generation.current;
    await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: Platform.OS !== 'web', interruptionMode: 'doNotMix', allowsRecording: false });
    if (owner !== generation.current) return;
    if (status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration)) await player.seekTo(0);
    if (Platform.OS !== 'web') player.setActiveForLockScreen(true, { title: track.name, artist: 'Snap to Fit · Your music' });
    player.play();
  }
  async function openService(url: string) {
    if (!musicServices.some(s => s.url === url)) throw new Error('Unknown music service.');
    player.pause(); if (Platform.OS !== 'web') player.setActiveForLockScreen(false);
    await Linking.openURL(url);
  }
  return { track, status, repeat, choose, chooseDevice, toggle, clear, openService,
    setRepeat: (v: boolean) => {
      // Expo AudioPlayer is a native mutable object; loop is its documented setter.
      // eslint-disable-next-line react-hooks/immutability
      player.loop = v;
      setRepeat(v);
    },
    seek: async (delta: number) => { if (status.isLoaded) await player.seekTo(Math.min(status.duration, Math.max(0, status.currentTime + delta))); },
  };
}
type Music = ReturnType<typeof useMusicController>;
const Context = createContext<Music | null>(null);
function SessionMusicProvider({ children }: { children: React.ReactNode }) {
  const value = useMusicController();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function MusicProvider({ children }: { children: React.ReactNode }) {
  const { namespace } = useStore();
  // Static web rendering runs without a browser `Audio` object. The provider
  // renders no markup and screens only mount after the store loads on the
  // client, so skipping it during that server pass keeps hydration identical.
  if (Platform.OS === 'web' && typeof window === 'undefined') return <>{children}</>;
  return <SessionMusicProvider key={namespace}>{children}</SessionMusicProvider>;
}
export function useMusic() {
  const value = useContext(Context);
  if (!value) throw new Error('Music provider is missing.');
  return value;
}

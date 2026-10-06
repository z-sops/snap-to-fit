export const musicServices = [
  { name: 'Spotify', url: 'https://open.spotify.com/' },
  { name: 'Apple Music', url: 'https://music.apple.com/' },
  { name: 'YouTube Music', url: 'https://music.youtube.com/' },
] as const;
export type LocalTrack = { name: string; uri: string; mimeType?: string; size?: number };
export function validateLocalTrack(track: LocalTrack) {
  if (!track.uri || !track.name || (track.mimeType && !track.mimeType.startsWith('audio/')) || (!track.mimeType && !/\.(mp3|m4a|aac|wav|ogg|flac)$/i.test(track.name)))
    throw new Error('Choose a supported audio file such as MP3, M4A or WAV.');
  if (track.size !== undefined && (!Number.isFinite(track.size) || track.size <= 0 || track.size > 50 * 1024 * 1024))
    throw new Error('Choose an audio file smaller than 50 MB.');
  return track;
}
export function musicTime(seconds: number) {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

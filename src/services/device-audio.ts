import type { DeviceTrack } from "./device-audio-types";

// iOS and web: songs are not exposed as a media library here, so Music keeps
// using the system document picker.
export const deviceAudioSupported = false;

export async function deviceAudioPermission(_ask: boolean) {
  return { granted: false, canAskAgain: false };
}

export async function listDeviceAudio(_limit?: number): Promise<DeviceTrack[]> {
  return [];
}

export async function deviceAudioUri(_id: string): Promise<string> {
  throw new Error("Choosing songs in the app is only available on Android.");
}

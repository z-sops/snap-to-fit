import * as MediaLibrary from "expo-media-library";
import type { DeviceTrack } from "./device-audio-types";

// Android: list songs from the phone's media store inside Snap to Fit, so the
// user never leaves the app for the system Files picker. Only the
// "Music and audio" (READ_MEDIA_AUDIO) permission is requested.
export const deviceAudioSupported = true;

export async function deviceAudioPermission(ask: boolean) {
  const r = ask
    ? await MediaLibrary.requestPermissionsAsync(false, ["audio"])
    : await MediaLibrary.getPermissionsAsync(false, ["audio"]);
  return { granted: r.granted, canAskAgain: r.canAskAgain };
}

export async function listDeviceAudio(limit = 500): Promise<DeviceTrack[]> {
  const rows = await new MediaLibrary.Query()
    .eq(MediaLibrary.AssetField.MEDIA_TYPE, MediaLibrary.MediaType.AUDIO)
    .orderBy({ key: MediaLibrary.AssetField.MODIFICATION_TIME, ascending: false })
    .limit(limit)
    .exeForMetadata();
  return rows.map((m) => ({
    id: m.id,
    name: m.filename || "Untitled audio",
    durationMs: m.duration ?? undefined,
  }));
}

export async function deviceAudioUri(id: string) {
  return new MediaLibrary.Asset(id).getUri();
}

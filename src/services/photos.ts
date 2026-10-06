import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
export async function pickPhoto(camera: boolean) {
  if (camera) {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted)
      throw new Error(
        "Camera permission was declined. You can choose a photo or log manually.",
      );
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    quality: 0.8,
  };
  const result = camera
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled) return null;
  const image = await manipulateAsync(
    result.assets[0].uri,
    [{ resize: { width: 768 } }],
    { compress: 0.7, format: SaveFormat.JPEG, base64: true },
  );
  if (!image.base64)
    throw new Error("The selected photo could not be processed.");
  return {
    data: image.base64,
    mimeType: "image/jpeg",
    uri: `data:image/jpeg;base64,${image.base64}`,
  };
}

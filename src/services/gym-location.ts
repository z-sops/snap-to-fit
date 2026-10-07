import * as Location from "expo-location";
async function within<T>(request: Promise<T>, milliseconds: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([request, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}
export async function gymLocation() {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new Error("Location permission was declined. Search by area instead.");
  if (!(await Location.hasServicesEnabledAsync()))
    throw new Error("Location services are off. Enable them or enter an area below.");
  const cached = await within(Location.getLastKnownPositionAsync({ maxAge: 120000, requiredAccuracy: 1000 }), 3000, "No recent location available.").catch(() => null);
  const point = cached || await within(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), 30000,
    "Your phone could not obtain a location. Enter a city or ZIP code below, or search Google Maps.");
  return { center: { latitude: point.coords.latitude, longitude: point.coords.longitude }, recent: !!cached };
}

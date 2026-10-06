export type Coordinates = { latitude: number; longitude: number };
export type GymSearch = { area: string } | { center: Coordinates; radius: number };
export type Gym = { id: string; name: string; address: string; center: Coordinates; distanceKm?: number; mapsURL: string; attributions: { name: string; url?: string }[] };
export type GymResults = { gyms: Gym[]; mode: 'nearby' | 'area' };
export function distanceKm(a: Coordinates, b: Coordinates) {
  const rad = (n: number) => n * Math.PI / 180;
  const v = Math.sin(rad(b.latitude-a.latitude)/2)**2 + Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(rad(b.longitude-a.longitude)/2)**2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, v)));
}
export function validCoordinates(v: unknown): v is Coordinates {
  if (!v || typeof v !== 'object') return false;
  const c = v as Coordinates;
  return typeof c.latitude === 'number' && Number.isFinite(c.latitude) && Math.abs(c.latitude) <= 90 && typeof c.longitude === 'number' && Number.isFinite(c.longitude) && Math.abs(c.longitude) <= 180;
}
export function mapsSearchURL(area: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(area.trim() ? `gyms in ${area.trim()}` : 'gyms near me')}`;
}
export function directionsURL(gym: Gym) {
  return `https://www.google.com/maps/dir/?api=1&destination=${gym.center.latitude},${gym.center.longitude}&destination_place_id=${encodeURIComponent(gym.id)}`;
}

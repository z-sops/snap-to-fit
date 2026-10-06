import { ServiceError } from './database.ts';
import { distanceKm, validCoordinates, type Gym, type GymSearch, type GymResults } from '../src/core/gyms.ts';
export function validateGymSearch(body: unknown): GymSearch {
  if (!body || typeof body !== 'object') throw new ServiceError(400, 'Choose a location or enter an area.');
  const b = body as Record<string, unknown>;
  if ('area' in b) {
    if (typeof b.area !== 'string' || b.area.trim().length < 3 || b.area.trim().length > 160 || 'center' in b)
      throw new ServiceError(400, 'Enter an area, city and country (3–160 characters).');
    return { area: b.area.trim() };
  }
  if (!validCoordinates(b.center) || ![1000, 5000, 10000, 25000].includes(b.radius as number))
    throw new ServiceError(400, 'Invalid location or search radius.');
  return { center: b.center, radius: b.radius as number };
}
type Place = { id?: string; displayName?: { text?: string }; formattedAddress?: string; location?: unknown; businessStatus?: string; googleMapsUri?: string; attributions?: { provider?: string; providerUri?: string }[] };
export async function findGyms(body: unknown, key: string, request: typeof fetch = fetch): Promise<GymResults> {
  const search = validateGymSearch(body);
  if (!key) throw new ServiceError(503, 'Nearby gym listings are not configured yet. Use Search Google Maps below.');
  const nearby = 'center' in search;
  const response = await request(`https://places.googleapis.com/v1/places:${nearby ? 'searchNearby' : 'searchText'}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri,places.businessStatus,places.attributions' },
    body: JSON.stringify(nearby ? { includedTypes: ['gym'], rankPreference: 'DISTANCE', maxResultCount: 20, languageCode: 'en', locationRestriction: { circle: { center: search.center, radius: search.radius } } } : { textQuery: `gyms in ${search.area}`, includedType: 'gym', strictTypeFiltering: true, pageSize: 20, languageCode: 'en' }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new ServiceError(503, 'Gym search is unavailable. Please retry or use Google Maps.');
  const result = await response.json() as { places?: Place[] };
  if (result.places !== undefined && !Array.isArray(result.places)) throw new ServiceError(503, 'Gym provider returned an invalid result.');
  const gyms: Gym[] = [];
  const seen = new Set<string>();
  for (const p of result.places || []) {
    if (!p.id || !p.displayName?.text || !validCoordinates(p.location) || seen.has(p.id) || (p.businessStatus && p.businessStatus !== 'OPERATIONAL')) continue;
    const distance = nearby ? distanceKm(search.center, p.location) : undefined;
    if (nearby && distance! * 1000 > search.radius + 1) continue;
    seen.add(p.id);
    gyms.push({ id: p.id, name: p.displayName.text, address: p.formattedAddress || 'Address unavailable', center: p.location, distanceKm: distance,
      mapsURL: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.displayName.text)}&query_place_id=${encodeURIComponent(p.id)}`,
      attributions: (p.attributions || []).map(a => ({ name: a.provider || '', url: a.providerUri?.startsWith('https://') ? a.providerUri : undefined })).filter(a => a.name) });
  }
  if (nearby) gyms.sort((a,b) => a.distanceKm! - b.distanceKm!);
  return { gyms, mode: nearby ? 'nearby' : 'area' };
}

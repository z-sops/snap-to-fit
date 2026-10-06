import React, { useRef, useState, useEffect } from 'react';
import { Linking, Text } from 'react-native';
import * as Location from 'expo-location';
import { Screen, Card, H, P, Button, Field, Chips, Check, act } from '../components/ui';
import { publicAPI } from '../services/api';
import { directionsURL, mapsSearchURL, type GymResults, type GymSearch } from '../core/gyms';
export default function Gyms() {
  const [area, setArea] = useState('');
  const [radius, setRadius] = useState(5000);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<GymResults | null>(null);
  const active = useRef(0);
  useEffect(() => () => { active.current++; }, []);
  async function search(useLocation: boolean) {
    const id = ++active.current;
    setBusy(true); setError(''); setResult(null);
    try {
      let body: GymSearch = { area };
      if (useLocation) {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) throw new Error('Location permission was declined. Search by area instead.');
        let timer: ReturnType<typeof setTimeout> | undefined;
        const point = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Location took too long. Search by area or retry outdoors.')), 12000); }),
        ]).finally(() => clearTimeout(timer));
        body = { center: { latitude: point.coords.latitude, longitude: point.coords.longitude }, radius };
      }
      if (active.current !== id) return;
      const data = await publicAPI<GymResults>('/gyms/search', body);
      if (active.current === id) setResult(data);
    } catch (e) {
      if (active.current === id) setError(e instanceof Error ? e.message : 'Could not search gyms. Try again.');
    } finally { if (active.current === id) setBusy(false); }
  }
  return <Screen title="Gyms near you." subtitle="Find somewhere to train, wherever you are.">
    <Card>
      <H>Find your local gym</H>
      <P>Your location or entered area is sent through our service to Google Maps for this search. It is not saved to your profile or backup. Listings depend on local coverage; confirm details before visiting.</P>
      <Check label="Allow my search location or area to be sent to Google Maps" value={consent} onChange={setConsent}/>
      <Chips selected={radius} onChange={setRadius} values={[1000,5000,10000,25000].map(value => ({value, label: `${value/1000} km`}))}/>
      <Button title={busy ? 'Searching…' : 'Use my current location'} disabled={busy || !consent} onPress={() => void search(true)}/>
      <Field label="Area, city and country" value={area} onChange={setArea} placeholder="North Nazimabad, Karachi, Pakistan"/>
      <Button secondary title="Search this area" disabled={busy || !consent || area.trim().length<3} onPress={() => void search(false)}/>
      <Button secondary title="Search Google Maps" onPress={() => void act(() => Linking.openURL(mapsSearchURL(area)))}/>
      <P>Google Maps opens externally and uses its own location permissions. Area searches use provider relevance; location searches show nearest results by straight-line distance.</P>
      {error ? <Text accessibilityRole="alert" style={{color:'#9B342C',marginTop:12}}>{error}</Text> : null}
    </Card>
    {result ? <Card>
      <H>{result.gyms.length} gyms found</H>
      <Text style={{fontSize:14,color:'#5E5E5E',fontWeight:'400',marginBottom:12}}>Google Maps</Text>
      {!result.gyms.length ? <P>No listed gyms found. Try a wider radius, another area or Google Maps.</P> : null}
      {result.gyms.map(gym => <Card key={gym.id}>
        <H>{gym.name}</H><P>{gym.address}</P>
        {gym.distanceKm !== undefined ? <P>{gym.distanceKm.toFixed(1)} km away · straight-line distance</P> : null}
        <Button title={`Directions to ${gym.name}`} onPress={() => void act(() => Linking.openURL(directionsURL(gym)))}/>
        <Button secondary title="View details on Google Maps" onPress={() => void act(() => Linking.openURL(gym.mapsURL))}/>
        {gym.attributions.map((a,i) => <Text key={i} onPress={a.url ? () => void act(() => Linking.openURL(a.url!)) : undefined}>{a.name}</Text>)}
      </Card>)}
    </Card> : null}
  </Screen>;
}

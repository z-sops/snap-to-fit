import React, { useRef, useState, useEffect } from 'react';
import { Linking, Text } from 'react-native';
import { gymLocation } from '../services/gym-location';
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
  const [note, setNote] = useState('');
  const active = useRef(0);
  useEffect(() => () => { active.current++; }, []);
  async function search(useLocation: boolean) {
    const id = ++active.current;
    setBusy(true); setError(''); setNote(''); setResult(null);
    try {
      if (!process.env.EXPO_PUBLIC_API_URL) {
        await Linking.openURL(mapsSearchURL(useLocation ? '' : area));
        if (active.current === id) setNote('Search opened in Google Maps. Nearby results use Google Maps location permissions.');
        return;
      }
      let body: GymSearch = { area };
      if (useLocation) {
        const location = await gymLocation();
        if (active.current !== id) return;
        if (location.recent) setNote('Using a recent approximate location from the last two minutes. Distances are estimates.');
        body = { center: location.center, radius };
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
      <P>{process.env.EXPO_PUBLIC_API_URL
        ? 'Your search location or area goes through our service to Google Maps. It is not saved to your profile or backup.'
        : 'Searches open Google Maps, which shows nearby gyms and asks for its own location permission. In-app listings are not enabled in this build.'} Confirm gym details before visiting.</P>
      <Check label="Allow my search location or area to be sent to Google Maps" value={consent} onChange={setConsent}/>
      {process.env.EXPO_PUBLIC_API_URL ? <Chips selected={radius} onChange={setRadius} values={[1000,5000,10000,25000].map(value => ({value, label: `${value/1000} km`}))}/> : null}
      <Button title={busy ? 'Searching…' : 'Use my current location'} disabled={busy || !consent} onPress={() => void search(true)}/>
      <Field label="Area, city or ZIP code" value={area} onChange={setArea} placeholder="Austin, TX or 78701"/>
      <Button secondary title="Search this area" disabled={busy || !consent || area.trim().length<3} onPress={() => void search(false)}/>
      <Button secondary title="Search Google Maps" onPress={() => void act(() => Linking.openURL(mapsSearchURL(area)))}/>
      {process.env.EXPO_PUBLIC_API_URL ? <P>Location searches list the nearest gyms by straight-line distance; area searches use Google relevance order.</P> : null}
      {error ? <Text accessibilityRole="alert" style={{color:'#9B342C',marginTop:12}}>{error}</Text> : null}
      {note ? <P>{note}</P> : null}
    </Card>
    {result ? <Card>
      <H>{result.gyms.length} gyms found</H>
      <Text style={{fontSize:14,color:'#5E5E5E',fontWeight:'400',marginBottom:12}}>Google Maps</Text>
      {!result.gyms.length ? <P>No listed gyms found. Try a wider radius, another area or Google Maps.</P> : null}
      {result.gyms.map(gym => <Card key={gym.id}>
        <H>{gym.name}</H><Text numberOfLines={2} style={{fontSize:14,lineHeight:20,color:'#5D6880',marginBottom:8}}>{gym.address}</Text>
        {gym.distanceKm !== undefined ? <P>{gym.distanceKm.toFixed(1)} km away (straight line)</P> : null}
        <Button title={`Directions to ${gym.name}`} onPress={() => void act(() => Linking.openURL(directionsURL(gym)))}/>
        <Button secondary title="View details on Google Maps" onPress={() => void act(() => Linking.openURL(gym.mapsURL))}/>
        {gym.attributions.map((a,i) => <Text key={i} onPress={a.url ? () => void act(() => Linking.openURL(a.url!)) : undefined}>{a.name}</Text>)}
      </Card>)}
    </Card> : null}
  </Screen>;
}

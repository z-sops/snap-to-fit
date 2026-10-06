import React from 'react';
import { Screen, Card, H, P, Button, act } from '../components/ui';
import { musicServices } from '../core/music';
import { useMusic } from '../services/music';
import { MusicControls } from '../components/MusicControls';
export default function Music() {
  const music = useMusic();
  return <Screen title="Your workout soundtrack." subtitle="Bring your own music to your next session.">
    <Card><H>Your music services</H><P>Open your preferred service to choose a playlist. Playback and login are handled by that service’s app or website. Its subscription and regional availability apply.</P>
      {musicServices.map(service => <Button key={service.name} secondary title={`Open ${service.name}`} onPress={() => void act(() => music.openService(service.url))}/>)}
      <P>Return to Snap to Fit for your workout. These shortcuts do not link your account or provide streaming controls inside Snap to Fit.</P>
    </Card>
    <Card><H>Music from your phone</H><P>Choose an audio file from your device or Files app. It stays on your device and is not uploaded. The selected track is available for this session; choose it again after restarting. Protected streaming downloads cannot be imported.</P>
      <Button title="Choose my audio file" onPress={() => void act(music.choose)}/>
      <P>Supported formats depend on your device. Native playback is configured for background and lock-screen controls; browser playback depends on browser support.</P>
    </Card>
    <MusicControls/>
  </Screen>;
}

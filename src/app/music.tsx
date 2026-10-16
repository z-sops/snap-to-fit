import React, { useState } from 'react';
import { Screen, Card, H, P, Button, act } from '../components/ui';
import { musicServices } from '../core/music';
import { useMusic } from '../services/music';
import { MusicControls } from '../components/MusicControls';
import { DeviceAudioPicker } from '../components/DeviceAudioPicker';
import { deviceAudioSupported } from '../services/device-audio';
export default function Music() {
  const music = useMusic();
  const [picker, setPicker] = useState(false);
  return <Screen title="Your workout soundtrack." subtitle="Bring your own music to your next session.">
    <Card><H>Your music services</H><P>Open your preferred service to choose a playlist. Playback and login are handled by that service’s app or website. Its subscription and regional availability apply.</P>
      {musicServices.map(service => <Button key={service.name} secondary title={`Open ${service.name}`} onPress={() => void act(() => music.openService(service.url))}/>)}
      <P>Return to Snap to Fit for your workout. These shortcuts do not link your account or provide streaming controls inside Snap to Fit.</P>
    </Card>
    <Card><H>Music from your phone</H>
      {deviceAudioSupported ? <>
        <P>Pick a song saved on this phone. The list opens inside Snap to Fit, with a Back button. Songs stay on your phone and are not uploaded. The first time, Android asks for the “Music and audio” permission.</P>
        <Button title="Choose a song from my phone" onPress={() => setPicker(true)}/>
        <Button secondary title="Browse Files instead" onPress={() => void act(music.choose)}/>
        <P>Browse Files opens your phone file picker on top of the app. To come back without choosing, swipe in from the right edge of the screen.</P>
      </> : <>
        <P>Choose an audio file from your device or Files app. It stays on your device and is not uploaded. Protected streaming downloads cannot be imported.</P>
        <Button title="Choose my audio file" onPress={() => void act(music.choose)}/>
      </>}
      <P>The selected track is available for this session; choose it again after restarting. Supported formats depend on your device.</P>
    </Card>
    <DeviceAudioPicker open={picker} onClose={() => setPicker(false)}
      onPick={t => void act(() => music.chooseDevice(t))} onBrowseFiles={() => void act(music.choose)}/>
    <MusicControls/>
  </Screen>;
}

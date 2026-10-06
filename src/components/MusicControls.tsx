import React from 'react';
import { Card, H, P, Button, Row, Check, act } from './ui';
import { useMusic } from '../services/music';
import { musicTime } from '../core/music';
export function MusicControls() {
  const music = useMusic();
  if (!music.track) return null;
  return <Card>
    <H>{music.track.name}</H>
    <P>{musicTime(music.status.currentTime)} / {musicTime(music.status.duration)}</P>
    {music.status.error ? <P>This file could not be played. Try another supported audio file.</P> : null}
    <Button title={music.status.playing ? 'Pause my music' : 'Play my music'} disabled={!music.status.isLoaded || !!music.status.error} onPress={() => void act(music.toggle)}/>
    <Row><Button secondary title="Back 15 seconds" disabled={!music.status.isLoaded} onPress={() => void act(() => music.seek(-15))}/><Button secondary title="Forward 15 seconds" disabled={!music.status.isLoaded} onPress={() => void act(() => music.seek(15))}/></Row>
    <Check label="Repeat this track" value={music.repeat} onChange={music.setRepeat}/>
    <Button secondary title="Stop and clear selected track" onPress={music.clear}/>
  </Card>;
}

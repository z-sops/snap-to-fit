import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateLocalTrack, musicTime, musicServices } from '../src/core/music.ts';
test('local music rejects non-audio and excessive files', () => {
 for (const track of [{name:'a.txt',uri:'file:a',mimeType:'text/plain'}, {name:'a.mp3',uri:'file:a',size:51*1024*1024}, {name:'a.mp3',uri:'',size:100}, {name:'a.mp3',uri:'file:a',size:NaN}]) assert.throws(() => validateLocalTrack(track));
 assert.equal(validateLocalTrack({name:'a.mp3',uri:'file:a',size:100}).name,'a.mp3');
});
test('music clocks handle unloaded durations and connector URLs use HTTPS', () => {
 assert.equal(musicTime(NaN),'0:00'); assert.equal(musicTime(125.9),'2:05');
 assert.ok(musicServices.every(s => s.url.startsWith('https://')));
});

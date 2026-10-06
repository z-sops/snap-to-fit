import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findGyms, validateGymSearch } from '../server/gyms.ts';
import { distanceKm, directionsURL, mapsSearchURL } from '../src/core/gyms.ts';
test('gym input rejects invalid coordinates, strings, radii and mixed searches', () => {
  for (const body of [null, {center:{latitude:91,longitude:0},radius:5000}, {center:{latitude:'0',longitude:0},radius:5000}, {center:{latitude:0,longitude:0},radius:500000}, {area:'ab'}, {area:'Karachi',center:{latitude:0,longitude:0}}]) assert.throws(() => validateGymSearch(body));
  assert.deepEqual(validateGymSearch({area:' Karachi, Pakistan '}), {area:'Karachi, Pakistan'});
});
test('unconfigured gym provider never fabricates listings', async () => {
  await assert.rejects(findGyms({area:'Karachi, Pakistan'}, ''), /not configured/);
});
test('nearby results use distance ranking, filter closed/outside gyms and deduplicate', async () => {
  let payload: Record<string,unknown> = {};
  const mock = (async (url: unknown, opts: RequestInit) => {
    assert.match(String(url), /searchNearby$/);
    payload = JSON.parse(String(opts.body));
    const place = (id:string,latitude:number,status='OPERATIONAL') => ({id,displayName:{text:id},location:{latitude,longitude:0},businessStatus:status});
    return Response.json({places:[place('far',0.02),place('near',0.001),place('near',0.001),place('closed',0.002,'CLOSED_PERMANENTLY'),place('outside',1)]});
  }) as typeof fetch;
  const result = await findGyms({center:{latitude:0,longitude:0},radius:5000},'test-key',mock);
  assert.equal(payload.rankPreference, 'DISTANCE');
  assert.deepEqual(payload.includedTypes, ['gym']);
  assert.deepEqual(result.gyms.map(g => g.id), ['near','far']);
  assert.ok(result.gyms[0].distanceKm! < result.gyms[1].distanceKm!);
  assert.match(directionsURL(result.gyms[0]), /destination_place_id=near/);
});
test('manual area search is gym-filtered and does not invent distance', async () => {
  const mock = (async (_:unknown,opts:RequestInit) => {
    const body = JSON.parse(String(opts.body));
    assert.equal(body.textQuery, 'gyms in Lahore, Pakistan');
    assert.equal(body.strictTypeFiltering,true);
    return Response.json({places:[{id:'a',displayName:{text:'Local gym'},location:{latitude:31,longitude:74}}]});
  }) as typeof fetch;
  const result = await findGyms({area:'Lahore, Pakistan'},'key',mock);
  assert.equal(result.mode,'area'); assert.equal(result.gyms[0].distanceKm,undefined);
});
test('provider failure returns a useful error without exposing its key or response', async () => {
  await assert.rejects(findGyms({area:'London, UK'},'secret', (async () => new Response('secret provider message',{status:403})) as typeof fetch), /unavailable/);
});
test('distance handles date line and maps query safely encodes entered areas', () => {
  assert.ok(distanceKm({latitude:0,longitude:179.99},{latitude:0,longitude:-179.99})<3);
  assert.match(mapsSearchURL('Karachi & Lahore'), /%26/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { pcmWav, readSound } from '../src/sound.js';
import { createMediaAdapter } from '../bridge/media.js';

const ffmpeg = process.env.MBLOCK_FFMPEG || ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg'].find(p => existsSync(p)) || 'ffmpeg';
test('sound decoder preserves duration, converts MP3 and rejects documents, corruption and long audio', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mblock-sound-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const wav = path.join(dir, 'tone.wav'), mp3 = path.join(dir, 'tone.mp3');
  const pcm = Buffer.alloc(44100 * 4 / 4);
  for (let i = 0; i < pcm.length; i += 2) pcm.writeInt16LE(Math.round(2000 * Math.sin(i / 4 / 44100 * 440 * Math.PI * 2)), i);
  await writeFile(wav, pcmWav(pcm));
  const result = await readSound(wav);
  assert.equal(result.duration, 0.25); assert.equal(result.channels, 2);
  assert.equal(Buffer.from(result.base64, 'base64').toString('ascii', 8, 12), 'WAVE');
  execFileSync(ffmpeg, ['-v', 'error', '-i', wav, mp3]);
  const decoded = await readSound(mp3);
  assert.equal(decoded.sourceFormat, 'mp3'); assert.ok(decoded.duration >= 0.25 && decoded.duration < 0.4);
  await assert.rejects(readSound('relative.wav'), /SOUND_PATH_REQUIRED/);
  await assert.rejects(readSound(dir), /SOUND_FILE_REQUIRED/);
  await writeFile(wav, 'https://example.com/audio');
  await assert.rejects(readSound(wav), /UNSUPPORTED_SOUND/);
  await writeFile(wav, 'RIFFxxxxWAVEbroken');
  await assert.rejects(readSound(wav), /INVALID_SOUND/);
  const long = path.join(dir, 'long.mp3');
  execFileSync(ffmpeg, ['-v', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=8000:cl=mono', '-t', '121', '-b:a', '8k', long]);
  await assert.rejects(readSound(long), /SOUND_DURATION_LIMIT/);
});

function fixture() {
  const make = (id: string) => {
    const sounds: any[] = [{ name: 'first', soundId: id, asset: { data: new Uint8Array([1]) } }];
    const costumes: any[] = [{ name: 'a', assetId: 'a', dataFormat: 'png', asset: { data: new Uint8Array([1]) }, skinId: 1 },
      { name: 'b', assetId: 'b', dataFormat: 'png', asset: { data: new Uint8Array([2]) }, skinId: 2 }];
    const players: any = { [id]: { buffer: { length: 44100, duration: 1 }, isPlaying: false } };
    const target: any = { id, isOriginal: true, name: id, currentCostume: 0,
      getName: () => target.name, getSounds: () => sounds, getCostumes: () => costumes,
      renameSound: (i: number, name: string) => { sounds[i].name = name; },
      deleteSound: (i: number) => sounds.splice(i, 1), deleteCostume: (i: number) => costumes.splice(i, 1),
      setCostume: (i: number) => { target.currentCostume = i; },
      reorderCostume: (from: number, to: number) => {
        const current = costumes[target.currentCostume]; costumes.splice(to, 0, ...costumes.splice(from, 1));
        target.currentCostume = costumes.indexOf(current);
      },
      reorderSound: (from: number, to: number) => sounds.splice(to, 0, ...sounds.splice(from, 1)),
      sprite: { soundBank: { getSoundPlayer: (id: string) => players[id], stop() {},
        playSound: (_t: any, id: string) => { players[id].isPlaying = true; return new Promise(() => {}); },
        stopAllSounds: () => { Object.values(players).forEach((p: any) => { p.isPlaying = false; }); } } } };
    return { target, sounds, costumes, players };
  };
  const a = make('a'), b = make('b');
  const vm: any = { runtime: { targets: [a.target, b.target], audioEngine: { audioContext: { state: 'running' } }, emitProjectChanged() {} },
    editingTarget: b.target, emitTargetsUpdate() {}, emitWorkspaceUpdate() {},
    addCostume: async (_md5: string, c: any, id: string) => { assert.equal(id, 'a'); a.costumes.push(c); c.skinId = 3; a.target.currentCostume = 2; },
    addSound: async (s: any, id: string) => {
      assert.equal(id, 'a'); s.soundId = 'new'; a.players.new = { buffer: { length: 44100, duration: 1 }, isPlaying: false }; a.sounds.push(s);
    } };
  return { a, b, vm, media: createMediaAdapter(vm) };
}

test('copies address the requested target, preserve costume selection and reject stale or duplicate names', async () => {
  const f = fixture();
  await f.media.duplicateCostume(f.a.target, { index: 0, expectedName: 'a', name: 'copy', select: false });
  assert.equal(f.a.target.currentCostume, 0); assert.equal(f.b.costumes.length, 2);
  await f.media.duplicateSound(f.a.target, { index: 0, expectedName: 'first', name: 'copy' });
  assert.equal(f.a.sounds.length, 2); assert.equal(f.b.sounds.length, 1);
  await assert.rejects(f.media.duplicateSound(f.a.target, { index: 0, expectedName: 'first', name: 'copy' }), /ASSET_NAME_EXISTS/);
  assert.throws(() => f.media.reorderCostume(f.a.target, { index: 0, expectedName: 'wrong', toIndex: 1 }), /ASSET_CHANGED/);
  f.media.reorderCostume(f.a.target, { index: 0, expectedName: 'a', toIndex: 2 });
  assert.equal(f.a.target.currentCostume, 2); assert.equal(f.a.costumes[2].name, 'a');
  f.media.reorderSound(f.a.target, { index: 0, expectedName: 'first', toIndex: 1 });
  assert.equal(f.a.sounds[1].name, 'first');
  assert.throws(() => f.media.reorderSound(f.a.target, { index: 0, expectedName: 'copy', toIndex: 9 }), /INVALID_DESTINATION/);
});

test('playback returns without waiting for completion; stop affects only the requested target', async () => {
  const f = fixture();
  f.b.players.b.isPlaying = true;
  const started = await f.media.playSound(f.a.target, { index: 0, expectedName: 'first' });
  assert.equal(started.started, true); assert.equal(f.a.players.a.isPlaying, true);
  f.media.stopSounds(f.a.target);
  assert.equal(f.a.players.a.isPlaying, false); assert.equal(f.b.players.b.isPlaying, true);
  f.vm.runtime.audioEngine.audioContext.state = 'closed';
  await assert.rejects(f.media.playSound(f.a.target, { index: 0, expectedName: 'first' }), /AUDIO_NOT_RUNNING/);
});

test('broken duplicate sound is rolled back and device mutations are rejected', async () => {
  const f = fixture();
  f.vm.addSound = async (s: any) => { f.a.sounds.push(s); s.broken = {}; };
  await assert.rejects(f.media.duplicateSound(f.a.target, { index: 0, expectedName: 'first', name: 'bad' }), /SOUND_IMPORT_NOT_CONFIRMED/);
  assert.equal(f.a.sounds.length, 1);
  f.a.target.deviceId = 'cyberpi';
  assert.throws(() => f.media.deleteSound(f.a.target, { index: 0, expectedName: 'first' }), /DEVICE_NOT_SUPPORTED/);
});

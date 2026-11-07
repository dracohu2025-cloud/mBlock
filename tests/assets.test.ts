import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import sharp from 'sharp';
import { spriteArchive } from '../src/sprite.js';
import { createAssetAdapter } from '../bridge/assets.js';

function fixture() {
  const make = (id: string, isStage = false) => {
    const costumes = [{ name: 'first' }, { name: 'second' }];
    const t: any = { id, isStage, isOriginal: true, currentCostume: 0, name: id, blocks: {},
      getName: () => t.name, getCostumes: () => costumes,
      renameCostume: (i: number, n: string) => { costumes[i].name = n; },
      deleteCostume: (i: number) => costumes.splice(i, 1) };
    return t;
  };
  const panda = make('panda'), stage = make('stage', true), device = make('device'); device.deviceId = 'cyberpi';
  const vm: any = { runtime: { targets: [stage, panda, device], emitProjectChanged() {} }, editingTarget: panda,
    emitTargetsUpdate() {}, emitWorkspaceUpdate() {}, setEditingTarget(id: string) { vm.editingTarget = vm.runtime.targets.find((t: any) => t.id === id); },
    renameSprite(id: string, n: string) { vm.runtime.targets.find((t: any) => t.id === id).name = n; },
    deleteSprite(id: string) { vm.runtime.targets = vm.runtime.targets.filter((t: any) => t.id !== id); },
    addSprite: async () => {} };
  return { vm, panda, stage, device, make, a: createAssetAdapter(vm) };
}

test('sprite archive contains actual pixels and standalone sprite metadata', async () => {
  const png = await sharp({ create: { width: 8, height: 4, channels: 4, background: '#ff800080' } }).png().toBuffer();
  const zip = await JSZip.loadAsync(await spriteArchive(png.toString('base64'), {
    name: 'Carrot', x: 120, y: -20, size: 75, bitmapResolution: 2, width: 8, height: 4 }), { base64: true });
  const sprite = JSON.parse(await zip.file('sprite.json')!.async('string'));
  assert.equal(sprite.name, 'Carrot'); assert.equal(sprite.x, 120); assert.deepEqual(sprite.blocks, {});
  assert.equal(sprite.costumes[0].rotationCenterY, 2);
  assert.deepEqual(await zip.file(sprite.costumes[0].md5ext)!.async('nodebuffer'), png);
});

test('asset mutation rejects stale indexes, duplicate names, stage/device deletion and last backdrop', () => {
  const f = fixture();
  assert.throws(() => f.a.deleteSprite(f.stage, { expectedName: 'stage' }), /SPRITE_REQUIRED/);
  assert.throws(() => f.a.deleteSprite(f.device, { expectedName: 'device' }), /SPRITE_REQUIRED/);
  assert.throws(() => f.a.deleteSprite(f.panda, { expectedName: 'other' }), /ASSET_CHANGED/);
  assert.throws(() => f.a.renameSprite(f.panda, { name: 'stage' }), /ASSET_NAME_EXISTS/);
  assert.throws(() => f.a.renameSprite(f.panda, { name: '_mouse_' }), /RESERVED/);
  assert.throws(() => f.a.deleteCostume(f.panda, { index: 1, expectedName: 'old' }), /ASSET_CHANGED/);
  assert.throws(() => f.a.renameCostume(f.panda, { index: 0, expectedName: 'first', name: 'second' }), /ASSET_NAME_EXISTS/);
  f.a.renameCostume(f.stage, { index: 1, expectedName: 'second', name: 'Sky' });
  f.a.deleteCostume(f.stage, { index: 1, expectedName: 'Sky' });
  assert.throws(() => f.a.deleteCostume(f.stage, { index: 0, expectedName: 'first' }), /LAST_COSTUME/);
  f.a.renameSprite(f.panda, { name: 'Panda' });
  assert.equal(f.panda.name, 'Panda');
  f.a.deleteSprite(f.panda, { expectedName: 'Panda' });
  assert.deepEqual(f.vm.runtime.targets.map((t: any) => t.id), ['stage', 'device']);
});

test('failed sprite import rolls back only the owned sprite and preserves existing and concurrent targets', async () => {
  const f = fixture();
  f.vm.addSprite = async () => {
    const bad = f.make('new'); bad.name = 'Carrot';
    f.vm.runtime.targets.push(bad, f.make('concurrent'));
    f.vm.editingTarget = bad;
  };
  await assert.rejects(f.a.createSprite({ name: 'Carrot', base64: 'UEs=' }), /IMAGE_IMPORT_NOT_CONFIRMED/);
  assert.deepEqual(f.vm.runtime.targets.map((t: any) => t.id), ['stage', 'panda', 'device', 'concurrent']);
  assert.equal(f.vm.editingTarget, f.panda);
  await assert.rejects(f.a.createSprite({ name: 'panda', base64: 'UEs=' }), /ASSET_NAME_EXISTS/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, open, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { readImage } from '../src/image.js';
import { createImageAdapter } from '../bridge/images.js';

test('image input decodes raster formats, preserves alpha and normalizes orientation', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mblock-image-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const png = path.join(dir, 'alpha.png');
  await sharp({ create: { width: 8, height: 4, channels: 4, background: '#ff000080' } }).png().toFile(png);
  const result = await readImage(png);
  assert.equal(result.width, 8); assert.equal(result.height, 4);
  const { data, info } = await sharp(Buffer.from(result.base64, 'base64')).raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.channels, 4); assert.equal(data[3], 128);
  const jpeg = path.join(dir, 'rotated.jpg');
  await sharp({ create: { width: 8, height: 4, channels: 3, background: 'red' } })
    .withMetadata({ orientation: 6 }).jpeg().toFile(jpeg);
  const rotated = await readImage(jpeg);
  assert.equal(rotated.width, 4); assert.equal(rotated.height, 8);
  assert.equal((await sharp(Buffer.from(rotated.base64, 'base64')).metadata()).exif, undefined);
  const webp = path.join(dir, 'sample.webp');
  await sharp(png).webp().toFile(webp);
  assert.equal((await readImage(webp)).sourceFormat, 'webp');
});

test('image input rejects documents, corruption, oversize files and dimensions', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mblock-image-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await assert.rejects(readImage('relative.png'), /IMAGE_PATH_REQUIRED/);
  await assert.rejects(readImage(dir), /IMAGE_FILE_REQUIRED/);
  const file = path.join(dir, 'fake.png');
  await writeFile(file, '<svg xmlns="http://www.w3.org/2000/svg"/>');
  await assert.rejects(readImage(file), /UNSUPPORTED_IMAGE/);
  await writeFile(file, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]));
  await assert.rejects(readImage(file), /INVALID_IMAGE/);
  const handle = await open(file, 'w');
  await handle.truncate(10 * 1024 * 1024 + 1); await handle.close();
  await assert.rejects(readImage(file), /IMAGE_TOO_LARGE/);
  await sharp({ create: { width: 4097, height: 1, channels: 3, background: 'blue' } }).png().toFile(file);
  await assert.rejects(readImage(file), /IMAGE_DIMENSIONS/);
  const png = await sharp({ create: { width: 8, height: 4, channels: 4, background: 'blue' } }).png().toBuffer();
  // A PNG animation-control chunk must be rejected before a decoder can flatten it.
  const animationControl = Buffer.alloc(20);
  animationControl.writeUInt32BE(8); animationControl.write('acTL', 4); animationControl.writeUInt32BE(2, 8);
  await writeFile(file, Buffer.concat([png.subarray(0, 33), animationControl, png.subarray(33)]));
  await assert.rejects(readImage(file), /ANIMATED_IMAGE_NOT_SUPPORTED/);
  const frames = Buffer.concat([Buffer.alloc(8 * 4 * 4, 255), Buffer.alloc(8 * 4 * 4, 0)]);
  await sharp(frames, { raw: { width: 8, height: 8, channels: 4, pageHeight: 4 } }).webp().toFile(file);
  assert.equal((await sharp(await readFile(file)).metadata()).pages, 2);
  await assert.rejects(readImage(file), /ANIMATED_IMAGE_NOT_SUPPORTED/);
});

function fixture(broken = false) {
  const costumes = [{ name: 'original', assetId: 'old', dataFormat: 'svg' }];
  const target = { id: 'sprite', isStage: false, currentCostume: 0,
    getCostumes: () => costumes, setCostume: (index: number) => { target.currentCostume = index; },
    deleteCostume: (index: number) => { costumes.splice(index, 1); } };
  const calls: string[] = [];
  const load = async (costume: any) => {
    costume.skinId = 1; costume.size = [16, 8];
    if (broken) costume.broken = { assetId: costume.assetId };
    costumes.push(costume); target.currentCostume = costumes.length - 1;
  };
  const vm = { runtime: { targets: [target], renderer: {}, emitProjectChanged() {},
    storage: { AssetType: { ImageBitmap: 'bitmap' }, DataFormat: { PNG: 'png' },
      createAsset: (_type: unknown, _format: unknown, data: Uint8Array) => ({ assetId: 'new', data }) } },
    emitTargetsUpdate() {},
    addCostume: async (_md5: string, costume: any, id: string) => { calls.push(id); await load(costume); },
    addBackdrop: async (_md5: string, costume: any) => { calls.push('stage'); await load(costume); } };
  const params = { name: 'image', bitmapResolution: 1, select: false,
    base64: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString('base64') };
  return { target, calls, costumes, params, adapter: createImageAdapter(vm) };
}

test('image adapter imports into explicit targets and preserves selection when requested', async () => {
  const f = fixture();
  const added = await f.adapter.importImage(f.target, f.params);
  assert.equal(added.costume.index, 1); assert.equal(f.target.currentCostume, 0);
  assert.deepEqual(f.calls, ['sprite']);
  assert.equal(f.adapter.select(f.target, 1).currentCostume, 1);
  assert.throws(() => f.adapter.select(f.target, 4), /COSTUME_NOT_FOUND/);
  assert.equal(f.adapter.list(f.target, { offset: 1, limit: 1 }).costumes.length, 1);
  f.target.isStage = true;
  await f.adapter.importImage(f.target, { ...f.params, select: true });
  assert.deepEqual(f.calls, ['sprite', 'stage']); assert.equal(f.target.currentCostume, 2);
});

test('image adapter rejects VM fallback images and rolls back only the new costume', async () => {
  const f = fixture(true);
  await assert.rejects(f.adapter.importImage(f.target, f.params), /IMAGE_IMPORT_NOT_CONFIRMED/);
  assert.equal(f.costumes.length, 1); assert.equal(f.costumes[0].name, 'original');
  assert.equal(f.target.currentCostume, 0);
  await assert.rejects(f.adapter.importImage(f.target, { ...f.params, base64: 'dGV4dA==' }), /PNG_REQUIRED/);
});

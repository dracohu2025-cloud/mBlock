import { open } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const MAX_INPUT_BYTES = 10 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 20 * 1024 * 1024;
const MAX_PIXELS = 4096 * 4096;

export async function readImage(filename: string) {
  if (!path.isAbsolute(filename)) throw new Error('IMAGE_PATH_REQUIRED: 需要本地图片的绝对路径');
  const handle = await open(filename, 'r');
  let bytes: Buffer;
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) throw new Error('IMAGE_FILE_REQUIRED');
    if (stat.size > MAX_INPUT_BYTES) throw new Error('IMAGE_TOO_LARGE: 输入上限为 10 MiB');
    const buffer = Buffer.alloc(MAX_INPUT_BYTES + 1);
    let length = 0;
    while (length < buffer.length) {
      const read = await handle.read(buffer, length, buffer.length - length, null);
      if (!read.bytesRead) break;
      length += read.bytesRead;
    }
    if (length > MAX_INPUT_BYTES) throw new Error('IMAGE_TOO_LARGE: 输入上限为 10 MiB');
    bytes = buffer.subarray(0, length);
  } finally { await handle.close(); }
  // Check signatures before decoding: do not pass SVG or other document formats to the decoder.
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const webp = bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!png && !jpeg && !webp) throw new Error('UNSUPPORTED_IMAGE: 仅支持 PNG、JPEG、WebP 静态图片');
  // libvips can decode APNG as a static first frame, so reject its animation chunk explicitly.
  if (png) {
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const length = bytes.readUInt32BE(offset);
      if (bytes.toString('ascii', offset + 4, offset + 8) === 'acTL') throw new Error('ANIMATED_IMAGE_NOT_SUPPORTED');
      offset += length + 12;
    }
  }
  try {
    const input = sharp(bytes, { limitInputPixels: MAX_PIXELS, failOn: 'warning' });
    const metadata = await input.metadata();
    if ((metadata.pages ?? 1) > 1) throw new Error('ANIMATED_IMAGE_NOT_SUPPORTED');
    if (!metadata.width || !metadata.height || metadata.width > 4096 || metadata.height > 4096) {
      throw new Error('IMAGE_DIMENSIONS: 单边上限为 4096 像素');
    }
    // Normalize orientation and strip metadata; preserve alpha in a single PNG representation.
    const { data, info } = await input.autoOrient().png().toBuffer({ resolveWithObject: true });
    if (data.length > MAX_OUTPUT_BYTES) throw new Error('NORMALIZED_IMAGE_TOO_LARGE: PNG 上限为 20 MiB');
    return { base64: data.toString('base64'), width: info.width, height: info.height,
      bytes: data.length, sourceFormat: metadata.format };
  } catch (error) {
    throw new Error(`INVALID_IMAGE: ${error instanceof Error ? error.message : String(error)}`);
  }
}

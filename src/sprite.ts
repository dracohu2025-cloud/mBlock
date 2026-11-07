import JSZip from 'jszip';
import { createHash } from 'node:crypto';

export async function spriteArchive(imageBase64: string, p: {
  name: string; x: number; y: number; size: number; bitmapResolution: number; width: number; height: number;
}) {
  const bytes = Buffer.from(imageBase64, 'base64');
  const assetId = createHash('md5').update(bytes).digest('hex');
  const zip = new JSZip();
  zip.file(`${assetId}.png`, bytes);
  zip.file('sprite.json', JSON.stringify({ name: p.name, isStage: false, variables: {}, lists: {}, broadcasts: {},
    blocks: {}, comments: {}, currentCostume: 0, costumes: [{ name: p.name, assetId,
      md5ext: `${assetId}.png`, dataFormat: 'png', bitmapResolution: p.bitmapResolution,
      rotationCenterX: p.width / 2, rotationCenterY: p.height / 2 }], sounds: [], volume: 100,
    visible: true, x: p.x, y: p.y, size: p.size, direction: 90, draggable: false, rotationStyle: 'all around' }));
  return zip.generateAsync({ type: 'base64', compression: 'DEFLATE' });
}

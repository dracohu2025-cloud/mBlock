import JSZip from 'jszip';
import { open } from 'node:fs/promises';

export async function validateArchive(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const file = zip.file('project.json');
  if (!file) throw new Error('PROJECT_JSON_MISSING');
  const project = JSON.parse(await file.async('string'));
  if (!Array.isArray(project.targets)) throw new Error('INVALID_TARGETS');
  const missing = [];
  const assets = new Set<string>();
  for (const target of project.targets) {
    for (const asset of [...(target.costumes ?? []), ...(target.sounds ?? [])]) {
      const name = asset.md5ext ?? `${asset.assetId}.${asset.dataFormat}`;
      assets.add(name);
      if (!zip.file(name)) missing.push(name);
    }
  }
  if (missing.length) throw new Error(`MISSING_ASSETS: ${missing.join(', ')}`);
  return { targets: project.targets.length, assets: assets.size,
    mblockMetadata: Boolean(zip.file('mscratch.json') && zip.file('mblock5')) };
}

export async function saveExport(destination: string, data: unknown) {
  const reply = data as { base64?: string };
  if (typeof reply.base64 !== 'string') throw new Error('INVALID_EXPORT_RESPONSE');
  const buffer = Buffer.from(reply.base64, 'base64');
  const checked = await validateArchive(buffer);
  if (!checked.mblockMetadata) throw new Error('MBLOCK_METADATA_MISSING');
  const handle = await open(destination, 'wx', 0o600);
  try { await handle.writeFile(buffer); } finally { await handle.close(); }
  return { path: destination, bytes: buffer.length, ...checked };
}

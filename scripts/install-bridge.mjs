// Local, reversible installation into mBlock's extension registry.
// Run only after approval to install the bridge into the mBlock App.
import JSZip from 'jszip';
import { readFile, writeFile, mkdir, copyFile, rename, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

if (!process.argv.includes('--confirm')) throw new Error('安装前请确认权限；确认后使用 --confirm。');
const root = fileURLToPath(new URL('../', import.meta.url));
const extensionRoot = path.join(os.homedir(), 'mblock/exts');
const registry = path.join(extensionRoot, 'ext.json');
const original = await readFile(registry, 'utf8');
const entries = JSON.parse(original);
if (!Array.isArray(entries)) throw new Error('不支持当前 mBlock 扩展注册表格式。');
const archive = await JSZip.loadAsync(await readFile(path.join(root, 'artifacts/mblock-mcp-bridge.mext')));
const manifest = JSON.parse(await archive.file('manifest.json').async('string'));
if (manifest.id !== 'codex_mcp_bridge') throw new Error('不支持的扩展 ID');
const destination = path.join(extensionRoot, manifest.id);
const backup = path.join(root, '.local', `install-backup-${Date.now()}`);
await mkdir(backup, { recursive: true });
await copyFile(registry, path.join(backup, 'ext.json'));
await mkdir(destination, { recursive: true });
for (const name of ['index.js', 'manifest.json']) {
  const output = path.join(destination, name);
  try { await stat(output); await copyFile(output, path.join(backup, name)); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await writeFile(output, await archive.file(name).async('nodebuffer'), { mode: 0o600 });
}
const entry = { ...manifest, originVersion: manifest.version, updateStatus: 0, isDev: true,
  isOfficialDev: 0, extraInfo: { fromScratch3: false, isImport: true } };
const index = entries.findIndex(item => item.id === manifest.id);
if (index >= 0) entries[index] = entry; else entries.push(entry);
// Refuse to overwrite concurrent changes made by the App during installation.
if (await readFile(registry, 'utf8') !== original) throw new Error('扩展注册表已发生并发变化；已保留备份，请重新运行。');
const temp = path.join(extensionRoot, `ext.mcp-${process.pid}.tmp`);
await writeFile(temp, JSON.stringify(entries), { flag: 'wx', mode: 0o600 });
await rename(temp, registry);
console.log(`Installed ${manifest.id}. Backup: ${backup}. 在 App 的“本地角色扩展”中添加 MCP Bridge。`);

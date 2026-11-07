import { build } from 'esbuild';
import JSZip from 'jszip';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
await mkdir(path.join(root, '.local'), { recursive: true });
await mkdir(path.join(root, 'artifacts'), { recursive: true });
const configFile = path.join(root, '.local/bridge.json');
let config;
try { config = JSON.parse(await readFile(configFile, 'utf8')); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  config = { port: 17865, token: randomBytes(32).toString('hex') };
  await writeFile(configFile, JSON.stringify(config), { flag: 'wx', mode: 0o600 });
}
const built = await build({ entryPoints: [path.join(root, 'bridge/extension.js')], bundle: true,
  write: false, format: 'iife', globalName: 'McpBridge', target: 'chrome100',
  define: { __BRIDGE_URL__: JSON.stringify(`ws://127.0.0.1:${config.port}`), __BRIDGE_TOKEN__: JSON.stringify(config.token) } });
const wrapper = `(function(factory){if(typeof define==='function'&&define.amd)define(['exports'],factory);else if(typeof exports!=='undefined')factory(exports);else{var out={};factory(out);globalThis.unknown=out;}})(function(exports){\n${built.outputFiles[0].text}\nexports.default=McpBridge.default;\n});`;
const manifest = { id: 'codex_mcp_bridge', version: '0.3.0', name: { en: 'MCP Bridge', zh: 'MCP Bridge' },
  description: { en: 'Local authenticated MCP bridge for mBlock 5.6', zh: '本地 MCP 桥接：读取、添加积木、运行角色脚本和导出项目' },
  targets: ['sprites'], main: 'codex_mcp_bridge/index.js', codeTypes: [], device: false, sortId: 999,
  extApiVersion: ['1.0.0'], platform: ['mblockpc'], feature: [] };
const zip = new JSZip();
zip.file('manifest.json', JSON.stringify(manifest, null, 2));
zip.file('index.js', wrapper);
await writeFile(path.join(root, 'artifacts/mblock-mcp-bridge.mext'), await zip.generateAsync({ type: 'nodebuffer' }), { mode: 0o600 });
console.log('Built artifacts/mblock-mcp-bridge.mext (contains a local pairing token; do not publish).');

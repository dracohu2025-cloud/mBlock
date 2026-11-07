// Interactive stdio MCP client for reproducible local App verification.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const child = spawn(process.execPath, [fileURLToPath(new URL('../dist/server.js', import.meta.url))], { stdio: ['pipe', 'pipe', 'inherit'] });
const pending = new Map();
let sequence = 0;
const output = createInterface({ input: child.stdout });
output.on('line', line => {
  const message = JSON.parse(line);
  if (pending.has(message.id)) {
    const { resolve, timer } = pending.get(message.id);
    clearTimeout(timer); pending.delete(message.id); resolve(message);
  }
});
function rpc(method, params) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('MCP client timeout')); }, 35000);
    pending.set(id, { resolve, timer });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}
const initialized = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'mblock-probe', version: '0.1.0' } });
console.log(JSON.stringify(initialized));
child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
console.log('READY: Enter {"name":"mblock_status","arguments":{}} or "tools"; "quit" closes the server.');
const input = createInterface({ input: process.stdin });
for await (const line of input) {
  if (line === 'quit') break;
  try { console.log(JSON.stringify(await rpc(line === 'tools' ? 'tools/list' : 'tools/call', line === 'tools' ? {} : JSON.parse(line)))); }
  catch (error) { console.error(error.message); }
}
child.stdin.end();
child.kill();
input.close();
output.close();
process.stdin.pause();

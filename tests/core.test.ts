import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import JSZip from 'jszip';
import { BridgeHub } from '../src/hub.js';
import { scriptXml } from '../src/script.js';
import { validateArchive } from '../src/project.js';
import { createAdapter } from '../bridge/runtime.js';

const token = 'a'.repeat(64);
const origin = 'http://127.0.0.1:3003';

test('bridge rejects unauthorized peers and propagates App errors', async () => {
  const hub = new BridgeHub();
  await hub.start(0, token);
  try {
    const wrong = new WebSocket(`ws://127.0.0.1:${hub.port}`, { origin });
    await once(wrong, 'open');
    wrong.send(JSON.stringify({ kind: 'hello', token: 'wrong' }));
    const [code] = await once(wrong, 'close');
    assert.equal(code, 1008); assert.equal(hub.status().connected, false);
    await assert.rejects(hub.request('status'), /BRIDGE_OFFLINE/);
    const peer = new WebSocket(`ws://127.0.0.1:${hub.port}`, { origin });
    await once(peer, 'open');
    peer.send(JSON.stringify({ kind: 'hello', token, info: { adapter: 'fixture' } }));
    await once(peer, 'message');
    peer.on('message', raw => {
      const message = JSON.parse(String(raw));
      if (message.method === 'fail') peer.send(JSON.stringify({ id: message.id, ok: false, error: 'UNKNOWN_OPCODE' }));
      if (message.method === 'status') peer.send(JSON.stringify({ id: message.id, ok: true, data: { actual: 42 } }));
    });
    assert.deepEqual(await hub.request('status'), { actual: 42 });
    await assert.rejects(hub.request('fail'), /UNKNOWN_OPCODE/);
    await assert.rejects(hub.request('silent', {}, 25), /BRIDGE_TIMEOUT/);
    const pending = hub.request('disconnect');
    peer.close();
    await assert.rejects(pending, /BRIDGE_DISCONNECTED/);
  } finally { await hub.close(); }
});

test('bridge rejects remote browser origins before authentication', async () => {
  const hub = new BridgeHub(); await hub.start(0, token);
  try {
    const peer = new WebSocket(`ws://127.0.0.1:${hub.port}`, { origin: 'https://example.com' });
    const [error] = await once(peer, 'error');
    assert.match(error.message, /401/);
    assert.equal(hub.status().connected, false);
  } finally { await hub.close(); }
});

test('script compiler escapes user strings and preserves nested branches', () => {
  const xml = scriptXml([{ opcode: 'event_whenflagclicked' }, { opcode: 'control_repeat', inputs: { TIMES: 3 },
    substack: [{ opcode: 'looks_say', inputs: { MESSAGE: '<hello>&"' } }] }]);
  assert.match(xml, /<next><block type="control_repeat"/);
  assert.match(xml, /<statement name="SUBSTACK">/);
  assert.match(xml, /&lt;hello&gt;&amp;&quot;/);
  assert.throws(() => scriptXml(Array.from({ length: 501 }, () => ({ opcode: 'motion_movesteps' }))), /SCRIPT_TOO_COMPLEX/);
});

test('archive validation catches the upstream missing-asset defect', async () => {
  const zip = new JSZip();
  zip.file('project.json', JSON.stringify({ targets: [{ costumes: [{ md5ext: 'sprite.svg' }], sounds: [] }] }));
  await assert.rejects(validateArchive(await zip.generateAsync({ type: 'nodebuffer' })), /MISSING_ASSETS: sprite.svg/);
  zip.file('sprite.svg', '<svg/>'); zip.file('mscratch.json', '{}'); zip.file('mblock5', '{}');
  const result = await validateArchive(await zip.generateAsync({ type: 'nodebuffer' }));
  assert.equal(result.mblockMetadata, true);
});

test('adapter fails on incompatible App and does not claim missing variables were set', async () => {
  assert.throws(() => createAdapter({}), /UNSUPPORTED_APP/);
  const stage = { id: 'stage', getName: () => 'Stage', isStage: true, variables: {}, blocks: { _blocks: {} } };
  const robot = { ...stage, id: 'robot', getName: () => 'Robot', deviceId: 'mbot' };
  const dispatch = createAdapter({ _mCtx: { vmCtx: { vm: { runtime: { targets: [stage, robot] } } }, blocklyCtx: { blockly: { Xml: {} } } } });
  await assert.rejects(dispatch('setVariable', { target: 'stage', name: 'missing', value: 1 }), /VARIABLE_NOT_FOUND/);
  await assert.rejects(dispatch('setVariable', { target: 'robot', name: 'x', value: 1 }), /DEVICE_NOT_SUPPORTED/);
  await assert.rejects(dispatch('targetsMissing'), /UNKNOWN_METHOD/);
});

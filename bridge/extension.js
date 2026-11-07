import { createAdapter } from './runtime.js';

let socket;
let retry;
let stopped = true;
let status = '未连接';
let queue = Promise.resolve();

function connect(app) {
  if (socket || stopped) return;
  let dispatch;
  try { dispatch = createAdapter(app); }
  catch (error) { status = error.message; return; }
  socket = new WebSocket(__BRIDGE_URL__);
  const ws = socket;
  ws.onopen = () => ws.send(JSON.stringify({ kind: 'hello', token: __BRIDGE_TOKEN__, info: { adapter: 'mblock-5.6', bridgeVersion: '0.1.0' } }));
  ws.onmessage = event => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    if (message.kind === 'welcome') { status = '已连接'; return; }
    if (!message.id || !message.method) return;
    queue = queue.then(async () => {
      if (ws.readyState !== WebSocket.OPEN || stopped) return;
      let response;
      try { response = { id: message.id, ok: true, data: await dispatch(message.method, message.params) }; }
      catch (error) { response = { id: message.id, ok: false, error: String(error.message ?? error) }; }
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(response));
    }).catch(error => { status = String(error.message); });
  };
  ws.onerror = () => { status = '连接失败'; };
  ws.onclose = () => {
    socket = undefined; status = '未连接';
    if (!stopped) retry = setTimeout(() => connect(app), 1500);
  };
}

export default class McpBridgeExtension {
  constructor() {
    this.funcs = { status: { onRun: () => status } };
  }
  getInfo() {
    return {
      id: 'codex_mcp_bridge', targets: [{ name: 'sprites' }], version: '0.1.0',
      platform: ['mblockpc'], codeTypes: [], feature: [],
      categories: [{ name: 'MCP Bridge', colors: ['#3979C8', '#2A5DA0', '#204878'], blocks: [
        { opcode: 'status', blockType: 'string', text: 'MCP Bridge 状态', arguments: {}, handler: this.funcs.status },
      ] }],
      translationMap: { en: {}, zh: {} }, generators: {}, snippets: {},
    };
  }
  getHandler() {
    return {
      onLoad(app) { stopped = false; connect(app); },
      onUnload() { stopped = true; clearTimeout(retry); socket?.close(); },
    };
  }
}

import { randomUUID, timingSafeEqual } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';

type Pending = {
  resolve: (data: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class BridgeHub {
  private server?: WebSocketServer;
  private peer?: WebSocket;
  private pending = new Map<string, Pending>();
  private info: unknown = null;

  async start(port: number, token: string): Promise<void> {
    // Only the local mBlock renderer is allowed to establish the bridge.
    this.server = new WebSocketServer({
      host: '127.0.0.1', port, maxPayload: 64 * 1024 * 1024,
      verifyClient: ({ origin }: { origin: string }) => /^http:\/\/127\.0\.0\.1:\d+$/.test(origin ?? ''),
    });
    this.server.on('connection', socket => {
      let authenticated = false;
      const deadline = setTimeout(() => socket.close(1008, 'Authentication required'), 3000);
      socket.on('message', raw => {
        try {
          const message = JSON.parse(String(raw));
          if (!authenticated) {
            const received = Buffer.from(typeof message.token === 'string' ? message.token : '');
            const expected = Buffer.from(token);
            if (message.kind !== 'hello' || received.length !== expected.length || !timingSafeEqual(received, expected)) {
              socket.close(1008, 'Invalid authentication'); return;
            }
            if (this.peer && this.peer !== socket) { socket.close(1008, 'Another app is connected'); return; }
            authenticated = true;
            clearTimeout(deadline);
            this.peer = socket;
            this.info = message.info;
            socket.send(JSON.stringify({ kind: 'welcome' }));
            return;
          }
          const pending = this.pending.get(message.id);
          if (!pending) return;
          clearTimeout(pending.timer);
          this.pending.delete(message.id);
          if (message.ok === true) pending.resolve(message.data);
          else pending.reject(new Error(String(message.error ?? 'App request failed')));
        } catch { socket.close(1008, 'Invalid bridge message'); }
      });
      socket.on('error', () => {});
      socket.on('close', () => {
        clearTimeout(deadline);
        if (this.peer !== socket) return;
        this.peer = undefined;
        this.info = null;
        this.failPending('BRIDGE_DISCONNECTED: App 连接已断开；修改结果可能未知，请先读回状态，勿自动重试写入。');
      });
    });
    await new Promise<void>((resolve, reject) => {
      this.server!.once('listening', resolve);
      this.server!.once('error', reject);
    });
  }

  status() { return { connected: this.peer?.readyState === WebSocket.OPEN, info: this.info }; }

  get port() {
    const address = this.server?.address();
    if (!address || typeof address === 'string') throw new Error('Bridge is not listening');
    return address.port;
  }

  request(method: string, params: unknown = {}, timeoutMs = 12000): Promise<unknown> {
    if (!this.peer || this.peer.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('BRIDGE_OFFLINE: 请在 mBlock 中加载本项目生成的 MCP Bridge 扩展。'));
    }
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`BRIDGE_TIMEOUT: ${method} 结果未知，请先读回状态，勿自动重试写入。`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.peer!.send(JSON.stringify({ id, method, params }), error => {
        if (!error) return;
        clearTimeout(timer); this.pending.delete(id); reject(error);
      });
    });
  }

  private failPending(message: string) {
    for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new Error(message)); }
    this.pending.clear();
  }

  async close() {
    this.failPending('Bridge stopped');
    this.server?.clients.forEach(socket => socket.terminate());
    if (this.server) await new Promise<void>(resolve => this.server!.close(() => resolve()));
  }
}

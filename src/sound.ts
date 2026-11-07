import { open } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';

const MAX_INPUT = 10 * 1024 * 1024;
const RATE = 44100, CHANNELS = 2, MAX_PCM = RATE * CHANNELS * 2 * 120;

export function pcmWav(pcm: Buffer) {
  const header = Buffer.alloc(44);
  header.write('RIFF'); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(CHANNELS, 22);
  header.writeUInt32LE(RATE, 24); header.writeUInt32LE(RATE * CHANNELS * 2, 28);
  header.writeUInt16LE(CHANNELS * 2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export async function readSound(filename: string) {
  if (!path.isAbsolute(filename)) throw new Error('SOUND_PATH_REQUIRED');
  const handle = await open(filename, 'r');
  let input: Buffer;
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) throw new Error('SOUND_FILE_REQUIRED');
    if (stat.size > MAX_INPUT) throw new Error('SOUND_TOO_LARGE: 输入上限 10 MiB');
    const buffer = Buffer.alloc(MAX_INPUT + 1);
    let length = 0;
    while (length < buffer.length) {
      const r = await handle.read(buffer, length, buffer.length - length, null);
      if (!r.bytesRead) break;
      length += r.bytesRead;
    }
    if (length > MAX_INPUT) throw new Error('SOUND_TOO_LARGE');
    input = buffer.subarray(0, length);
  } finally { await handle.close(); }
  const wav = input.toString('ascii', 0, 4) === 'RIFF' && input.toString('ascii', 8, 12) === 'WAVE';
  const mp3 = input.toString('ascii', 0, 3) === 'ID3' || (input[0] === 0xff && (input[1] & 0xe0) === 0xe0);
  if (!wav && !mp3) throw new Error('UNSUPPORTED_SOUND: 仅支持 WAV、MP3');
  const executable = process.env.MBLOCK_FFMPEG || ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg']
    .find(p => existsSync(p)) || 'ffmpeg';
  const pcm = await new Promise<Buffer>((resolve, reject) => {
    const child = spawn(executable, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-xerror',
      '-protocol_whitelist', 'pipe', '-f', wav ? 'wav' : 'mp3', '-i', 'pipe:0', '-t', '121',
      '-map', '0:a:0', '-vn', '-ac', String(CHANNELS), '-ar', String(RATE), '-f', 's16le', 'pipe:1'],
      { stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks: Buffer[] = []; let length = 0, diagnostic = '', failure: Error | undefined;
    const fail = (message: string) => { failure ??= new Error(message); child.kill('SIGKILL'); };
    const timer = setTimeout(() => fail('SOUND_DECODE_TIMEOUT'), 15000);
    child.on('error', error => { clearTimeout(timer); reject(new Error(`SOUND_DECODER_UNAVAILABLE: ${error.message}; 安装 FFmpeg 或设置 MBLOCK_FFMPEG`)); });
    child.stdout.on('data', (chunk: Buffer) => {
      length += chunk.length;
      if (length > MAX_PCM) fail('SOUND_DURATION_LIMIT: 时长上限 120 秒');
      else chunks.push(chunk);
    });
    child.stderr.on('data', chunk => { diagnostic = (diagnostic + String(chunk)).slice(-1500); });
    child.stdin.on('error', () => {}); // Early decoder exit is reported by close.
    child.on('close', code => {
      clearTimeout(timer);
      if (failure) reject(failure);
      else if (code !== 0 || !length || length % 4) reject(new Error(`INVALID_SOUND: ${diagnostic || '无法解码音频'}`));
      else resolve(Buffer.concat(chunks));
    });
    child.stdin.end(input);
  });
  const bytes = pcmWav(pcm);
  return { base64: bytes.toString('base64'), bytes: bytes.length, duration: pcm.length / (RATE * CHANNELS * 2),
    sampleRate: RATE, channels: CHANNELS, sourceFormat: wav ? 'wav' : 'mp3' };
}

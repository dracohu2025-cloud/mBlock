import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

export const configPath = fileURLToPath(new URL('../.local/bridge.json', import.meta.url));
export const configSchema = z.object({
  port: z.number().int().min(1024).max(65535),
  token: z.string().regex(/^[a-f0-9]{64}$/),
});

export function readConfig() {
  try {
    return configSchema.parse(JSON.parse(readFileSync(configPath, 'utf8')));
  } catch {
    throw new Error('桥接配置不存在或无效。请先运行 npm run build。');
  }
}

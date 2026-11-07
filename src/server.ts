import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';
import path from 'node:path';
import { BridgeHub } from './hub.js';
import { readConfig } from './config.js';
import { scriptXml, type BlockSpec } from './script.js';
import { saveExport } from './project.js';
import { readImage } from './image.js';
import { spriteArchive } from './sprite.js';
import { readSound } from './sound.js';

const hub = new BridgeHub();
const config = readConfig();
const target = z.string().min(1).max(200).describe('目标的 ID 或唯一名称，先用 mblock_list_targets 查询');
const scalar = z.union([z.string().max(10000), z.number().finite()]);
const pagination = { offset: z.number().int().min(0).default(0), limit: z.number().int().min(1).max(500).default(100) };
const blockSchema: z.ZodType<BlockSpec> = z.lazy(() => z.object({
  opcode: z.string().regex(/^[a-zA-Z0-9_.]+$/),
  fields: z.record(z.string(), z.string()).optional(),
  inputs: z.record(z.string(), z.union([scalar, blockSchema])).optional(),
  substack: z.array(blockSchema).max(500).optional(), substack2: z.array(blockSchema).max(500).optional(),
}));

function createServer() {
  const server = new McpServer({ name: 'mblock-mcp-server', version: '0.4.0' });
  function tool<S extends z.ZodType<Record<string, unknown>>>(name: string, description: string, schema: S,
    readonly: boolean, action: (params: z.infer<S>) => Promise<unknown>) {
    server.registerTool(name, {
      description, inputSchema: schema as z.ZodType<Record<string, unknown>>,
      annotations: { readOnlyHint: readonly, destructiveHint: !readonly, idempotentHint: readonly, openWorldHint: false },
    }, async (raw: unknown) => {
      try {
        const params = schema.parse(raw);
        const result = await action(params);
        const output = { result };
        return { content: [{ type: 'text' as const, text: JSON.stringify(output) }], structuredContent: output };
      } catch (error) {
        return { isError: true, content: [{ type: 'text' as const, text: error instanceof Error ? error.message : String(error) }] };
      }
    });
  }
  tool('mblock_status', '查询桥接状态；连接后向真实 App 发请求读取当前目标。', z.object({}), true,
    async () => hub.status().connected ? hub.request('status') : hub.status());
  tool('mblock_list_targets', '列出真实 App 当前项目的舞台、角色和设备及 ID。', z.object({}), true,
    () => hub.request('targets'));
  tool('mblock_list_costumes', '列出角色造型或舞台背景，返回从 0 开始的索引、素材 ID、尺寸和当前选择。',
    z.object({ target, ...pagination }), true, p => hub.request('costumes', p));
  tool('mblock_set_costume', '按从 0 开始的索引切换角色造型或舞台背景；不触发背景切换事件脚本。',
    z.object({ target, index: z.number().int().min(0) }), false, p => hub.request('setCostume', p));
  tool('mblock_import_image', '将本地 PNG/JPEG/WebP 图片导入已有角色的造型或 Stage 的背景。仅新增，不覆盖；返回 App 实际素材信息。输入上限 10 MiB、单边 4096 像素；保留透明度，拒绝动画和 SVG。',
    z.object({ target, path: z.string().min(1).describe('本地图片绝对路径'),
      name: z.string().trim().min(1).max(100).optional(), select: z.boolean().default(true),
      bitmapResolution: z.union([z.literal(1), z.literal(2)]).default(1)
        .describe('每个舞台单位对应的图片像素数；1 为原始尺寸，2 为半尺寸') }), false,
    async p => {
      if (!hub.status().connected) throw new Error('BRIDGE_OFFLINE: 请先在 mBlock 加载 MCP Bridge');
      const image = await readImage(p.path);
      const name = p.name ?? (path.parse(p.path).name.replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 100) || 'image');
      const result = await hub.request('importImage', { target: p.target, name, select: p.select,
        bitmapResolution: p.bitmapResolution, base64: image.base64 }, 30000);
      return { ...result as Record<string, unknown>, source: { width: image.width, height: image.height,
        format: image.sourceFormat, normalizedBytes: image.bytes } };
    });
  const assetName = z.string().trim().min(1).max(100).regex(/^[^\x00-\x1f\x7f]+$/);
  tool('mblock_create_sprite', '从本地 PNG/JPEG/WebP 新建独立角色，不改变已有角色。拒绝重名，图片限制同 import_image；不会运行脚本。',
    z.object({ path: z.string().min(1), name: assetName,
      x: z.number().finite().min(-240).max(240).default(0), y: z.number().finite().min(-180).max(180).default(0),
      size: z.number().finite().min(1).max(500).default(100),
      bitmapResolution: z.union([z.literal(1), z.literal(2)]).default(2) }), false, async p => {
      if (!hub.status().connected) throw new Error('BRIDGE_OFFLINE');
      const image = await readImage(p.path);
      const base64 = await spriteArchive(image.base64, { ...p, width: image.width, height: image.height });
      return hub.request('createSprite', { name: p.name, base64 }, 30000);
    });
  tool('mblock_rename_sprite', '重命名独立角色并更新积木中的角色引用。拒绝舞台、设备和重名。',
    z.object({ target, name: assetName }), false, p => hub.request('renameSprite', p));
  tool('mblock_rename_costume', '重命名角色造型或舞台背景并更新相关积木引用；expectedName 用于校验索引未变化。',
    z.object({ target, index: z.number().int().min(0), expectedName: assetName, name: assetName }), false,
    p => hub.request('renameCostume', p));
  async function backupAndDelete(method: string, p: { backupPath: string; [key: string]: unknown }) {
    // A failed backup must never be followed by a deletion. Never overwrite backups.
    const backup = await saveExport(p.backupPath, await hub.request('exportProject', {}, 30000));
    try { return { ...await hub.request(method, p) as Record<string, unknown>, backup }; }
    catch (error) { throw new Error(`${String(error)}; 删除前备份已保存到 ${p.backupPath}`); }
  }
  const backupPath = z.string().min(1).refine(p => path.isAbsolute(p) && path.extname(p) === '.mblock',
    '需要新的 .mblock 绝对路径').describe('删除前完整项目备份；父目录须存在，拒绝覆盖。失败时不删除');
  tool('mblock_delete_sprite', '先备份整个项目，再删除指定 ID 的独立角色及其脚本。禁止删除舞台/设备；expectedName 防止误删。',
    z.object({ target: target.describe('要删除的角色 ID；应先 list_targets'), expectedName: assetName, backupPath }), false,
    p => backupAndDelete('deleteSprite', p));
  tool('mblock_delete_costume', '先备份整个项目，再删除角色造型或舞台背景；拒绝删除最后一个。已有脚本的文字引用可能失效，调用前检查。',
    z.object({ target, index: z.number().int().min(0), expectedName: assetName, backupPath }), false,
    p => backupAndDelete('deleteCostume', p));
  const indexedAsset = { target, index: z.number().int().min(0), expectedName: assetName };
  tool('mblock_list_sounds', '查询目标声音、素材 ID、时长及音频引擎播放状态。',
    z.object({ target, ...pagination }), true, p => hub.request('sounds', p));
  tool('mblock_import_sound', '导入本地 WAV/MP3 为目标的新声音。FFmpeg 本地解码为 44.1kHz 双声道 PCM WAV；输入上限 10 MiB、时长上限 120 秒，拒绝重名。',
    z.object({ target, path: z.string().min(1), name: assetName }), false, async p => {
      if (!hub.status().connected) throw new Error('BRIDGE_OFFLINE');
      const sound = await readSound(p.path);
      const result = await hub.request('importSound', { target: p.target, name: p.name, base64: sound.base64 }, 30000);
      const { base64, ...source } = sound;
      return { ...result as Record<string, unknown>, source };
    });
  tool('mblock_rename_sound', '重命名声音，并通过原生 VM 更新积木中的声音名称引用。',
    z.object({ ...indexedAsset, name: assetName }), false, p => hub.request('renameSound', p));
  tool('mblock_delete_sound', '备份完整项目后删除声音；允许删除最后一个声音，已有声音积木可能失去引用。',
    z.object({ ...indexedAsset, backupPath }), false, p => backupAndDelete('deleteSound', p));
  tool('mblock_play_sound', '在本机播放指定声音。返回 started 和引擎状态，不代表用户实际听到；不等待播放结束。',
    z.object(indexedAsset), false, p => hub.request('playSound', p));
  tool('mblock_stop_sounds', '停止指定舞台/角色的声音，不影响其他角色；音频引擎可能短暂淡出。',
    z.object({ target }), false, p => hub.request('stopSounds', p));
  tool('mblock_duplicate_sprite', '复制独立角色及其积木、变量、造型和声音，指定唯一新名称；不启动脚本。位置默认与原角色相同。',
    z.object({ target, name: assetName, x: z.number().finite().min(-240).max(240).optional(),
      y: z.number().finite().min(-180).max(180).optional() }), false, p => hub.request('duplicateSprite', p, 30000));
  tool('mblock_duplicate_costume', '在同一目标内复制造型或舞台背景，追加至列表末尾；默认保持当前选择。',
    z.object({ ...indexedAsset, name: assetName, select: z.boolean().default(false) }), false,
    p => hub.request('duplicateCostume', p, 30000));
  tool('mblock_duplicate_sound', '在同一目标内复制声音，追加至列表末尾，使用唯一的新名称。',
    z.object({ ...indexedAsset, name: assetName }), false, p => hub.request('duplicateSound', p, 30000));
  tool('mblock_reorder_costume', '移动造型或背景到列表中的指定索引（从 0 开始），保持当前显示素材；数字索引脚本含义可能随排序改变。',
    z.object({ ...indexedAsset, toIndex: z.number().int().min(0) }), false, p => hub.request('reorderCostume', p));
  tool('mblock_reorder_sound', '移动声音到指定索引（从 0 开始），保持声音内容；数字索引脚本含义可能改变。',
    z.object({ ...indexedAsset, toIndex: z.number().int().min(0) }), false, p => hub.request('reorderSound', p));
  tool('mblock_list_sprite_layers', '查询独立角色在舞台上从后到前的绘制顺序；不包含舞台、设备或运行时克隆。',
    z.object({}), true, () => hub.request('layers'));
  tool('mblock_set_sprite_layer', '调整角色舞台图层：front 最前，back 最后，forward 前移，backward 后移；steps 仅对相对移动生效。',
    z.object({ target, direction: z.enum(['front', 'back', 'forward', 'backward']), steps: z.number().int().min(1).max(1000).default(1) }),
    false, p => hub.request('setLayer', p));
  tool('mblock_list_blocks', '分页读取目标上的 VM 积木及其 ID、连接、输入和字段。', z.object({ target, ...pagination }), true,
    p => hub.request('blocks', p));
  tool('mblock_list_opcodes', '搜索当前 App 已加载的积木类型。', z.object({ query: z.string().default(''), ...pagination }), true,
    p => hub.request('catalog', p));
  tool('mblock_add_script', '向角色或舞台添加积木链，读回 VM 后才成功。inputs 为输入名称到文本、数字或嵌套积木的映射；substack/substack2 为控制分支。不会自动运行。',
    z.object({ target, blocks: z.array(blockSchema).min(1).max(500), x: z.number().default(80), y: z.number().default(80) }), false,
    p => hub.request('addXml', { target: p.target, xml: scriptXml(p.blocks, p.x, p.y) }));
  tool('mblock_add_blocks_xml', '添加 Blockly XML；支持字段 ID 和自制积木 mutation。拒绝未知积木，失败回滚本次新增内容。',
    z.object({ target, xml: z.string().min(1).max(200000) }), false, p => hub.request('addXml', p));
  tool('mblock_set_block_field', '修改已有积木的字段并返回 VM 实际值；数字/文本输入通常位于对应的 shadow 积木上。',
    z.object({ target, blockId: z.string().min(1), field: z.string().min(1), value: z.string().max(10000) }), false,
    p => hub.request('setBlockField', p));
  tool('mblock_list_variables', '读取目标自身的变量和列表。全局变量请查询 Stage。', z.object({ target }), true,
    p => hub.request('variables', p));
  tool('mblock_create_variable', '创建一个本地或舞台全局变量；重名时报错。',
    z.object({ target, name: z.string().min(1).max(100), value: scalar.default(0) }), false, p => hub.request('createVariable', p));
  tool('mblock_set_variable', '修改已存在变量的值并读回；不会悄悄创建变量。',
    z.object({ target, name: z.string().min(1).max(100), value: scalar }), false, p => hub.request('setVariable', p));
  tool('mblock_run_script', '只运行指定角色/舞台的一个顶层脚本。started 仅表示已启动，完成效果需读回变量/坐标验证；不支持硬件目标。',
    z.object({ target, blockId: z.string().min(1) }), false, p => hub.request('runScript', p));
  tool('mblock_stop_target', '停止指定角色/舞台正在执行的脚本。', z.object({ target }), false, p => hub.request('stopTarget', p));
  tool('mblock_export_project', '从 App 导出完整 .mblock，验证素材和元数据；只创建新文件，拒绝覆盖现有文件。',
    z.object({ path: z.string().min(1).describe('目标绝对路径，父目录必须已存在，后缀为 .mblock') }), false,
    async p => {
      if (!path.isAbsolute(p.path) || path.extname(p.path) !== '.mblock') throw new Error('需要 .mblock 绝对路径');
      return saveExport(p.path, await hub.request('exportProject', {}, 30000));
    });
  return server;
}

await hub.start(config.port, config.token);
process.stderr.write(`mBlock bridge listening on 127.0.0.1:${config.port}\n`);
void serveStdio(createServer);
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, async () => { await hub.close(); process.exit(0); });
process.stdin.once('end', async () => { await hub.close(); process.exit(0); });

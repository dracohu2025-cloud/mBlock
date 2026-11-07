import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';
import path from 'node:path';
import { BridgeHub } from './hub.js';
import { readConfig } from './config.js';
import { scriptXml, type BlockSpec } from './script.js';
import { saveExport } from './project.js';
import { readImage } from './image.js';

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
  const server = new McpServer({ name: 'mblock-mcp-server', version: '0.2.0' });
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

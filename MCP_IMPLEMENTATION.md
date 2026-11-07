# 本地 MCP 实现与验证

日期：2026-11-07。App：mBlock 5.6.0（5.6.0.31）。

## 当前完成情况

已实现独立 TypeScript MCP 服务和完整 `.mext` 扩展包，共 13 个工具。未复用第三方项目中返回虚假成功的桥接实现。

- MCP 状态、目标、积木、已加载 opcode 查询。
- 添加嵌套脚本和 Blockly XML，修改已有积木字段。
- 变量查询、创建、修改。
- 单个舞台/角色脚本运行和目标停止。
- 通过 App 自身序列化导出项目，保留素材及 mBlock 元数据；文件端检查素材是否存在，拒绝覆盖。
- 本地回环地址、配对令牌、Origin 校验、明确的离线/断线/超时错误。

## 已验证

- `npm run build`：通过，生成服务及 `artifacts/mblock-mcp-bridge.mext`。
- `npm test`：5 项测试通过，覆盖认证拒绝、Origin 拒绝、请求成功/失败/超时/断线、脚本嵌套与文本转义、复杂度限制、素材缺失检测、不兼容 App、未知变量及硬件目标拒绝。
- MCP JSON-RPC initialize：成功，返回 `mblock-mcp-server 0.1.0`。
- 静态检查安装 App 的真实实现，确认扩展处理器得到 `app._mCtx`，其中包含 `vmCtx.vm`、`blocklyCtx.blockly`、`blocklyCtx.workspace`。
- 核对原生 `.mext` ZIP 格式：根目录 `manifest.json` 和 UMD `index.js`，不再使用只含描述 JSON 的伪扩展文件。

## 尚未验证

**真实 App 连接、写入、运行和导出闭环尚未完成。** 本次验证未把开发扩展写入 mBlock 的本地注册表，也未完成安装脚本在真实 App 环境中的验收。

准备好的安装命令为 `node "scripts/install-bridge.mjs" --confirm`，会在 `.local/install-backup-时间戳/` 备份注册表和被更新的本扩展文件，仅新增/更新 `codex_mcp_bridge`。不会修改 Codex 配置或 App 安装包。

## 待完成的 App 验收步骤

1. 启动独立 MCP 测试客户端，在 mBlock 中添加本地 MCP Bridge 扩展。
2. 用 MCP 查询目标、积木和变量，在修改前导出完整基线项目。
3. 对空白测试角色添加有限循环、移动和文字输出脚本；确认返回的积木 ID 在后续读回中存在。
4. 通过 MCP 运行这一条脚本，验证坐标及变量的实际变化，并用 App 界面核对。
5. 验证字段修改、未知类型失败且不遗留部分积木、断线后恢复。
6. 导出 `.mblock`，校验素材和元数据，再在 App 打开验证。

## 工程取舍

服务协议、App 适配、脚本构造和文件校验分开，保持单一职责。错误和参数校验统一处理。首版没有泛用 eval、Shell、文件读取、硬件上传或后台常驻服务，避免扩大当前需求。

内部接口不是官方兼容承诺；自动测试不能代替真实 App 验收。初始第三方项目的调查另见 `MCP_VERIFICATION.md`。

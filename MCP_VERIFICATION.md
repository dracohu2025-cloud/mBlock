# 第三方 mBlock MCP 调查记录

本文仅记录对 `blame-me/mblock-mcp` 的调查，不是本仓库实现的验收报告。本仓库状态见 [MCP_IMPLEMENTATION.md](MCP_IMPLEMENTATION.md)。

验证日期：2026-11-07（Asia/Shanghai）。

## 结论

第三方 MCP 服务可以启动并处理文件工具请求，但本次没有建立到 mBlock App 的实时连接，不能据此声称已经能够通过 MCP 操作 App。当前桥接实现和生成项目均存在明确缺陷，不建议直接作为可靠的实时编辑方案。

## 环境与版本

- App：`/Applications/mBlock.app`，版本 5.6.0，构建 5.6.0.31，Bundle ID `cc.mblock`。
- MCP：https://github.com/blame-me/mblock-mcp
- 审查提交：`600d7ec2abf73b5bc353428fff5c8d09c5272451`，包版本 1.0.1。
- 源码、依赖、编译输出和测试文件均放在临时目录；没有运行自动注册脚本，没有改动 Codex MCP 配置或 App 安装文件。

## 实测结果

| 检查 | 结果 |
| --- | --- |
| 安装项目局部依赖 | `npm ci --ignore-scripts --no-audit --no-fund` 成功 |
| 编译 | `npm run build` 成功 |
| 仓库自带测试 | 5/5 通过；不代表真实 App 集成通过 |
| MCP stdio JSON-RPC 握手 | 成功，协议 `2025-06-18` |
| `tools/list` | 返回 36 个工具 |
| `doctor` / `app_status` | 服务正常，App 桥接离线 |
| `app_get_var` | 返回 `BRIDGE_OFFLINE` |
| `project-new` | 生成 sprite_chase 模板，包含 4 个积木 |
| `project-open` | 可读取上述文件并统计积木 |
| `project-validate` | 返回通过，但漏检下述素材缺失 |
| App 界面访问 | 可读取 App 窗口；此项使用 Computer Use，仅用于确认 App 状态 |

MCP 测试使用独立本地 JSON-RPC 客户端启动服务器，没有将它注册为当前 Codex 会话的原生工具。测试结束后服务器已终止。

## 发现的缺陷

1. **实时插入未实现。** `extensions/mblock-bridge/bridge.js` 中 `__bridgeInject` 仅记录日志、探测 VM，并可能触发已有绿旗事件，没有创建或导入积木。调用方仍返回 `injected: true`。使用隔离的模拟 app 执行该函数，仅观察到日志和 `runBlocks("event_whenflagclicked")`，没有 VM 写入。这个测试验证的是函数行为，不是真实 App 的运行效果。
2. **桥接扩展未完整封装。** 仓库提供的 `mblock-bridge.mext` 是 434 字节 JSON，只有描述信息和两个积木定义，没有桥接执行代码，也没有引用旁边的 `bridge.js`。JS 文件自身要求将代码手动放入 Extension Builder。因此，README 所描述的“拖入该文件即连接”没有完整实现支撑；本次没有将这个不完整扩展导入 App。
3. **生成项目缺少素材。** 新建文件的 ZIP 只有 `project.json`，却引用了 `cd21514d0531fdffb22204e0ec5ed84a.svg` 和 `b7853f557e4426412e64df6c6a43a49d.svg`，两者均不在包中。没有完成该项目在 App 内的打开和运行验证。

## 可行的后续方向

- 文件方式：以 App 导出的真实 `.mblock` 项目为基底，保留素材和元数据，通过文件工具改积木，再回到 App 验证。
- 实时方式：需要先实现并封装真正可加载的桥接扩展，补齐积木读写，再验证 App 实际状态变化；这属于后续开发工作，不能视为现有 MCP 已经可用。

# mBlock MCP

本仓库包含 **MCP 服务端、mBlock 本地扩展、打包与安装脚本、测试及使用文档**。它面向 mBlock 5.6.0，让 MCP 客户端通过程序接口读取项目、编辑积木、导入图片素材、运行角色脚本和导出完整项目。

**当前版本：0.4.0，实验性实现，共 34 个工具。** 编译和 16 项自动测试通过。2026-11-07 在 macOS mBlock 5.6.0.31 上完成原有 13 个工具的真实调用及项目重新打开验证；0.4.0 新增的 13 个声音、排序、复制和图层工具已通过真实 App 调用，并验证包含声音与角色副本的项目重新打开；0.3.0 新增的 5 个素材管理工具已通过真实 App 调用；0.2.0 的图片导入、造型/背景查询和切换三个工具也已通过真实 App 调用，导出包中的新增图片像素、透明度和引用完整性已检查。尚未覆盖其他 App 版本、复杂扩展项目和全部异常路径，使用前请先在测试项目中验收。

## 工作方式

```mermaid
flowchart LR
    Client[Codex / 其他 MCP 客户端] <-->|MCP stdio| Server[Node.js 服务]
    Server <-->|WebSocket + 本机配对令牌| Bridge[mBlock MCP Bridge 扩展]
    Bridge <--> Runtime[mBlock Scratch VM / Blockly]
    Image[本地 PNG / JPEG / WebP] --> Server
    Server --> Export[本地 .mblock 文件]
```

积木编辑的实现通过扩展访问 mBlock 的 VM/Blockly，不依赖鼠标拖拽。界面操作只用于首次加载扩展，以及人工核对结果。

服务仅监听 `127.0.0.1:17865`，扩展主动连接服务。客户端负责启动 stdio 服务，不需要额外的后台常驻进程。依赖 mBlock 的内部 `app._mCtx` 接口，**并非 Makeblock 官方 MCP 或稳定 API**；更换 App 版本需要重新验证。

## 能力与验证范围

| 项目 | 状态 |
| --- | --- |
| TypeScript 编译、扩展 ZIP 打包 | 已通过 |
| 配对校验、错误传播、超时、断线、脚本构造、素材校验 | 自动测试已通过 |
| MCP initialize、tools/list、离线错误、参数拒绝 | 已通过协议测试 |
| 真实 App 扩展加载、读写与运行 | macOS 5.6.0.31 实测通过，累计 34 个工具均已调用 |
| 图片导入、造型/背景查询与切换 | PNG、JPEG、WebP 实测通过；透明度和导出素材已校验 |
| 完整项目从 App 导出后再次打开 | 测试项目通过，积木、坐标、变量和素材保留 |
| MCP 服务重启后自动重连 | 实测通过 |
| 机器人运行、设备上传、固件操作 | 不支持 |
| 任意 JavaScript、Shell 执行、通用文件读取 | 不提供 |

写入和运行工具限制为舞台/角色目标。读取工具可以列出设备，但这不代表支持控制设备。运行一个角色脚本仍会执行该脚本原有的广播、扩展等逻辑，应先检查脚本内容。

## 环境要求

- Node.js **22 或更高版本**，以及 npm。
- 声音导入与音频测试需要 **FFmpeg**。优先读取 `MBLOCK_FFMPEG` 指定的可执行文件，否则检查 `/opt/homebrew/bin/ffmpeg`、`/usr/local/bin/ffmpeg`，最后使用 PATH 中的 `ffmpeg`。其他工具不依赖 FFmpeg。
- 已安装 mBlock 5.6.0 桌面 App。当前接口研究基于 macOS 版 5.6.0.31。
- 支持 stdio 的 MCP 客户端，或本仓库自带的测试客户端。
- 本地安装脚本假设扩展目录为用户主目录下的 `mblock/exts`；其他系统和安装布局尚未验证。

## 快速开始

### 1. 获取源码并构建

```sh
git clone "https://github.com/dracohu2025-cloud/mBlock.git"
cd "mBlock"
npm ci --ignore-scripts
npm run build
npm test
```

构建会生成：

| 路径 | 用途 |
| --- | --- |
| `dist/server.js` | MCP 服务入口 |
| `artifacts/mblock-mcp-bridge.mext` | 包含 `manifest.json` 和完整 UMD 代码的扩展包 |
| `.local/bridge.json` | 本机端口与随机配对令牌 |

**扩展包包含本机配对令牌，因此不随源码发布，也不应分享。** 每台电脑应自行构建；再次构建会复用本机配置。`.local/`、`artifacts/`、`dist/` 和 `node_modules/` 均被 Git 忽略。

### 2. 加载扩展

先保存当前工作，并使用测试项目。可尝试将生成的 `.mext` 文件拖入 mBlock。

仓库还提供本地安装脚本。显式传入 `--confirm` 后，它会备份本地扩展注册表及本扩展旧文件，然后仅新增/更新 `codex_mcp_bridge`：

```sh
node "scripts/install-bridge.mjs" --confirm
```

安装目标是 `~/mblock/exts/codex_mcp_bridge/` 和注册表 `~/mblock/exts/ext.json`；备份保存在 `.local/install-backup-时间戳/`。脚本不修改 mBlock App 安装包或 MCP 客户端配置。该安装路径已在 macOS 上验证，确认其他扩展注册条目保持不变。

在 mBlock 中打开“添加扩展 → 本地角色扩展”，选择 **MCP Bridge**。如果 App 已缓存扩展列表，保存项目后重启 App。服务启动后，扩展中的状态积木应显示“已连接”；以 `mblock_status` 的实际返回为最终判断。

**从旧版本升级：** 更新源码后重新执行 `npm ci --ignore-scripts`、`npm run build` 和上述安装命令；保存项目，退出并重新打开 mBlock，重新加载 MCP Bridge，同时重启 MCP 客户端的服务连接。只替换磁盘上的扩展文件不会更新 App 已加载的代码；本次升级实测旧代码会对图片工具返回 `UNKNOWN_METHOD`，重启后恢复。

首次打开扩展中心可能出现 mBlock 自身的隐私提示，请阅读并自行决定是否接受。**添加扩展是项目级操作**：本次测试项目未使用 MCP Bridge 自身的积木，导出后 `project.json` 的 `extensions` 为空；重新打开时桥接未自动加载，需要再次添加 MCP Bridge。重新打开项目后也应重新查询目标 ID，不要复用上次的 ID。

### 3. 连接 MCP 客户端

以 [mcp.example.json](mcp.example.json) 为模板，替换 Node 和项目路径。GUI 客户端可能没有终端的 `PATH`，建议使用 Node 的绝对路径，可通过 `command -v node` 查询。

通用 MCP JSON 配置：

```json
{
  "mcpServers": {
    "mblock": {
      "command": "/absolute/path/to/node",
      "args": ["/absolute/path/to/mBlock/dist/server.js"]
    }
  }
}
```

Codex TOML 配置示例：

```toml
[mcp_servers.mblock]
command = "/absolute/path/to/node"
args = ["/absolute/path/to/mBlock/dist/server.js"]
```

保存到客户端使用的配置后，重新加载其 MCP 连接。服务通过自身文件位置定位配置，因此不依赖客户端的工作目录。

**同一端口只能启动一个服务，且一个服务只接受一个已配对的 App 连接。** 使用正式客户端前，先退出独立测试客户端。

## 工具清单

`target` 接受目标 ID 或唯一名称；建议先查询目标，再使用 ID。分页参数默认 `offset=0`、`limit=100`，上限 500。

| 工具 | 主要参数 | 行为 |
| --- | --- | --- |
| `mblock_status` | 无 | 查询连接；已连接时向 App 读取实际状态 |
| `mblock_list_targets` | 无 | 列出舞台、角色和设备的 ID、坐标、积木数 |
| `mblock_list_costumes` | `target`, `offset`, `limit` | 列出角色造型或舞台背景、当前选择、尺寸及素材 ID |
| `mblock_import_image` | `target`, `path`, `name?`, `select?`, `bitmapResolution?` | 将本地图片新增为造型或背景，等待 App 加载并返回实际素材信息 |
| `mblock_set_costume` | `target`, `index` | 按从 0 开始的索引切换造型或背景，不触发背景切换事件脚本 |
| `mblock_list_blocks` | `target`, `offset`, `limit` | 读取 VM 积木、输入、字段和连接关系 |
| `mblock_list_opcodes` | `query`, `offset`, `limit` | 搜索 App 当前已加载的积木类型 |
| `mblock_add_script` | `target`, `blocks`, `x`, `y` | 添加结构化脚本，读回 VM 后返回；不自动运行 |
| `mblock_add_blocks_xml` | `target`, `xml` | 添加 Blockly XML，支持字段 ID 和 mutation |
| `mblock_set_block_field` | `target`, `blockId`, `field`, `value` | 修改字段，返回实际值及原值 |
| `mblock_list_variables` | `target` | 读取目标自身的变量和列表；全局变量查询舞台 |
| `mblock_create_variable` | `target`, `name`, `value` | 创建非云变量；重名时报错 |
| `mblock_set_variable` | `target`, `name`, `value` | 修改已存在变量；不自动创建 |
| `mblock_run_script` | `target`, `blockId` | 启动指定顶层脚本；已经运行则报错 |
| `mblock_stop_target` | `target` | 停止指定舞台/角色的脚本 |
| `mblock_export_project` | `path` | 导出完整 `.mblock` 到新文件，校验素材和元数据 |

成功响应的 `structuredContent.result` 包含结果，同时提供同内容的 JSON 文本。操作失败返回 `isError: true` 和具体错误，不将离线、App 异常或超时包装为成功。

## 角色与素材管理（0.3.0）

| 工具 | 用途 |
| --- | --- |
| `mblock_create_sprite` | 从本地 PNG/JPEG/WebP 新建独立角色；必填 `path`、`name`，可选 `x`、`y`、`size`、`bitmapResolution`（默认 2） |
| `mblock_rename_sprite` | 按 `target` 和 `name` 重命名角色，更新积木角色引用；拒绝重名、舞台及设备 |
| `mblock_delete_sprite` | 使用角色 **ID**、`expectedName` 和 `backupPath` 删除角色及脚本；先备份整个项目 |
| `mblock_rename_costume` | 按 `target`、`index`、`expectedName`、`name` 重命名造型或背景，更新积木引用 |
| `mblock_delete_costume` | 按 `target`、`index`、`expectedName`、`backupPath` 删除造型或背景；至少保留一个 |

背景属于 Stage 的造型：使用 `mblock_import_image` 向 Stage 新增背景，使用 `mblock_list_costumes` 查询和 `mblock_set_costume` 切换。不需要创建另一个舞台。

删除前自动导出完整 `.mblock` 到指定新路径；备份失败则不执行删除。`expectedName` 用于检测列表索引或名称是否已变化。删除造型/背景后，已有脚本里的文字引用可能失效，应先检查使用情况。新建角色遇到超时应先查询目标，避免重复创建；明确同名请求会报错。角色创建失败会尝试回滚本次唯一识别出的新角色，不移除其他角色。

```json
{"name":"mblock_create_sprite","arguments":{"path":"/absolute/path/to/carrot.png","name":"胡萝卜","x":120,"y":0}}
{"name":"mblock_import_image","arguments":{"target":"Stage","path":"/absolute/path/to/background.png","name":"花园"}}
{"name":"mblock_rename_costume","arguments":{"target":"Stage","index":1,"expectedName":"花园","name":"春天花园"}}
```

## 声音、排序、复制与图层（0.4.0）

| 工具 | 参数与作用 |
| --- | --- |
| `mblock_list_sounds` | `target`、分页；返回名称、时长、素材 ID、音频引擎播放状态 |
| `mblock_import_sound` | `target`、绝对 `path`、唯一 `name`；新增声音 |
| `mblock_rename_sound` | `target`、`index`、`expectedName`、`name`；更新声音及积木中的名称引用 |
| `mblock_delete_sound` | `target`、`index`、`expectedName`、`backupPath`；备份整个项目后删除，可删除最后一个声音 |
| `mblock_play_sound` | `target`、`index`、`expectedName`；在本机试听，返回开始状态，不等待结束 |
| `mblock_stop_sounds` | `target`；停止指定目标的声音，可能有短暂淡出 |
| `mblock_duplicate_sprite` | `target`、唯一新 `name`、可选 `x/y`；复制角色及积木、变量、造型、声音，不启动脚本 |
| `mblock_duplicate_costume` | `target`、`index`、`expectedName`、新 `name`、`select=false`；复制造型/背景并追加末尾 |
| `mblock_duplicate_sound` | `target`、`index`、`expectedName`、新 `name`；复制声音并追加末尾 |
| `mblock_reorder_costume` | `target`、`index`、`expectedName`、`toIndex`；移动造型/背景，保持当前显示的素材 |
| `mblock_reorder_sound` | `target`、`index`、`expectedName`、`toIndex`；移动声音 |
| `mblock_list_sprite_layers` | 无参数；按从后到前返回独立角色绘制顺序 |
| `mblock_set_sprite_layer` | `target`、`direction=front/back/forward/backward`、`steps=1`；调整绘制层级 |

- 声音只接受本地普通 WAV/MP3 文件，输入不超过 10 MiB、解码时长不超过 120 秒。在本机通过 FFmpeg 标准化为 44.1 kHz、双声道、16 位 PCM WAV，剥离元数据；拒绝网络地址、其他格式、损坏和超长输入。MCP 不负责录音或生成语音。
- 声音导入等待 App 解码并检查实际音频缓冲；App 使用默认替代声音时会报错并撤销新增。
- 标准化文件为 44.1 kHz；App 的音频引擎可能按系统采样率重采样，本机读回为 48 kHz，返回的 `source` 与 App 的 `sound` 元数据因此可能不同。
- 试听的 `started` 和 `playing` 是音频引擎状态，不能证明扬声器有声或用户已经听到。`stop_sounds` 不停止其他角色，也不停止脚本（脚本仍可能再次触发声音）。
- 所有列表索引从 0 开始。排序可能改变脚本按数字索引选取素材的含义；`expectedName` 校验过时索引，重排后应重新查询。
- 复制在当前项目内进行，素材复制发生在同一目标内；原素材保留，共享相同内容的底层资源是正常的。新角色具有独立角色和积木 ID。
- 图层顺序与素材列表顺序不同：图层只控制舞台遮挡，不表示左侧角色列表顺序。返回的 `layerOrder` 是渲染器值，可能不连续；运行时克隆不在查询结果内。图层方法使用 VM 的原生实现，也会更新其执行目标顺序。
- 音量、声音剪辑、跨角色搬运素材、导出单独音频，以及硬件播放暂不包含在这组工具中。

```json
{"name":"mblock_import_sound","arguments":{"target":"Panda","path":"/absolute/path/to/hello.mp3","name":"欢迎音效"}}
{"name":"mblock_play_sound","arguments":{"target":"Panda","index":1,"expectedName":"欢迎音效"}}
{"name":"mblock_duplicate_sprite","arguments":{"target":"Panda","name":"Panda副本","x":120,"y":0}}
{"name":"mblock_set_sprite_layer","arguments":{"target":"Panda副本","direction":"front"}}
```

## 使用示例

不配置正式 MCP 客户端也可启动独立测试客户端：

```sh
node "scripts/probe.mjs"
```

客户端会自动启动服务。每行输入一个 JSON 请求；`tools` 列出工具，`quit` 停止测试客户端及其子进程。下述积木、图片、变量和导出流程已在真实 App 上实测，名称和 ID 需按当前项目替换。

### 查询和添加脚本

```json
{"name":"mblock_status","arguments":{}}
{"name":"mblock_list_targets","arguments":{}}
{"name":"mblock_list_blocks","arguments":{"target":"Panda"}}
{"name":"mblock_add_script","arguments":{"target":"Panda","blocks":[{"opcode":"event_whenflagclicked"},{"opcode":"control_repeat","inputs":{"TIMES":3},"substack":[{"opcode":"motion_movesteps","inputs":{"STEPS":10}}]}]}}
```

`Panda` 需替换成实际目标。脚本节点使用 `opcode` 指定积木类型；`fields` 指定字段，`inputs` 指定文本、数字或嵌套积木，`substack` / `substack2` 指定控制分支。默认插入位置为 `(80,80)`。

用添加结果的 `topLevelIds[0]` 作为运行参数：

```json
{"name":"mblock_run_script","arguments":{"target":"Panda","blockId":"替换为返回的顶层积木ID"}}
{"name":"mblock_list_targets","arguments":{}}
```

`started: true` 只表示已启动，**不表示执行完成**。通过随后读回的坐标、变量或舞台效果验证执行结果。

### 修改已有字段

先调用 `mblock_list_blocks` 找到对应字段。数字/文本输入通常属于相连的 `shadow` 积木，例如数字输入的字段名为 `NUM`：

```json
{"name":"mblock_set_block_field","arguments":{"target":"Panda","blockId":"替换为数字shadow积木ID","field":"NUM","value":"20"}}
```

返回 `actual` 是 App 校验后的实际字段值；不要仅凭输入参数推断修改结果。

### 导入图片素材

先用图像生成工具制作图片或准备已有文件，再调用本 MCP 导入。**本 MCP 负责本地图片导入及角色/素材管理，不生成图像，也不发布到 mBlock 云端素材库。** 目标必须是当前项目中已有的角色或舞台；如需新建独立角色，请使用 `mblock_create_sprite`。

```json
{"name":"mblock_list_costumes","arguments":{"target":"Panda"}}
{"name":"mblock_import_image","arguments":{"target":"Panda","path":"/absolute/path/to/character.png","name":"角色新造型","select":false}}
{"name":"mblock_import_image","arguments":{"target":"Stage","path":"/absolute/path/to/background.jpg","name":"新背景"}}
{"name":"mblock_import_image","arguments":{"target":"Panda","path":"/absolute/path/to/detail.webp","bitmapResolution":2}}
{"name":"mblock_set_costume","arguments":{"target":"Panda","index":2}}
```

- `path` 必须是本地普通文件的绝对路径，仅支持静态 **PNG、JPEG、WebP**。输入上限 **10 MiB**，单边最多 **4096 像素**，标准化 PNG 上限 **20 MiB**；拒绝 SVG、GIF、APNG、动画 WebP、损坏文件及超限图片。
- 文件在本机解码，校正 JPEG 方向、移除元数据并转为 PNG，保留透明通道。图片字节通过本机配对连接进入 App。
- `name` 省略时使用文件名；新增素材不覆盖已有造型，重名由 App 处理，以返回的实际名称为准。
- `select` 默认 `true`，导入后显示新素材；`false` 保持原造型/背景。可用列表结果中的 `index` 随后切换，索引从 **0** 开始；示例中的 `2` 需替换为实际导入结果。
- `bitmapResolution` 默认 `1`，每像素对应一个舞台单位；设为 `2` 时显示尺寸减半。mBlock 可能把分辨率 1 的图片存成两倍像素、分辨率 2，显示大小不变。例如本次 96×96 PNG 存储为 192×192、分辨率 2；`source` 为输入尺寸，`costume` 为 App 实际存储结果。
- 导入会等待 App 的素材加载完成，检查渲染信息和实际素材；若 App 用默认替代图片兜底，则报错并撤销此次新增。不要将超时后自动重试当作安全操作，应先查询素材列表，避免重复导入。

导入后调用 `mblock_export_project` 保存完整项目。原始图片仍保留在输入路径中。

### 变量与导出

```json
{"name":"mblock_create_variable","arguments":{"target":"Panda","name":"MCP_TEST","value":0}}
{"name":"mblock_set_variable","arguments":{"target":"Panda","name":"MCP_TEST","value":42}}
{"name":"mblock_list_variables","arguments":{"target":"Panda"}}
{"name":"mblock_export_project","arguments":{"path":"/absolute/path/to/output/Test.mblock"}}
```

导出路径必须是以 `.mblock` 结尾的绝对路径，父目录必须已存在。服务拒绝覆盖现有文件，并检查原始素材以及 `mscratch.json`、`mblock5` 元数据。当前导出上限为 40 MiB。

导出结果的 `assets` 是项目引用的唯一造型/声音文件数，不包含元数据和目录项。VM 积木统计包含 shadow 输入积木，可能大于界面显示的积木数；本次验收为 9 个 VM 积木、界面 5 个积木。

## 故障排查

| 现象或错误 | 排查方式 |
| --- | --- |
| `connected: false` / `BRIDGE_OFFLINE` | 检查扩展是否已加载、服务是否启动，是否使用同一台电脑上同次配对配置生成的包 |
| `EADDRINUSE` | 关闭占用 17865 端口的另一份 MCP 服务或测试客户端 |
| `UNSUPPORTED_APP` | App 内部接口不兼容；重新核对版本，不应跳过校验 |
| `TARGET_NOT_UNIQUE` | 使用 `mblock_list_targets` 返回的目标 ID |
| `UNKNOWN_OPCODE` | 查询 `mblock_list_opcodes`，确认对应扩展已在 App 中加载 |
| `UNKNOWN_METHOD` | 服务与 App 中已加载的扩展版本不一致；重新构建安装并保存、重启 mBlock，重新添加桥接 |
| `UNSUPPORTED_IMAGE` / `INVALID_IMAGE` / `ANIMATED_IMAGE_NOT_SUPPORTED` | 使用有效的静态 PNG、JPEG 或 WebP，检查格式、尺寸与文件大小 |
| `COSTUME_NOT_FOUND` | 重新查询素材列表，使用从 0 开始的有效索引 |
| `IMAGE_IMPORT_NOT_CONFIRMED` | App 素材加载失败；检查图片与 App 版本，本次新增会尝试回滚 |
| `VARIABLE_NOT_FOUND` | 确认变量所属目标；舞台全局变量与角色变量分开查询 |
| `BRIDGE_TIMEOUT` / `BRIDGE_DISCONNECTED` | 写入结果可能未知，先读回状态，勿自动重试写操作 |
| `MISSING_ASSETS` / `MBLOCK_METADATA_MISSING` | 导出不完整，保持报错并排查 App 序列化；不要宣称文件可正常使用 |
| `EEXIST` | 更换导出文件名；不会覆盖旧项目 |

需要更换端口时，停止服务，修改 `.local/bridge.json` 中的 `port`，重新构建并重新加载扩展，使双方配置一致。

## 本地数据与恢复

- 服务只绑定本机回环地址；WebSocket 需要配对令牌，并校验来源为本机 mBlock 使用的 HTTP Origin。
- 这不是针对同一操作系统用户的隔离边界；能够读取本地令牌的进程仍可配对。
- 项目内容会通过调用工具的 MCP 客户端进入该客户端上下文，本项目本身不另设云端中转。
- 新增积木使用 Blockly 事件同步 VM；实现中包含失败回滚逻辑，真实 App 下的回滚行为仍需验收。
- 停止 MCP 客户端启动的服务，即可关闭本地读写连接。
- 安装脚本备份在 `.local/install-backup-时间戳/`。手动恢复前先退出 App，并检查备份之后是否安装了其他扩展，避免直接恢复旧注册表覆盖后续变更。

## 项目结构与验证资料

```text
src/                  MCP 工具、连接管理、脚本构造、图片解码、项目校验
bridge/               mBlock 扩展生命周期与 VM/Blockly 适配
scripts/              扩展打包、本地安装、交互测试客户端
tests/                自动测试
mcp.example.json      通用客户端配置模板
MCP_IMPLEMENTATION.md 本仓库验证记录与待完成验收项
MCP_VERIFICATION.md   初始第三方实现调查，非本仓库验收报告
```

服务协议、App 适配、脚本构造和文件校验各自负责单一职责，统一处理参数和错误。图片解码与 App 素材操作分别位于 `src/image.ts` 和 `bridge/images.js`，角色造型与舞台背景复用同一适配流程。当前范围不包含项目删除、硬件上传和后台常驻服务。声音、排序、复制与舞台图层操作见 0.4.0 工具说明。

详见 [实现验证记录](MCP_IMPLEMENTATION.md) 和 [第三方调查记录](MCP_VERIFICATION.md)。

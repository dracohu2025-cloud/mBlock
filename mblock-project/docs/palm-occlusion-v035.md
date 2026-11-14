# v035 手掌遮挡修正

项目文件：`exports/沙漠绿色公益-手掌遮挡修正-v035.mblock`。

v034 只遮住蓝色手指，铲柄仍绘制在白色手掌上。v035 根据站立、挥手和种植姿势的完整手套轮廓，为 29 个机器人造型分别生成对应铁铲造型。手套覆盖区域的铲柄使用实际断开的 SVG 几何，不再依赖 SVG mask。铁铲跟随机器人的造型编号切换，保留此前确认的铲面左右朝向、长度和握持坐标。

机器人图片与游戏规则未修改。生成脚本为 `scripts/fix-palm-occlusion.mjs`；逐姿势轮廓和遮挡范围见 `assets/props/palm-v035/poses.json`，局部预览见同目录 `preview.png`。

验证：

- `node scripts/verify-shovel-grip.mjs mblock-project/exports/沙漠绿色公益-手掌遮挡修正-v035.mblock`：29 个蓝色手套锚点、完整掌部透明区域、造型同步、铲面朝向及长度通过检查。
- `node scripts/verify-levels.mjs mblock-project/exports/沙漠绿色公益-手掌遮挡修正-v035.mblock`：十关答题、失败重试、植物成长、音乐音量与停止、烟花、徽章和重新开始通过脚本模拟检查。

已保存上述项目文件。本次没有可用的 mBlock 原生界面控制工具，未执行应用内打开、点击保存或整局试玩；脚本模拟不等同于应用内视觉验证。

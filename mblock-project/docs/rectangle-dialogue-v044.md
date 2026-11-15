# v044 长方形对话框

项目：`exports/沙漠绿色公益-长方形对话框-v044.mblock`。

将原生圆角气泡替换为固定尺寸的直角长方形提示框，去掉气泡尖角。提示框放在关卡标题下方，右侧对齐种植区上方空间；题号单独显示在框内左上角，题干在下方，长句优先按标点换行。A/B 完整选项仍保留在底部按钮。

全部 132 道题和 22 条反馈文字使用相同样式，包含十关说明、十种植物的答对反馈、答错与成长提示。题目框为 300 × 50 个舞台单位，位置为 `(70, 117)`；五个题号标签与提示内容同步。使用透明度和尺寸确定的 PNG 素材，避免依赖原生气泡的自动尺寸。

原有对话框角色改为长方形提示框，并新增题号显示角色。在原有提示广播前设置对应造型编号，原生气泡仅保留空文本清理。答题、机器人原地等待、走路种植、成长、沙生绿洲、音乐、烟花及徽章流程保留。

```sh
node scripts/rectangle-dialogue.mjs
node scripts/verify-rectangle-dialogue.mjs
node scripts/verify-option-buttons.mjs mblock-project/exports/沙漠绿色公益-长方形对话框-v044.mblock
node scripts/verify-levels.mjs mblock-project/exports/沙漠绿色公益-长方形对话框-v044.mblock
```

检查覆盖全部 154 个提示造型、五个题号标签、尺寸与四角形状、素材和积木引用。十关模拟中，222 条非空提示映射到正确的长方形造型，50 次正式题目显示与题号同步；选项、答错重试、原地等待及奖励流程通过检查。

已在本机 mBlock 中打开新版，确认长方形题干、框内题号和下方 A/B 按钮的实际显示，再通过界面「保存」操作保存项目。实际排版见 `assets/dialogue/v044/native-dialogue.png`，各类提示预览见同目录 `preview.png`，完整内容与造型映射见 `frames.json`。

# v026 放大烟花

项目：`exports/沙漠绿色公益-放大烟花-v026.mblock`。

通关烟花的大小从 100% 调整为 130%，位置从 (0, 0) 调整为 (0, -35)，使放大后的绽放效果保留在舞台范围内。继续使用原有透明 SVG 造型，最后一关全部植物长大后播放一次，结束后显示重新挑战按钮。

构建：`node scripts/enlarge-fireworks.mjs`。

验证：`node scripts/verify-levels.mjs 'mblock-project/exports/沙漠绿色公益-放大烟花-v026.mblock'`，十关流程及烟花触发、播放与重玩检查通过。

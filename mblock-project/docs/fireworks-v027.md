# v027 再次放大烟花

项目：`exports/沙漠绿色公益-更大烟花-v027.mblock`。

烟花大小从 130% 增加到 160%（相比上一版直径再增加约 23%），位置调整为 (0, -85)，为绽放时的上缘留出空间。保留最后一关全部植物长大后播放一次、结束后出现重新挑战按钮的逻辑。

构建：`node scripts/enlarge-fireworks.mjs v027`。

验证：`node scripts/verify-levels.mjs 'mblock-project/exports/沙漠绿色公益-更大烟花-v027.mblock'`。十关积木流程及烟花触发、播放与重玩检查通过。

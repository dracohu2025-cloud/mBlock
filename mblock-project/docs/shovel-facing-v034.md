# v034 铲面左右朝向修正

项目：`exports/沙漠绿色公益-铲面朝向修正-v034.mblock`。

根据用户确认，修正的是左右朝向。将铁铲 SVG 沿握点所在的 x=50 轴水平镜像，同时将 29 个造型对应的角度改为 180°−原角度，使摆动方向一起左右翻转。铲头仍在手下方，保留加长尺寸、手掌遮挡区、握点、逐帧跟随以及每关不同的音乐。

```sh
node scripts/flip-shovel-facing.mjs
node scripts/verify-shovel-grip.mjs 'mblock-project/exports/沙漠绿色公益-铲面朝向修正-v034.mblock'
node scripts/verify-levels.mjs 'mblock-project/exports/沙漠绿色公益-铲面朝向修正-v034.mblock'
```

构建时检查所有握点不变、所有角度水平镜像且铲头未上下颠倒，其他目标保持不变。本次原生 mBlock 操作工具不可用，项目已保存为新文件，未在应用内打开、点击保存或试玩。

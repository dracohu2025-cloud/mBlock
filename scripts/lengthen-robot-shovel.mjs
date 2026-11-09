import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import JSZip from 'jszip';

const zip=await JSZip.loadAsync(await fs.readFile('mblock-project/exports/沙漠绿色公益-题目避让标题-v029.mblock'));
const p=JSON.parse(await zip.file('project.json').async('string'));
const shovel=p.targets.find(t=>t.name==='机器人铁铲'),costume=shovel.costumes[0];
const old=await zip.file(costume.md5ext).async('string');
assert(old.includes('height="480" viewBox="0 0 100 480"'));
assert(old.includes('height="282"'));
// Add 120 units of shaft above the hand. Moving the pivot by the same amount
// leaves the blade, hand alignment, width and per-frame motion unchanged.
const bladeAt=old.indexOf('<path d="M23 349');assert(bladeAt>0);
const svg=old.slice(0,bladeAt)
 .replace('height="480" viewBox="0 0 100 480"','height="600" viewBox="0 0 100 600"')
 .replace('height="282"','height="402"')
 +'<g transform="translate(0 120)">'+old.slice(bladeAt).replace('</svg>','</g></svg>');
const hash=crypto.createHash('md5').update(svg).digest('hex');
zip.file(`${hash}.svg`,svg);
costume.assetId=hash;costume.md5ext=`${hash}.svg`;costume.rotationCenterY+=120;
await fs.writeFile('mblock-project/assets/props/robot-shovel-long-v030.svg',svg);
zip.file('project.json',JSON.stringify(p));
const output='mblock-project/exports/沙漠绿色公益-加长铁铲-v030.mblock';
await fs.writeFile(output,await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}}));
console.log(output);

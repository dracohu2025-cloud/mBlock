import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import JSZip from 'jszip';

const zip=await JSZip.loadAsync(await fs.readFile('mblock-project/exports/沙漠绿色公益-每关不同音乐-v033.mblock'));
const p=JSON.parse(await zip.file('project.json').async('string'));
const shovel=p.targets.find(t=>t.name==='机器人铁铲'),c=shovel.costumes[0];
assert.equal(c.rotationCenterX,50);assert.equal(c.rotationCenterY,280);
const before=structuredClone(p),old=await zip.file(c.md5ext).async('string');
const rootEnd=old.indexOf('>')+1;
// Reflect the face around the grip's x-coordinate, never turn it upside down.
const svg=old.slice(0,rootEnd)+'<g transform="translate(100 0) scale(-1 1)">'+old.slice(rootEnd).replace('</svg>','</g></svg>');
const hash=crypto.createHash('md5').update(svg).digest('hex');zip.file(`${hash}.svg`,svg);
c.assetId=hash;c.md5ext=`${hash}.svg`;
const mirror=angle=>((180-angle+180)%360+360)%360-180;
shovel.lists['shovel-angle'][1]=shovel.lists['shovel-angle'][1].map(mirror);
shovel.direction=mirror(shovel.direction);
// The same hand point is retained across all costumes and the saved pose.
const previous=before.targets.find(t=>t.name===shovel.name);
for(const field of ['shovel-X','shovel-Y'])assert.deepEqual(shovel.lists[field],previous.lists[field]);
for(let i=0;i<29;i++){
 const a=previous.lists['shovel-angle'][1][i],b=shovel.lists['shovel-angle'][1][i];
 assert(Math.abs(Math.sin((a-90)*Math.PI/180)+Math.sin((b-90)*Math.PI/180))<1e-9);
 assert(Math.cos((b-90)*Math.PI/180)>0,'Blade must remain below the hand');
}
assert.deepEqual(p.targets.filter(t=>t!==shovel),before.targets.filter(t=>t.name!==shovel.name));
await fs.writeFile('mblock-project/assets/props/robot-shovel-facing-v034.svg',svg);
zip.file('project.json',JSON.stringify(p));
const output='mblock-project/exports/沙漠绿色公益-铲面朝向修正-v034.mblock';
await fs.writeFile(output,await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}}));
console.log(output);

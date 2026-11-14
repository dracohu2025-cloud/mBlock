import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import sharp from 'sharp';
const file=process.argv[2]||'mblock-project/exports/沙漠绿色公益-握紧铁铲-v032.mblock';
const zip=await JSZip.loadAsync(await fs.readFile(file));
const p=JSON.parse(await zip.file('project.json').async('string'));
const robot=p.targets.find(t=>t.name==='蓝豆机器人'),shovel=p.targets.find(t=>t.name==='机器人铁铲');
assert.equal(shovel.layerOrder,robot.layerOrder+1);
for(const [i,c]of robot.costumes.entries()){
 const x=c.rotationCenterX+shovel.lists['shovel-X'][1][i]*2;
 const y=c.rotationCenterY-shovel.lists['shovel-Y'][1][i]*2;
 const data=await sharp(await zip.file(c.md5ext).async('nodebuffer')).extract({left:x,top:y,width:1,height:1}).raw().toBuffer();
 assert(data[3]>200&&data[2]>data[0]*1.5,`Grip ${i} must land on the opaque blue glove, got ${[...data]}`);
}
const c=shovel.costumes[0],svg=await zip.file(c.md5ext).async('string');
assert.equal(c.rotationCenterY,280);assert(svg.includes('mask="url(#hand-grip)"'));
assert(svg.includes('height="600"'));assert(svg.includes('height="402"'));
console.log(`PASS: all ${robot.costumes.length} hand anchors land on blue gloves; front shaft, finger occlusion and long-shovel geometry verified.`);

import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import sharp from 'sharp';
const file=process.argv[2]||'mblock-project/exports/沙漠绿色公益-无铲走路-v039.mblock';
const zip=await JSZip.loadAsync(await fs.readFile(file));
const base=await JSZip.loadAsync(await fs.readFile('mblock-project/exports/沙漠绿色公益-机器人走路-v037.mblock'));
const p=JSON.parse(await zip.file('project.json').async('string')),old=JSON.parse(await base.file('project.json').async('string'));
const robot=p.targets.find(t=>t.name==='蓝豆机器人'),original=old.targets.find(t=>t.name===robot.name);
const withoutShovel=!p.targets.some(t=>t.name==='机器人铁铲');
const manifest=JSON.parse(await fs.readFile(`mblock-project/assets/props/native-v0${withoutShovel?'39':'38'}/costumes.json`,'utf8'));
assert.equal(robot.costumes.length,37);
const seen=new Set();
for(const [i,c]of robot.costumes.entries()){
 const prior=manifest.frames[i].sourceCostume||original.costumes[i];assert.equal(c.name,prior.name);assert.equal(c.dataFormat,'png');assert.equal(c.bitmapResolution,2);
 assert.equal(c.rotationCenterX/2,prior.rotationCenterX);assert.equal(c.rotationCenterY/2,prior.rotationCenterY);
 if(seen.has(c.md5ext))continue;seen.add(c.md5ext);
 const bytes=await zip.file(c.md5ext).async('nodebuffer');assert.equal(crypto.createHash('md5').update(bytes).digest('hex'),c.assetId);
 const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(info.width,1766);assert.equal(info.height,1766);
 let sourceSvg=await base.file(prior.md5ext).async('string');
 if(withoutShovel){assert(sourceSvg.includes('data-hand-gap'));sourceSvg=sourceSvg.replace(/<svg (?=[^>]*data-hand-gap=)[\s\S]*?<\/svg>/,'');assert(!sourceSvg.includes('data-hand-gap'));}
 const before=await sharp(Buffer.from(sourceSvg),{density:144}).ensureAlpha().raw().toBuffer();
 let union=0,difference=0;for(let n=3;n<data.length;n+=4){const a=data[n]>128,b=before[n]>128;if(a||b)union++;if(a!==b)difference++;}
 assert(difference/union<.005,`${c.name}: silhouette changed during PNG export`);
 for(const [x,y]of [[0,0],[1765,0],[0,1765],[1765,1765]])assert.equal(data[(y*info.width+x)*4+3],0);
}
const structure=t=>({name:t.name,blocks:crypto.createHash('sha256').update(JSON.stringify(t.blocks)).digest('hex'),variables:Object.entries(t.variables).map(([id,[name]])=>({id,name})),lists:Object.entries(t.lists).map(([id,[name]])=>({id,name})),sounds:t.sounds.map(s=>({name:s.name,asset:s.md5ext}))});
const expected=manifest.sourceStructure||old.targets.map(structure);
assert.deepEqual(p.targets.map(structure),expected,'Game scripts/data schemas/sound assets must remain unchanged; runtime play state may differ');
for(const t of p.targets){
 for(const c of [...t.costumes,...t.sounds])assert(zip.file(c.md5ext),'Missing '+c.md5ext);
 for(const [id,b]of Object.entries(t.blocks)){
  for(const ref of [b.parent,b.next])if(ref)assert(t.blocks[ref],`${id}: broken ${ref}`);
  for(const a of Object.values(b.inputs||{}))for(const ref of a.slice(1))if(typeof ref==='string')assert(t.blocks[ref],`${id}: broken input ${ref}`);
 }
}
assert((await fs.stat(file)).size<40*1024*1024);
console.log(`PASS: 37 PNG costumes (${seen.size} unique) retain complete silhouettes, transparent borders and exact stage scale/pivots; ${withoutShovel?'shovel removed from all poses and sprite list; ':''}game scripts unchanged; assets/blocks valid; archive under 40 MiB.`);

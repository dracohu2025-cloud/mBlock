import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import sharp from 'sharp';
const file=process.argv[2]||'mblock-project/exports/沙漠绿色公益-长方形对话框-v044.mblock';
const zip=await JSZip.loadAsync(await fs.readFile(file));
const p=JSON.parse(await zip.file('project.json').async('string')),stage=p.targets.find(t=>t.isStage),panel=p.targets.find(t=>t.name==='题目显示锚点'),progress=p.targets.find(t=>t.name==='题号显示');
const frames=JSON.parse(await fs.readFile('mblock-project/assets/dialogue/v044/frames.json','utf8')),questions=JSON.parse(await fs.readFile('mblock-project/assets/buttons/v042/questions.json','utf8'));
assert.equal(panel.costumes.length,154);assert.equal(progress.costumes.length,5);
assert.equal(panel.x,70);assert.equal(panel.y,117);assert.equal(panel.size,100);
// The fixed panel ends below the level title and above planted-position robots.
assert(panel.y+25<146);assert(panel.y-25>88);assert(panel.x-150>=-240&&panel.x+150<=240);
assert.deepEqual(frames.slice(0,132).map(f=>f.text),questions.map(q=>q.question));
assert.deepEqual(['intro','correct','wrong','growth'].map(type=>frames.filter(f=>f.type===type).length),[10,10,1,1]);
for(const [i,c]of panel.costumes.entries()){
 assert.equal(c.dataFormat,'png');assert.equal(c.bitmapResolution,2);assert.equal(c.rotationCenterX,300);assert.equal(c.rotationCenterY,50);assert.equal(c.md5ext,frames[i].asset);
 const {data,info}=await sharp(await zip.file(c.md5ext).async('nodebuffer')).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(info.width,600);assert.equal(info.height,100);
 for(const [x,y]of [[2,2],[597,2],[2,97],[597,97]])assert(data[(y*600+x)*4+3]>240,'Panel must have solid rectangular corners');
}
for(const b of Object.values(panel.blocks))if(b.opcode==='looks_say')assert.equal(b.inputs.MESSAGE[1][1],'','Native bubble must only be cleared, never display text');
for(const t of p.targets){for(const c of [...t.costumes,...t.sounds])assert(zip.file(c.md5ext));for(const [id,b]of Object.entries(t.blocks)){
 for(const ref of [b.parent,b.next])if(ref)assert(t.blocks[ref],`${id}: missing ${ref}`);
 for(const a of Object.values(b.inputs||{}))for(const ref of a.slice(1))if(typeof ref==='string')assert(t.blocks[ref],`${id}: missing input ${ref}`);
}}
assert((await fs.stat(file)).size<40*1024*1024);
console.log('PASS: 154 rectangular PNG panels cover all 132 stems and 22 feedback messages; five progress labels, fixed safe geometry, no native text bubble, valid assets/blocks.');

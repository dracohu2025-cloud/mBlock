import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import sharp from 'sharp';

const file=process.argv[2]||'mblock-project/exports/沙漠绿色公益-种植稳固-v036.mblock';
const base=await JSZip.loadAsync(await fs.readFile('mblock-project/exports/沙漠绿色公益-手掌遮挡修正-v035.mblock'));
const zip=await JSZip.loadAsync(await fs.readFile(file));
const old=JSON.parse(await base.file('project.json').async('string'));
const p=JSON.parse(await zip.file('project.json').async('string'));
const robot=p.targets.find(t=>t.name==='蓝豆机器人'),shovel=p.targets.find(t=>t.name==='机器人铁铲');
const original=old.targets.find(t=>t.name===robot.name),prop=old.targets.find(t=>t.name===shovel.name);
assert(robot.costumes.length>=29);
assert.equal(shovel.visible,false);
assert(!Object.values(shovel.blocks).some(b=>b.opcode==='looks_show'||b.opcode==='control_forever'),'Separate prop must not drift behind the body');
assert.equal(robot.currentCostume,5);
const contacts=[],renders=new Map();
for(const [i,c]of robot.costumes.slice(0,29).entries()){
 assert.equal(c.dataFormat,'svg');assert.equal(c.bitmapResolution,1);
 const svg=await zip.file(c.md5ext).async('string');
 const embedded=svg.match(/xlink:href="data:image\/png;base64,([^"]+)"/);assert(embedded,'Missing lossless robot image');
 const pixels=Buffer.from(embedded[1],'base64');
 assert.deepEqual(pixels,await base.file(original.costumes[i].md5ext).async('nodebuffer'),'Robot artwork must remain byte-identical');
 const shape=await base.file(prop.costumes[i].md5ext).async('string');
 assert(svg.includes(shape.replace('<svg ','<svg x="-50" y="-280" ')),'Correct palm cutout and shovel facing must be embedded');
 const ox=original.costumes[i].rotationCenterX+prop.lists['shovel-X'][1][i]*2;
 const oy=original.costumes[i].rotationCenterY-prop.lists['shovel-Y'][1][i]*2;
 assert(svg.includes(`translate(${ox} ${oy}) rotate(${prop.lists['shovel-angle'][1][i]-90})`));
 if(!renders.has(c.md5ext)){
  const {data,info}=await sharp(Buffer.from(svg),{density:144}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(info.width,1766);assert.equal(info.height,1766);
  for(const [x,y]of [[0,0],[1765,0],[0,1765],[1765,1765]])assert.equal(data[(y*info.width+x)*4+3],0,'Canvas must stay transparent');
  renders.set(c.md5ext,true);
 }
 if(i>=5){
  // Measure the soles from the embedded image pixels, rather than trusting
  // the build manifest or using the moving antenna as a registration point.
  const {data,info}=await sharp(pixels).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let bottom=-1,left=info.width,right=-1;
  for(let y=info.height-1;y>1080&&bottom<0;y--)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>200){bottom=y;break;}
  assert(bottom>1080);
  for(let y=bottom-70;y<=bottom;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>200){left=Math.min(left,x);right=Math.max(right,x);}
  contacts.push({x:((left+right)/2+256-c.rotationCenterX*2)*robot.size/200,y:(bottom+256-c.rotationCenterY*2)*robot.size/200});
 }
}
for(const axis of ['x','y']){
 const values=contacts.map(c=>c[axis]),span=Math.max(...values)-Math.min(...values);
 assert(span<.5,`Soles slide ${span.toFixed(2)} stage pixels along ${axis}`);
}
const idleSwitches=Object.values(robot.blocks).filter(b=>b.opcode==='looks_switchcostumeto'&&b.inputs.COSTUME?.[0]===1);
assert(idleSwitches.some(b=>b.inputs.COSTUME[1][1]==='种树24-01'));
assert(!idleSwitches.some(b=>b.inputs.COSTUME[1][1]==='蓝豆机器人'),'Idle/plant transition must not jump to unrelated artwork');
assert.equal(robot.blocks['kMf?r6vj7hG7u/]H6}yD'].inputs.TIMES[1][1],'24');
assert.equal(Number(robot.blocks['7Ywd6iMbEl9/8Cz{5I0d'].inputs.DURATION[1][1]),1/24);
// Walking extends v036. Compare unrelated targets against that immediate
// baseline; older exports may have since been re-saved independently in App.
const comparison=robot.lists['walk-poses']?JSON.parse(await (await JSZip.loadAsync(await fs.readFile('mblock-project/exports/沙漠绿色公益-种植稳固-v036.mblock'))).file('project.json').async('string')):old;
for(const t of p.targets)if(![robot.name,shovel.name].includes(t.name))assert(JSON.stringify(t)===JSON.stringify(comparison.targets.find(o=>o.name===t.name)),`${t.name} changed unexpectedly relative to baseline`);
if(robot.lists['walk-poses']){
 assert.equal(robot.costumes.length,37);
 assert.deepEqual(robot.costumes.slice(0,29),comparison.targets.find(t=>t.name===robot.name).costumes,'Planting artwork/pivots must remain unchanged');
 const upper=[],lower=[];
 for(const c of robot.costumes.slice(29)){
  assert.equal(c.rotationCenterX,robot.costumes[5].rotationCenterX);assert.equal(c.rotationCenterY,robot.costumes[5].rotationCenterY);
  const image=await zip.file(c.md5ext).async('nodebuffer');
  const raster=await sharp(image).ensureAlpha().png().toBuffer();
  upper.push(await sharp(raster).extract({left:100,top:140,width:700,height:430}).raw().toBuffer());
  lower.push((await sharp(raster).extract({left:350,top:590,width:360,height:170}).raw().toBuffer()).toString('base64'));
  assert.equal((await sharp(raster).extract({left:0,top:0,width:1,height:1}).raw().toBuffer())[3],0);
 }
 for(const pixels of upper)assert.deepEqual(pixels,upper[0],'Walking must keep the upper body and held shovel registered');
 assert(new Set(lower).size>=6,'Walking must actually change the leg poses');
 console.log('PASS walking artwork: eight costumes, alternating legs, fixed upper body/shovel, transparent canvas and unchanged planting costumes.');
}
for(const t of p.targets){
 for(const c of [...t.costumes,...t.sounds])assert(zip.file(c.md5ext),'Missing '+c.md5ext);
 for(const [id,b]of Object.entries(t.blocks)){
  for(const ref of [b.parent,b.next])if(ref)assert(t.blocks[ref],`${id}: broken block link ${ref}`);
  for(const a of Object.values(b.inputs||{}))for(const ref of a.slice(1))if(typeof ref==='string')assert(t.blocks[ref],`${id}: broken input ${ref}`);
 }
}
assert((await fs.stat(file)).size<40*1024*1024);
console.log('PASS: 24 registered planting frames, sole drift below 0.5 stage pixels, matching idle, and atomic body/shovel poses.');
console.log(`PASS: ${renders.size} SVGs rasterize with transparent borders; original PNG bytes, palm cutouts, shovel facing/length, game targets and assets preserved; archive below 40 MiB.`);

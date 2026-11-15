import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import sharp from 'sharp';

// mBlock's SVG import changes nested SVG/use/clipPath geometry. Flatten the
// established vector costumes to transparent bitmaps before handing them to App.
const source='mblock-project/exports/沙漠绿色公益-机器人走路-v037.mblock';
const withoutShovel=!process.argv.includes('--keep-shovel');
const output=withoutShovel?'mblock-project/exports/沙漠绿色公益-无铲走路-v039.mblock':'mblock-project/exports/沙漠绿色公益-完整走路造型-v038.mblock';
const root=withoutShovel?'mblock-project/assets/props/native-v039':'mblock-project/assets/props/native-v038';
await fs.mkdir(root,{recursive:true});
const zip=await JSZip.loadAsync(await fs.readFile(source));
const p=JSON.parse(await zip.file('project.json').async('string'));
const robot=p.targets.find(t=>t.name==='蓝豆机器人');
const alignment=JSON.parse(await fs.readFile('mblock-project/assets/props/stable-v036/alignment.json','utf8'));
const structure=t=>({name:t.name,blocks:crypto.createHash('sha256').update(JSON.stringify(t.blocks)).digest('hex'),variables:Object.entries(t.variables).map(([id,[name]])=>({id,name})),lists:Object.entries(t.lists).map(([id,[name]])=>({id,name})),sounds:t.sounds.map(s=>({name:s.name,asset:s.md5ext}))});
const sourceStructure=p.targets.filter(t=>!withoutShovel||t.name!=='机器人铁铲').map(structure);
const cache=new Map(),replaced=new Set(),manifest=[];
for(const [i,c]of robot.costumes.entries()){
 const old=c.md5ext;assert.equal(c.dataFormat,'svg');
 if(!cache.has(old)){
  let svg=await zip.file(old).async('string');
  if(withoutShovel){
   const pose=alignment.frames[i<29?i:5],marker=`<g transform="translate(${pose.grip.x} ${pose.grip.y}) rotate(${pose.angle-90})">`;
   const start=svg.indexOf(marker),end=svg.indexOf('</svg></g>',start);assert(start>=0&&end>=0,`Shovel missing in ${c.name}`);
   svg=svg.slice(0,start)+svg.slice(end+'</svg></g>'.length);
   assert(!svg.includes('data-hand-gap'),'Shovel geometry must be removed entirely');
  }
  const png=await sharp(Buffer.from(svg),{density:144}).png({palette:true,colours:256,effort:10}).toBuffer();
  const meta=await sharp(png).metadata();assert.equal(meta.width,1766);assert.equal(meta.height,1766);assert(meta.hasAlpha);
  const hash=crypto.createHash('md5').update(png).digest('hex');
  zip.file(`${hash}.png`,png);await fs.writeFile(`${root}/${hash}.png`,png);
  cache.set(old,{assetId:hash,md5ext:`${hash}.png`});
 }
 const sourceCostume=structuredClone(c);
 Object.assign(c,cache.get(old),{dataFormat:'png',bitmapResolution:2,rotationCenterX:c.rotationCenterX*2,rotationCenterY:c.rotationCenterY*2});
 replaced.add(old);manifest.push({index:i,name:c.name,source:old,sourceCostume,asset:c.md5ext});
}
if(withoutShovel)p.targets=p.targets.filter(t=>t.name!=='机器人铁铲');
const referenced=new Set(p.targets.flatMap(t=>[...t.costumes,...t.sounds].map(a=>a.md5ext)));
for(const file of replaced)if(!referenced.has(file))zip.remove(file);
zip.file('project.json',JSON.stringify(p));
const archive=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}});assert(archive.length<40*1024*1024);
await fs.writeFile(output,archive);await fs.writeFile(`${root}/costumes.json`,JSON.stringify({source,output,withoutShovel,sourceStructure,frames:manifest},null,2)+'\n');
console.log(`${output}: ${robot.costumes.length} complete PNG costumes, ${cache.size} unique images, ${archive.length} bytes.`);

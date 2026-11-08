import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import JSZip from 'jszip';

const root='mblock-project/assets/deserts/v024';
const scenes=JSON.parse(await fs.readFile(`${root}/deserts.json`,'utf8'));
assert.equal(scenes.length,10);
const zip=await JSZip.loadAsync(await fs.readFile('mblock-project/exports/沙漠绿色公益-十种植物-v023.mblock'));
const p=JSON.parse(await zip.file('project.json').async('string'));
const beforeSprites=structuredClone(p.targets.filter(t=>!t.isStage));
const stage=p.targets.find(t=>t.isStage),b=stage.blocks;
const variable=(name,id)=>[2,[12,name,id]];
const mk=(opcode,parent,next,inputs={},fields={})=>({opcode,parent,next,inputs,fields,shadow:false,topLevel:false});
stage.costumes=[];
const thumbnails=[];
for(const [i,s]of scenes.entries()){
  assert.equal(s.level,i+1);
  const png=await sharp(`${root}/sources/${s.slug}.png`).resize(960,720,{fit:'fill'}).removeAlpha().png().toBuffer();
  const hash=crypto.createHash('md5').update(png).digest('hex');
  await fs.writeFile(`${root}/${s.slug}.png`,png);zip.file(`${hash}.png`,png);
  stage.costumes.push({name:s.name,bitmapResolution:2,dataFormat:'png',assetId:hash,md5ext:`${hash}.png`,rotationCenterX:480,rotationCenterY:360});
  const x=(i%5)*320,y=Math.floor(i/5)*270;
  thumbnails.push({input:await sharp(png).resize(320,240).png().toBuffer(),left:x,top:y});
  const label=Buffer.from(`<svg width="320" height="30"><rect width="320" height="30" fill="#f5f0e6"/><text x="160" y="22" text-anchor="middle" font-family="PingFang SC,Microsoft YaHei,sans-serif" font-size="18" fill="#254b43">${s.level} · ${s.name}</text></svg>`);
  thumbnails.push({input:label,left:x,top:y+240});
}
assert.equal(new Set(stage.costumes.map(c=>c.assetId)).size,10);
stage.currentCostume=0;
stage.lists['game-desert-names']=['关卡沙漠名称',scenes.map(s=>s.name)];
stage.variables['game-desert-name']=['本关沙漠',scenes[0].name];
// Select before starting this round's scripts. The same path runs on retry,
// so the level's backdrop remains stable when an answer is wrong.
for(const previous of ['levels-38-plant-name','retry-reset-7-plant-name']){
  const next=b[previous].next,id=`${previous}-desert`;
  b[previous].next=id;b[next].parent=`${id}-switch`;
  b[id]=mk('data_setvariableto',previous,`${id}-switch`,{VALUE:[2,`${id}-item`]},{VARIABLE:['本关沙漠','game-desert-name']});
  b[`${id}-item`]=mk('data_itemoflist',id,null,{INDEX:variable('当前关卡','game-level')},{LIST:['关卡沙漠名称','game-desert-names']});
  b[`${id}-switch`]=mk('looks_switchbackdropto',id,next,{BACKDROP:variable('当前关卡','game-level')});
}
// Export with no saved answers enabled; keep the first scene as the idle image.
for(const id of ['game-phase','game-next','quiz-click-ready','%z6KO!=AV03bkJsGH`QJ','mature-tree-count','saxaul-landed-count','seedling-handoff-completed'])stage.variables[id][1]=0;
stage.variables['game-level'][1]=1;stage.variables['quiz-click-choice'][1]='';
assert.deepEqual(p.targets.filter(t=>!t.isStage),beforeSprites);
for(const t of p.targets)for(const [id,x]of Object.entries(t.blocks)){
  for(const k of ['next','parent'])if(x[k])assert(t.blocks[x[k]],`${t.name}:${id}.${k}`);
  for(const input of Object.values(x.inputs||{}))for(const ref of input.slice(1))if(typeof ref==='string')assert(t.blocks[ref],`${t.name}:${id} input ${ref}`);
}
await sharp({create:{width:1600,height:540,channels:3,background:'#f5f0e6'}}).composite(thumbnails).png().toFile(`${root}/preview.png`);
zip.file('project.json',JSON.stringify(p));
const output='mblock-project/exports/沙漠绿色公益-十种沙漠-v024.mblock';
await fs.writeFile(output,await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}}));
console.log(`${output}: ten distinct automatic backdrops; sprites and question bank preserved.`);

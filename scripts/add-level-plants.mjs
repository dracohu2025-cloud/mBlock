import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import JSZip from 'jszip';

const root = 'mblock-project/assets/plants/v023';
const plants = JSON.parse(await fs.readFile(`${root}/plants.json`, 'utf8'));
const zip = await JSZip.loadAsync(await fs.readFile('mblock-project/exports/沙漠绿色公益-十关挑战-v022.mblock'));
const p = JSON.parse(await zip.file('project.json').async('string'));
const stage = p.targets.find(t => t.isStage), robot = p.targets.find(t => t.name === '蓝豆机器人');
const trees = p.targets.filter(t => /^梭梭树[1-5]$/.test(t.name));
assert.equal(trees.length, 5);assert.equal(plants.length, 10);
const num = n => [1,[4,String(n)]], str = s => [1,[10,s]];
const variable = (name,id) => [2,[12,name,id]];
const mk = (opcode,parent,next,inputs={},fields={}) => ({opcode,parent,next,inputs,fields,shadow:false,topLevel:false});
stage.variables['game-plant-name'] = ['本关植物',plants[0].name];
stage.lists['game-plant-names'] = ['关卡植物名称',plants.map(x=>x.name)];

// Sprite-sheet extraction and consistent bitmap packaging only: preserve the
// generated artwork and its alpha; never synthesize a new background or mask.
async function bounds(buffer) {
  const {data,info} = await sharp(buffer).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let left=info.width,top=info.height,right=-1,bottom=-1;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>16){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  assert(right>=left,'Empty plant');
  return {left,top,width:right-left+1,height:bottom-top+1};
}
async function splitSheet(file) {
  const {data,info} = await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const columns = Array(info.width).fill(0);
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>16)columns[x]++;
  // Some wide shrubs extend across the nominal half-cell: split at the actual
  // transparent gutter, not at width/2 (which could cut branches).
  let best={start:0,length:0},start=-1;
  for(let x=Math.floor(info.width*.28);x<Math.floor(info.width*.64);x++){
    if(!columns[x]){if(start<0)start=x;if(x-start+1>best.length)best={start,length:x-start+1};}else start=-1;
  }
  assert(best.length>8,`No clear gutter: ${file}`);
  const split=best.start+Math.floor(best.length/2);
  return Promise.all([{left:0,top:0,width:split,height:info.height},{left:split,top:0,width:info.width-split,height:info.height}].map(r=>sharp(file).extract(r).png().toBuffer()));
}
async function costume(buffer,plant,phase) {
  const box=await bounds(buffer);
  const cropped=await sharp(buffer).extract(box).png().toBuffer();
  const {data,info}=await sharp(cropped).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let sum=0,count=0;
  for(let y=Math.max(0,info.height-8);y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>80){sum+=x;count++;}
  const baseX=count?sum/count:info.width/2;
  const scale=Math.min((phase==='幼苗'?900:1050)/info.height,(phase==='幼苗'?850:740)/info.width);
  const w=Math.round(info.width*scale),h=Math.round(info.height*scale);
  const bitmap=await sharp(cropped).resize(w,h).png().toBuffer();
  const left=Math.round(600-baseX*scale),top=1320-h;
  assert(left>=0&&left+w<=1200,`Plant exceeds canvas: ${plant.name}`);
  const png=await sharp({create:{width:1200,height:1400,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:bitmap,left,top}]).png().toBuffer();
  const file=`${plant.slug}-${phase==='幼苗'?'seedling':'mature'}.png`;
  await fs.writeFile(`${root}/${file}`,png);
  const hash=crypto.createHash('md5').update(png).digest('hex');zip.file(`${hash}.png`,png);
  return {name:`${phase}-${plant.name}`,bitmapResolution:2,dataFormat:'png',assetId:hash,md5ext:`${hash}.png`,rotationCenterX:600,rotationCenterY:1320};
}
const allCostumes=[];
for(const plant of plants){
  const pair=plant.level===1?await Promise.all(trees[0].costumes.map(c=>zip.file(c.md5ext).async('nodebuffer'))):await splitSheet(`${root}/sheets/${plant.slug}.png`);
  allCostumes.push(await costume(pair[0],plant,'幼苗'),await costume(pair[1],plant,'成熟'));
}
for(const [i,tree] of trees.entries()){
  tree.name=`植物${i+1}`;tree.costumes=structuredClone(allCostumes);tree.currentCostume=0;tree.visible=false;tree.y=-120;tree.size=10;
  const b=tree.blocks;
  const switches=Object.entries(b).filter(([,x])=>x.opcode==='looks_switchcostumeto');
  assert.equal(switches.length,2);
  for(const [id,x] of switches){
    const menu=b[x.inputs.COSTUME[1]];
    const mature=menu.fields.COSTUME[0]==='成熟梭梭树';
    delete b[x.inputs.COSTUME[1]];
    x.inputs.COSTUME=[2,`plant-index-${mature?'mature':'seedling'}`];
    const index=`plant-index-${mature?'mature':'seedling'}`,multiple=`${index}-multiple`;
    b[index]=mk('operator_add',id,null,{NUM1:[2,multiple],NUM2:num(mature?0:-1)});
    b[multiple]=mk('operator_multiply',index,null,{NUM1:variable('当前关卡','game-level'),NUM2:num(2)});
  }
}

// Both initial setup and retry use the current level's name; plant sprites use
// the level number directly, so a retry cannot retain the previous species.
function insertNameSetter(before) {
  const id=`${before}-plant-name`,next=stage.blocks[before].next;
  stage.blocks[before].next=id;stage.blocks[next].parent=id;
  stage.blocks[id]=mk('data_setvariableto',before,next,{VALUE:[2,`${id}-item`]},{VARIABLE:['本关植物','game-plant-name']});
  stage.blocks[`${id}-item`]=mk('data_itemoflist',id,null,{INDEX:variable('当前关卡','game-level')},{LIST:['关卡植物名称','game-plant-names']});
}
insertNameSetter('levels-38');insertNameSetter('retry-reset-7');
const rb=robot.blocks;
const success='t3ZSP(;.)(44vk30FE,/';rb[success].inputs.MESSAGE=[2,'planted-species-prefix'];
rb['planted-species-prefix']=mk('operator_join',success,null,{STRING1:str('答对啦，种下一株'),STRING2:[2,'planted-species-suffix']});
rb['planted-species-suffix']=mk('operator_join','planted-species-prefix',null,{STRING1:variable('本关植物','game-plant-name'),STRING2:str('！')});
const intro='4rD6{QA8,rj~wYBe`B^I';rb[intro].inputs.MESSAGE=[2,'plant-intro'];
rb['plant-intro']=mk('operator_join',intro,null,{STRING1:variable('本关植物','game-plant-name'),STRING2:str('：连续答对5题种满本关，答错从第1题重来。')});
rb['|-5),{ApSaAR=5Ln%l}x'].inputs.MESSAGE=str('本关5株植物已种好！等待它们长大后继续挑战。');
rb.desert_93_q.inputs.VALUE[1][1]=rb.desert_93_q.inputs.VALUE[1][1].replace('梭梭树苗','植物幼苗');
const hud=p.targets.find(t=>t.name==='关卡标题');hud.costumes=[];hud.currentCostume=0;
await fs.mkdir(`${root}/titles`,{recursive:true});
for(const plant of plants){
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="310" height="32"><rect x="1" y="1" width="308" height="30" rx="12" fill="#216b8c" stroke="white" stroke-width="2"/><text x="155" y="22" text-anchor="middle" font-family="PingFang SC,Microsoft YaHei,sans-serif" font-size="16" font-weight="bold" fill="white">第${plant.level}/10关 · 种植${plant.name}</text></svg>`;
  const hash=crypto.createHash('md5').update(svg).digest('hex');zip.file(`${hash}.svg`,svg);await fs.writeFile(`${root}/titles/level-${plant.level}.svg`,svg);
  hud.costumes.push({name:`level-${plant.level}`,dataFormat:'svg',assetId:hash,md5ext:`${hash}.svg`,rotationCenterX:155,rotationCenterY:16});
}
for(const id of ['game-phase','game-next','quiz-click-ready','%z6KO!=AV03bkJsGH`QJ','mature-tree-count','saxaul-landed-count','seedling-handoff-completed'])stage.variables[id][1]=0;
stage.variables['game-level'][1]=1;stage.variables['quiz-click-choice'][1]='';
for(const t of p.targets.filter(t=>/^答案[AB]$/.test(t.name)||t.name==='关卡继续按钮'))t.visible=false;
for(const t of p.targets)for(const [id,b]of Object.entries(t.blocks)){
  for(const k of ['next','parent'])if(b[k])assert(t.blocks[b[k]],`${t.name}:${id}.${k}`);
  for(const input of Object.values(b.inputs||{}))for(const ref of input.slice(1))if(typeof ref==='string')assert(t.blocks[ref],`${t.name}:${id} input ${ref}`);
}
zip.file('project.json',JSON.stringify(p));
const output='mblock-project/exports/沙漠绿色公益-十种植物-v023.mblock';
await fs.writeFile(output,await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}}));
console.log(output);

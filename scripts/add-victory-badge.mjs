import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import sharp from 'sharp';

const assets='mblock-project/assets/badge/v028';
await fs.mkdir(assets,{recursive:true});
const zip=await JSZip.loadAsync(await fs.readFile('mblock-project/exports/沙漠绿色公益-更大烟花-v027.mblock'));
const p=JSON.parse(await zip.file('project.json').async('string'));
const stage=p.targets.find(t=>t.isStage),b=stage.blocks;
assert(!p.targets.some(t=>t.name==='通关徽章'));
assert.equal(b['fireworks-wait'].next,null);
const mk=(opcode,parent,next,inputs={},fields={})=>({opcode,parent,next,inputs,fields,shadow:false,topLevel:false});
stage.broadcasts['victory-badge']='颁发通关徽章';
b['fireworks-wait'].next='badge-award';
b['badge-award']=mk('event_broadcast','fireworks-wait',null,{BROADCAST_INPUT:[1,[11,'颁发通关徽章','victory-badge']]});

// Render the lettering once so the medal looks identical on different machines.
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
<defs><linearGradient id="gold" x2="0.8" y2="1"><stop stop-color="#fff3b0"/><stop offset=".48" stop-color="#f6c958"/><stop offset="1" stop-color="#d78c24"/></linearGradient><linearGradient id="green" x2="0" y2="1"><stop stop-color="#237c65"/><stop offset="1" stop-color="#124e43"/></linearGradient></defs>
<path d="M56 121 43 181 67 171 82 188 94 133M106 133 118 188 133 171 157 181 144 121" fill="#249b79" stroke="#0e6957" stroke-width="3" stroke-linejoin="round"/>
<path d="m63 139-10 33m83-33 10 33" stroke="#a5ecd0" stroke-width="4"/>
<circle cx="100" cy="83" r="69" fill="url(#gold)" stroke="#b77b25" stroke-width="3"/>
<circle cx="100" cy="83" r="60" fill="url(#green)" stroke="#fff0a0" stroke-width="3"/>
<circle cx="100" cy="83" r="53" fill="none" stroke="#e2bf62" stroke-width="1" stroke-dasharray="2 4"/>
<path d="M99 96V65m0 18-17-12m17 4 17-14" fill="none" stroke="#f8df8a" stroke-width="5" stroke-linecap="round"/>
<path d="M98 72C79 77 69 62 72 48c18-1 28 9 26 24M101 64c-2-19 11-30 27-28 0 17-11 29-27 28M98 85C80 90 73 80 74 70c13-2 23 3 24 15M104 80c-1-14 9-22 22-21 0 13-9 22-22 21" fill="#a4e09a" stroke="#e8f5af" stroke-width="1.5"/>
<path d="M73 102q27-14 54 0" fill="none" stroke="#edcf7a" stroke-width="4" stroke-linecap="round"/>
<text x="100" y="123" text-anchor="middle" font-family="PingFang SC, sans-serif" font-size="12" font-weight="600" fill="#fff3b5">十关通关</text>
<path d="M15 133q85-15 170 0v32q-85-14-170 0Z" fill="#fff0c1" stroke="#b88632" stroke-width="2.5"/>
<text x="100" y="153" text-anchor="middle" font-family="PingFang SC, sans-serif" font-size="16" font-weight="700" fill="#175e4d">沙漠绿洲守护者</text>
<path d="m24 40 3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1Zm151-16 2 5 6 1-5 4 2 6-5-3-6 3 2-6-5-4 6-1Z" fill="#ffe398" stroke="#b88632" stroke-width="1"/>
</svg>`;
await fs.writeFile(`${assets}/badge.svg`,svg);
const png=await sharp(Buffer.from(svg),{density:144}).png().toBuffer();
await fs.writeFile(`${assets}/badge.png`,png);
const hash=crypto.createHash('md5').update(png).digest('hex');zip.file(`${hash}.png`,png);
const badge={...structuredClone(p.targets.find(t=>t.name==='关卡继续按钮')),name:'通关徽章',blocks:{},variables:{},lists:{},broadcasts:{},comments:{},costumes:[{name:'沙漠绿洲守护者',dataFormat:'png',bitmapResolution:2,assetId:hash,md5ext:`${hash}.png`,rotationCenterX:200,rotationCenterY:200}],sounds:[],currentCostume:0,visible:false,x:0,y:25,size:100,rotationStyle:"don't rotate",layerOrder:Math.max(...p.targets.map(t=>t.layerOrder))+1};
const bb=badge.blocks;
for(const [id,opcode,fields]of [['badge-flag','event_whenflagclicked',{}],['badge-round','event_whenbroadcastreceived',{BROADCAST_OPTION:['开始关卡','level-start']}]] ){
 bb[id]={...mk(opcode,null,`${id}-hide`,{},fields),topLevel:true,x:40,y:id==='badge-flag'?40:210};
 bb[`${id}-hide`]=mk('looks_hide',id,null);
}
bb['badge-received']={...mk('event_whenbroadcastreceived',null,'badge-show',{}, {BROADCAST_OPTION:['颁发通关徽章','victory-badge']}),topLevel:true,x:400,y:40};
bb['badge-show']=mk('looks_show','badge-received','badge-await-replay');
bb['badge-await-replay']=mk('control_wait_until','badge-show','badge-hide',{CONDITION:[2,'badge-is-replaying']});
bb['badge-is-replaying']=mk('operator_equals','badge-await-replay',null,{OPERAND1:[2,[12,'关卡状态','game-phase']],OPERAND2:[1,[4,'0']]});
bb['badge-hide']=mk('looks_hide','badge-await-replay',null);
p.targets.push(badge);
for(const t of p.targets)for(const [id,block]of Object.entries(t.blocks)){
 for(const key of ['next','parent'])if(block[key])assert(t.blocks[block[key]],`${t.name}:${id}.${key}`);
 for(const input of Object.values(block.inputs||{}))for(const ref of input.slice(1))if(typeof ref==='string')assert(t.blocks[ref],`${t.name}:${id} input ${ref}`);
}
zip.file('project.json',JSON.stringify(p));
const output='mblock-project/exports/沙漠绿色公益-通关徽章-v028.mblock';
await fs.writeFile(output,await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}}));
console.log(output);

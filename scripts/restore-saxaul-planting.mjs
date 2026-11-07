import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
const src='mblock-project/exports/沙漠绿色公益-苗木衔接-v011.mblock';
const base=await JSZip.loadAsync(await fs.readFile('mblock-project/exports/沙漠绿色公益-适中梭梭树-v010.mblock'));
const zip=await JSZip.loadAsync(await fs.readFile(src));
const p=JSON.parse(await zip.file('project.json').async('string'));
const old=JSON.parse(await base.file('project.json').async('string'));
const robot=p.targets.find(t=>t.name==='蓝豆机器人'), blocks=robot.blocks;
const clean=robot.costumes.slice(5,11).map(c=>structuredClone(c));
assert.deepEqual(clean.map(c=>c.name),Array.from({length:6},(_,i)=>`种树24-0${i+1}`));
// Six existing clean poses, held for two ticks each while crouching and rising.
// Playback remains 24 ticks per second; no new raster artwork is synthesized.
const order=[0,0,1,1,2,2,3,3,4,4,5,5,5,5,4,4,3,3,2,2,1,1,0,0];
for(let i=0;i<24;i++)robot.costumes[5+i]={...structuredClone(clean[order[i]]),name:`种树24-${String(i+1).padStart(2,'0')}`};
const stage=p.targets.find(t=>t.isStage), vid='saxaul-landed-count', vname='已落苗数';
stage.variables[vid]=[vname,0];
const reset='saxaul-reset-landed', predecessor='seedling-handoff-reset';
const next=blocks[predecessor].next;blocks[predecessor].next=reset;blocks[next].parent=reset;
const block=(opcode,parent,next,inputs={},fields={})=>({opcode,parent,next,inputs,fields,shadow:false,topLevel:false});
blocks[reset]=block('data_setvariableto',predecessor,next,{VALUE:[1,[4,'0']]},{VARIABLE:[vname,vid]});
// Reveal the actual saxaul at the bottom of the crouch, before the robot rises.
const wait='7Ywd6iMbEl9/8Cz{5I0d', check='saxaul-reveal-check', cond='saxaul-reveal-cond', reveal='saxaul-reveal';
const increment=blocks[wait].next;blocks[wait].next=check;blocks[increment].parent=check;
blocks[check]=block('control_if',wait,increment,{CONDITION:[2,cond],SUBSTACK:[2,reveal]});
blocks[cond]=block('operator_equals',check,null,{OPERAND1:[2,[12,'种植动画帧','rUg.tg,nrNc5f~Tx4s@]']],OPERAND2:[1,[4,'17']]});
blocks[reveal]=block('data_setvariableto',check,null,{VALUE:[2,[12,'已种树数','%z6KO!=AV03bkJsGH`QJ']]},{VARIABLE:[vname,vid]});
let count=0;
for(const tree of p.targets.filter(t=>/^梭梭树[1-5]$/.test(t.name))){
 const original=old.targets.find(t=>t.name===tree.name).costumes[0];tree.costumes[0]=structuredClone(original);
 zip.file(original.md5ext,await base.file(original.md5ext).async('nodebuffer'));
 // First wait gates visibility; later wait still gates maturity on completed animation.
 const show=Object.values(tree.blocks).find(b=>b.opcode==='looks_show');
 const waiting=tree.blocks[show.parent], condition=tree.blocks[waiting.inputs.CONDITION[1]];
 condition.inputs.OPERAND1=[2,[12,vname,vid]];count++;
}
assert.equal(count,5);
assert.equal(Object.keys(blocks).filter(k=>/^desert_\d+_q$/.test(k)).length,30);
zip.file('project.json',JSON.stringify(p));
const out='mblock-project/exports/沙漠绿色公益-恢复梭梭树苗-v012.mblock';
await fs.writeFile(out,await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}}));
console.log(out);

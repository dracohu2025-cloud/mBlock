import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
const zip=await JSZip.loadAsync(await fs.readFile('mblock-project/exports/沙漠绿色公益-纯沙漠背景-v016.mblock'));
const p=JSON.parse(await zip.file('project.json').async('string'));
const stage=p.targets.find(t=>t.isStage), robot=p.targets.find(t=>t.name==='蓝豆机器人');
const chosen='quiz-click-choice',ready='quiz-click-ready';
stage.variables[chosen]=['所选答案',''];stage.variables[ready]=['等待选择',0];
const mk=(opcode,parent,next,inputs={},fields={})=>({opcode,parent,next,inputs,fields,shadow:false,topLevel:false});
const lit=v=>[1,[10,String(v)]],num=v=>[1,[4,String(v)]],variable=(id,name)=>[2,[12,name,id]];
const set=(id,name,value,parent,next)=>mk('data_setvariableto',parent,next,{VALUE:value},{VARIABLE:[name,id]});
const rb=robot.blocks;
// Reset input state in the same script that owns the questions.
const start='_c,*I4M=%Y5dq%kq0.sj', oldNext=rb[start].next;
rb[start].next='quiz-reset-choice';rb[oldNext].parent='quiz-reset-ready';
rb['quiz-reset-choice']=set(chosen,'所选答案',lit(''),start,'quiz-reset-ready');
rb['quiz-reset-ready']=set(ready,'等待选择',num(0),'quiz-reset-choice',oldNext);
for(const [id,b] of Object.entries(rb)){
 if(b.opcode==='sensing_askandwait'){
  const next=b.next,parent=b.parent,question=b.inputs.QUESTION;
  rb[id]=mk('looks_say',parent,id+'-clear',{MESSAGE:question});
  rb[id+'-clear']=set(chosen,'所选答案',lit(''),id,id+'-enable');
  rb[id+'-enable']=set(ready,'等待选择',num(1),id+'-clear',id+'-wait');
  rb[id+'-wait']=mk('control_wait_until',id+'-enable',next,{CONDITION:[2,id+'-has-choice']});
  rb[id+'-has-choice']=mk('operator_not',id+'-wait',null,{OPERAND:[2,id+'-empty']});
  rb[id+'-empty']=mk('operator_equals',id+'-has-choice',null,{OPERAND1:variable(chosen,'所选答案'),OPERAND2:lit('')});
  if(next)rb[next].parent=id+'-wait';
 } else if(b.opcode==='sensing_answer')rb[id]=mk('data_variable',b.parent,null,{}, {VARIABLE:['所选答案',chosen]});
}
function replaceText(value){
 if(Array.isArray(value))return value.map(replaceText);
 if(value&&typeof value==='object'){for(const k of Object.keys(value))value[k]=replaceText(value[k]);return value;}
 return typeof value==='string'?value.replaceAll('（输入 A 或 B）','（点击下方 A 或 B）'):value;
}
replaceText(rb);
for(const v of Object.values(robot.variables))if(typeof v[1]==='string')v[1]=v[1].replaceAll('（输入 A 或 B）','（点击下方 A 或 B）');
const maxLayer=Math.max(...p.targets.map(t=>t.layerOrder||0));
for(const [i,letter] of ['A','B'].entries()){
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="44" viewBox="0 0 100 44"><rect x="2" y="4" width="96" height="38" rx="14" fill="#12618a"/><rect x="2" y="1" width="96" height="38" rx="14" fill="${letter==='A'?'#168be8':'#23a76b'}" stroke="white" stroke-width="2"/><text x="50" y="29" text-anchor="middle" font-family="Arial, sans-serif" font-size="27" font-weight="bold" fill="white">${letter}</text></svg>`;
 const hash=crypto.createHash('md5').update(svg).digest('hex');zip.file(hash+'.svg',svg);
 await fs.mkdir('mblock-project/assets/buttons',{recursive:true});await fs.writeFile(`mblock-project/assets/buttons/answer-${letter}.svg`,svg);
 const b={};
 b.start={...mk('event_whenflagclicked',null,'hide-first'),topLevel:true,x:30,y:30};
 b['hide-first']=mk('looks_hide','start','watch');
 b.watch=mk('control_forever','hide-first',null,{SUBSTACK:[2,'display-check']});
 b['display-check']=mk('control_if_else','watch',null,{CONDITION:[2,'is-ready-display'],SUBSTACK:[2,'show'],SUBSTACK2:[2,'hide']});
 b['is-ready-display']=mk('operator_equals','display-check',null,{OPERAND1:variable(ready,'等待选择'),OPERAND2:num(1)});
 b.show=mk('looks_show','display-check',null);b.hide=mk('looks_hide','display-check',null);
 b.click={...mk('event_whenthisspriteclicked',null,'click-check'),topLevel:true,x:350,y:30};
 b['click-check']=mk('control_if','click',null,{CONDITION:[2,'is-ready-click'],SUBSTACK:[2,'lock']});
 b['is-ready-click']=mk('operator_equals','click-check',null,{OPERAND1:variable(ready,'等待选择'),OPERAND2:num(1)});
 // Claim the answer before storing it. Later clicks during feedback/planting are ignored.
 b.lock=set(ready,'等待选择',num(0),'click-check','select');
 b.select=set(chosen,'所选答案',lit(letter),'lock',null);
 const sprite={isStage:false,name:`答案${letter}`,variables:{},lists:{},broadcasts:{},blocks:b,comments:{},currentCostume:0,costumes:[{name:`按钮${letter}`,dataFormat:'svg',assetId:hash,md5ext:hash+'.svg',rotationCenterX:50,rotationCenterY:22}],sounds:[],volume:100,layerOrder:maxLayer+1+i,visible:false,x:i===0?-62:62,y:-151,size:100,direction:90,draggable:false,rotationStyle:'all around',deviceId:null,loadedExtIds:[],editorMode:'block',codes:null,codeTypes:['python']};
 p.targets.push(sprite);
}
for(const t of p.targets)for(const [id,b] of Object.entries(t.blocks)){
 for(const key of ['next','parent'])if(b[key])assert(t.blocks[b[key]],`${t.name}:${id}.${key}`);
 for(const input of Object.values(b.inputs||{}))for(const ref of input.slice(1))if(typeof ref==='string')assert(t.blocks[ref],`${t.name}:${id} input ${ref}`);
}
assert(!Object.values(rb).some(b=>b.opcode==='sensing_askandwait'||b.opcode==='sensing_answer'));
zip.file('project.json',JSON.stringify(p));
const out='mblock-project/exports/沙漠绿色公益-点击答题-v017.mblock';
await fs.writeFile(out,await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}}));
console.log(out);

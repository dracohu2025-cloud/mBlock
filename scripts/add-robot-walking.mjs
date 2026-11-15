import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import sharp from 'sharp';

const source='mblock-project/exports/沙漠绿色公益-种植稳固-v036.mblock';
const output='mblock-project/exports/沙漠绿色公益-机器人走路-v037.mblock';
const root='mblock-project/assets/props/walk-v037';
await fs.mkdir(root,{recursive:true});
const zip=await JSZip.loadAsync(await fs.readFile(source));
const p=JSON.parse(await zip.file('project.json').async('string'));
const robot=p.targets.find(t=>t.name==='蓝豆机器人'),b=robot.blocks;
const idle=robot.costumes[5],svg=await zip.file(idle.md5ext).async('string');
const png=Buffer.from(svg.match(/base64,([^"]+)/)[1],'base64');
// The established editable SVG costume supplies the artwork. Articulate its
// legs using clipped instances; keep the torso, palm and shovel together.
const thumbnail=await sharp(png).resize(384,384).png({palette:true,colours:128,effort:10}).toBuffer();
const originalImage=svg.match(/<image[^>]*\/>/)[0];
const prop=svg.slice(svg.indexOf('<g transform="translate(535 977)'),svg.lastIndexOf('</g></svg>'));
assert(prop.startsWith('<g transform='),'Idle shovel attachment missing');
const frames=[];
for(let i=0;i<8;i++){
 const phase=i*Math.PI/4,s=Math.sin(phase),left={dx:24*s,lift:Math.max(0,s)*(24+12*Math.cos(phase)),angle:-11*s},right={dx:-24*s,lift:Math.max(0,-s)*(24-12*Math.cos(phase)),angle:11*s};
 const image=`<image id="walk-body" width="1254" height="1254" xlink:href="data:image/png;base64,${thumbnail.toString('base64')}"/>`;
 const leftClip='M650 930H775V1254H500V1050Z',rightClip='M790 930H930L1055 1080V1254H790Z';
 const defs=`<defs>${image}<clipPath id="upper"><path d="M0 0H1254V950H640V1045H0Z"/></clipPath><clipPath id="left-leg"><path d="${leftClip}"/></clipPath><clipPath id="right-leg"><path d="${rightClip}"/></clipPath></defs>`;
 const leg=(id,m,x)=>`<g transform="translate(${m.dx.toFixed(3)} ${(-m.lift).toFixed(3)}) rotate(${m.angle.toFixed(3)} ${x} 940)"><use xlink:href="#walk-body" clip-path="url(#${id})"/></g>`;
 // Draw legs first so the original hip plates cover their moving joints.
 const joints='<g fill="#b6c1d2" stroke="#17283d" stroke-width="8"><circle cx="705" cy="947" r="31"/><circle cx="865" cy="947" r="31"/></g>';
 const body=`${joints}${leg('right-leg',right,865)}${leg('left-leg',left,705)}<use xlink:href="#walk-body" clip-path="url(#upper)"/>${prop}`;
 const final=svg.slice(0,svg.indexOf(originalImage))+defs+body+'</g></svg>';
 assert(final.includes('left-leg')&&final.includes('right-leg'));
 const hash=crypto.createHash('md5').update(final).digest('hex');zip.file(`${hash}.svg`,final);
 robot.costumes.push({...structuredClone(idle),name:`走路-${String(i+1).padStart(2,'0')}`,assetId:hash,md5ext:`${hash}.svg`});
 await fs.writeFile(`${root}/walk-${i+1}.svg`,final);
 frames.push({name:robot.costumes.at(-1).name,index:robot.costumes.length,phase:i,left,right,asset:`${hash}.svg`});
}
const mk=(opcode,parent,next,inputs={},fields={})=>({opcode,parent,next,inputs,fields,shadow:false,topLevel:false});
const n=x=>[1,[4,String(x)]],v=id=>[2,[12,id,id]],ref=id=>[2,id];
const vars=['walk-start-x','walk-start-y','walk-target-x','walk-target-y','walk-tick'];
for(const id of vars)robot.variables[id]=[id,0];
robot.lists['walk-poses']=['走路造型',frames.map(f=>f.name)];
function chain(prefix,entry,next,x,y){
 const add=(suffix,op,parent,after,inputs={},fields={})=>{const id=prefix+suffix;b[id]=mk(op,parent,after,inputs,fields);return id;};
 const set=(suffix,id,value,parent,after)=>add(suffix,'data_setvariableto',parent,after,{VALUE:value},{VARIABLE:[id,id]});
 const start=prefix+'start-x';
 set('start-x','walk-start-x',ref(prefix+'read-x'),entry,prefix+'start-y');add('read-x','motion_xposition',start,null);
 set('start-y','walk-start-y',ref(prefix+'read-y'),start,prefix+'target-x');add('read-y','motion_yposition',prefix+'start-y',null);
 set('target-x','walk-target-x',x,prefix+'start-y',prefix+'target-y');if(typeof x[1]==='string')b[x[1]].parent=prefix+'target-x';
 set('target-y','walk-target-y',y,prefix+'target-x',prefix+'tick-zero');
 set('tick-zero','walk-tick',n(0),prefix+'target-y',prefix+'loop');
 add('loop','control_repeat',prefix+'tick-zero',prefix+'idle',{TIMES:n(24),SUBSTACK:ref(prefix+'tick')});
 add('tick','data_changevariableby',prefix+'loop',prefix+'pose',{VALUE:n(1)},{VARIABLE:['walk-tick','walk-tick']});
 add('pose','looks_switchcostumeto',prefix+'tick',prefix+'move',{COSTUME:ref(prefix+'pose-item')});
 add('pose-item','data_itemoflist',prefix+'pose',null,{INDEX:ref(prefix+'pose-index')},{LIST:['走路造型','walk-poses']});
 add('pose-index','operator_add',prefix+'pose-item',null,{NUM1:ref(prefix+'mod'),NUM2:n(1)});
 add('mod','operator_mod',prefix+'pose-index',null,{NUM1:ref(prefix+'tick-minus'),NUM2:n(8)});
 add('tick-minus','operator_subtract',prefix+'mod',null,{NUM1:v('walk-tick'),NUM2:n(1)});
 add('move','motion_gotoxy',prefix+'pose',prefix+'wait',{X:ref(prefix+'x-sum'),Y:ref(prefix+'y-sum')});
 for(const axis of ['x','y']){
  add(axis+'-sum','operator_add',prefix+'move',null,{NUM1:v('walk-start-'+axis),NUM2:ref(prefix+axis+'-scaled')});
  add(axis+'-scaled','operator_multiply',prefix+axis+'-sum',null,{NUM1:ref(prefix+axis+'-delta'),NUM2:ref(prefix+axis+'-fraction')});
  add(axis+'-delta','operator_subtract',prefix+axis+'-scaled',null,{NUM1:v('walk-target-'+axis),NUM2:v('walk-start-'+axis)});
  add(axis+'-fraction','operator_divide',prefix+axis+'-scaled',null,{NUM1:v('walk-tick'),NUM2:n(24)});
 }
 add('wait','control_wait',prefix+'move',null,{DURATION:n(1/24)});
 add('idle','looks_switchcostumeto',prefix+'loop',next,{COSTUME:[1,[10,'种树24-01']]});
 if(next)b[next].parent=prefix+'idle';
 return start;
}
const outbound='tm5j^Mm+DgJF4@PtrQlW',move=b[outbound],destination=structuredClone(move.inputs.X),after=move.next;
const departure=chain('walk-out-',move.parent,after,destination,n(-8));
b[move.parent].next=departure;delete b[outbound];
// The return runs only once planting has finished, so a still-active planting
// thread cannot overwrite a walking pose. Skip movement on the first question.
const reading='quiz-reading-position',returnMove=b[reading];
b[reading]=mk('control_wait_until',returnMove.parent,'walk-return-if',{CONDITION:ref('walk-plant-done')});
b['walk-plant-done']=mk('operator_equals',reading,null,{OPERAND1:v('seedling-handoff-completed'),OPERAND2:v('%z6KO!=AV03bkJsGH`QJ')});
// Variable display names are irrelevant to IDs, but keep the existing names.
b['walk-plant-done'].inputs.OPERAND1=[2,[12,'种植完成数','seedling-handoff-completed']];
b['walk-plant-done'].inputs.OPERAND2=[2,[12,'已种树数','%z6KO!=AV03bkJsGH`QJ']];
b['walk-return-if']=mk('control_if',reading,returnMove.next,{CONDITION:ref('walk-return-needed'),SUBSTACK:ref('walk-back-start-x')});
b['walk-return-needed']=mk('operator_not','walk-return-if',null,{OPERAND:ref('walk-at-reading')});
b['walk-at-reading']=mk('operator_and','walk-return-needed',null,{OPERAND1:ref('walk-at-x'),OPERAND2:ref('walk-at-y')});
for(const [axis,value]of [['x',-160],['y',35]]){
 b['walk-at-'+axis]=mk('operator_equals','walk-at-reading',null,{OPERAND1:ref('walk-current-'+axis),OPERAND2:n(value)});
 b['walk-current-'+axis]=mk('motion_'+axis+'position','walk-at-'+axis,null);
}
chain('walk-back-','walk-return-if',null,n(-160),n(35));b[returnMove.next].parent='walk-return-if';
await fs.writeFile(`${root}/walk.json`,JSON.stringify({source,frames,ticks:24,wait:1/24,outbound:departure,reading},null,2)+'\n');
zip.file('project.json',JSON.stringify(p));const archive=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}});
assert(archive.length<40*1024*1024,`Archive exceeds bridge limit: ${archive.length}`);
await fs.writeFile(output,archive);console.log(`${output}: ${frames.length} walking poses; ${archive.length} bytes.`);

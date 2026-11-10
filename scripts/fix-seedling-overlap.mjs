import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import JSZip from 'jszip';

const zip=await JSZip.loadAsync(await fs.readFile('mblock-project/exports/沙漠绿色公益-加长铁铲-v030.mblock'));
const p=JSON.parse(await zip.file('project.json').async('string'));
const robot=p.targets.find(t=>t.name==='蓝豆机器人');
const shovel=p.targets.find(t=>t.name==='机器人铁铲');
const plants=p.targets.filter(t=>/^植物[1-5]$/.test(t.name));
assert.equal(plants.length,5);
const order=p.targets.filter(t=>!t.isStage&&t!==robot&&t!==shovel).sort((a,b)=>a.layerOrder-b.layerOrder);
const lastPlant=Math.max(...plants.map(t=>order.indexOf(t)));
// Preserve the shovel behind the hand; both must be in front of planted trees.
order.splice(lastPlant+1,0,shovel,robot);
order.forEach((t,i)=>{t.layerOrder=i+1;});
assert(plants.every(t=>t.layerOrder<shovel.layerOrder&&t.layerOrder<robot.layerOrder));
// Separate the speaker anchor from the robot so the robot can stand above the
// planting row without lifting long questions back over the level heading.
const stage=p.targets.find(t=>t.isStage),rb=robot.blocks;
stage.variables['quiz-display-text']=['屏幕提示文字',''];
stage.broadcasts['quiz-display-message']='显示屏幕提示';
robot.y=35;
for(const id of ['aO5KSZdI:Ka`wRN4bRnT','quiz-reading-position'])rb[id].inputs.Y=[1,[4,'35']];
const mk=(opcode,parent,next,inputs={},fields={})=>({opcode,parent,next,inputs,fields,shadow:false,topLevel:false});
for(const [id,block]of Object.entries({...rb}))if(['looks_say','looks_sayforsecs'].includes(block.opcode)){
 const next=block.next,timed=block.opcode==='looks_sayforsecs',duration=block.inputs.SECS,message=block.inputs.MESSAGE;
 rb[id]=mk('data_setvariableto',block.parent,`${id}-display`,{VALUE:message},{VARIABLE:['屏幕提示文字','quiz-display-text']});
 rb[`${id}-display`]=mk('event_broadcast',id,timed?`${id}-duration`:next,{BROADCAST_INPUT:[1,[11,'显示屏幕提示','quiz-display-message']]});
 if(timed){
  rb[`${id}-duration`]=mk('control_wait',`${id}-display`,`${id}-blank`,{DURATION:duration});
  rb[`${id}-blank`]=mk('data_setvariableto',`${id}-duration`,`${id}-clear-display`,{VALUE:[1,[10,'']]},{VARIABLE:['屏幕提示文字','quiz-display-text']});
  rb[`${id}-clear-display`]=mk('event_broadcast',`${id}-blank`,next,{BROADCAST_INPUT:[1,[11,'显示屏幕提示','quiz-display-message']]});
 }
 if(next)rb[next].parent=timed?`${id}-clear-display`:`${id}-display`;
}
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="#ffffff" opacity="0.004"/></svg>';
const hash=crypto.createHash('md5').update(svg).digest('hex');zip.file(`${hash}.svg`,svg);
const speaker={...structuredClone(robot),name:'题目显示锚点',variables:{},lists:{},broadcasts:{},comments:{},blocks:{},costumes:[{name:'提示锚点',dataFormat:'svg',assetId:hash,md5ext:`${hash}.svg`,rotationCenterX:.5,rotationCenterY:.5}],currentCostume:0,sounds:[],x:-70,y:15,size:100,visible:true,layerOrder:1,rotationStyle:"don't rotate"};
speaker.blocks['speaker-message']={...mk('event_whenbroadcastreceived',null,'speaker-say',{}, {BROADCAST_OPTION:['显示屏幕提示','quiz-display-message']}),topLevel:true,x:40,y:40};
speaker.blocks['speaker-say']=mk('looks_say','speaker-message',null,{MESSAGE:[2,[12,'屏幕提示文字','quiz-display-text']]});
speaker.blocks['speaker-reset']={...mk('event_whenflagclicked',null,'speaker-clear'),topLevel:true,x:400,y:40};
speaker.blocks['speaker-clear']=mk('looks_say','speaker-reset',null,{MESSAGE:[1,[10,'']]});
p.targets.push(speaker);
zip.file('project.json',JSON.stringify(p));
const output='mblock-project/exports/沙漠绿色公益-肩膀无苗-v031.mblock';
await fs.writeFile(output,await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}}));
console.log(output);

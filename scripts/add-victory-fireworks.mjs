import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import sharp from 'sharp';

const source='mblock-project/exports/沙漠绿色公益-十种沙漠-v024.mblock';
const output='mblock-project/exports/沙漠绿色公益-通关烟花-v025.mblock';
const assets='mblock-project/assets/fireworks/v025';
await fs.mkdir(assets,{recursive:true});
const zip=await JSZip.loadAsync(await fs.readFile(source));
const project=JSON.parse(await zip.file('project.json').async('string'));
const stage=project.targets.find(t=>t.isStage), b=stage.blocks;
assert(!project.targets.some(t=>t.name==='通关烟花'));
const unchanged=structuredClone(project.targets.filter(t=>!t.isStage));
const lit=value=>[1,[10,String(value)]];
const variable=(name,id)=>[2,[12,name,id]];
const mk=(opcode,parent,next,inputs={},fields={})=>({opcode,parent,next,inputs,fields,shadow:false,topLevel:false});
const doneField={VARIABLE:['烟花播放完毕','fireworks-finished']};
stage.variables['fireworks-finished']=['烟花播放完毕',0];
stage.broadcasts['final-fireworks']='通关烟花';

// Keep the next/replay button locked until the final celebration has finished.
assert.equal(b['levels-39'].next,'levels-41');
b['levels-39'].next='fireworks-final-only';
b['levels-41'].parent='fireworks-final-only';
b['fireworks-final-only']=mk('control_if','levels-39','levels-41',{
  CONDITION:[2,'fireworks-final-level'],SUBSTACK:[2,'fireworks-lock']
});
b['fireworks-final-level']=mk('operator_equals','fireworks-final-only',null,{
  OPERAND1:variable('当前关卡','game-level'),OPERAND2:variable('总关卡数','game-total-levels')
});
b['fireworks-lock']=mk('data_setvariableto','fireworks-final-only','fireworks-reset',{VALUE:lit(3)},{VARIABLE:['关卡状态','game-phase']});
b['fireworks-reset']=mk('data_setvariableto','fireworks-lock','fireworks-broadcast',{VALUE:lit(0)},doneField);
b['fireworks-broadcast']=mk('event_broadcast','fireworks-reset','fireworks-wait',{BROADCAST_INPUT:[1,[11,'通关烟花','final-fireworks']]});
b['fireworks-wait']=mk('control_wait_until','fireworks-broadcast',null,{CONDITION:[2,'fireworks-is-finished']});
b['fireworks-is-finished']=mk('operator_equals','fireworks-wait',null,{OPERAND1:variable('烟花播放完毕','fireworks-finished'),OPERAND2:lit(1)});

const sprite={...structuredClone(unchanged.find(t=>t.name==='关卡继续按钮')),name:'通关烟花',blocks:{},variables:{},lists:{},broadcasts:{},comments:{},costumes:[],sounds:[],currentCostume:0,visible:false,x:0,y:0,size:100,rotationStyle:"don't rotate",layerOrder:Math.max(...unchanged.map(t=>t.layerOrder))+1};
const sb=sprite.blocks;
for(const [suffix,opcode,fields]of [
  ['flag','event_whenflagclicked',{}],
  ['round','event_whenbroadcastreceived',{BROADCAST_OPTION:['开始关卡','level-start']}]
]){
  sb[`fw-${suffix}`]={...mk(opcode,null,`fw-${suffix}-hide`,{},fields),topLevel:true,x:40,y:suffix==='flag'?40:230};
  sb[`fw-${suffix}-hide`]=mk('looks_hide',`fw-${suffix}`,`fw-${suffix}-reset`);
  sb[`fw-${suffix}-reset`]=mk('data_setvariableto',`fw-${suffix}-hide`,null,{VALUE:lit(0)},doneField);
}
sb['fw-start']={...mk('event_whenbroadcastreceived',null,'fw-show',{}, {BROADCAST_OPTION:['通关烟花','final-fireworks']}),topLevel:true,x:350,y:40};
sb['fw-show']=mk('looks_show','fw-start','fw-frame-0');

const frames=72;
const f=n=>Number(n.toFixed(2));
function frameSvg(frame){
  const time=frame/24, cx=240,cy=92, shapes=[];
  if(time<.65){
    const u=time/.65,y=245-153*(1-(1-u)**2);
    for(let j=10;j>=0;j--)shapes.push(`<circle cx="${cx}" cy="${f(y+j*2.1)}" r="${f(2.2-j*.16)}" fill="#ffce64" opacity="${f((1-j/11)*.85)}"/>`);
    shapes.push(`<circle cx="${cx}" cy="${f(y)}" r="2.7" fill="#fff6bd"/>`);
  }else{
    const age=time-.65,u=Math.min(1,age/2.3),radius=97*(1-Math.exp(-3.8*u)),fall=23*u*u;
    const opacity=Math.min(1,(1-u)*2.6);
    const colors=['#ffe78a','#65f8ed','#ffbc73','#fff7cd','#ff99b6'];
    for(let i=0;i<52;i++){
      const a=i*Math.PI*2/52,variation=.76+.24*(.5+.5*Math.sin(i*7.3));
      const r=radius*variation,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r+fall;
      const tail=Math.max(1,13*(1-u));
      shapes.push(`<path d="M ${f(x-Math.cos(a)*tail)} ${f(y-Math.sin(a)*tail)} L ${f(x)} ${f(y)}" stroke="${colors[i%colors.length]}" stroke-width="${f(1.7-u*.8)}" stroke-linecap="round" opacity="${f(opacity*.8)}"/>`);
      shapes.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(1.1+.8*(1-u))}" fill="${colors[i%colors.length]}" opacity="${f(opacity)}"/>`);
      if(i%3===0&&u>.15){const sparkle=(.6+.4*Math.sin(frame*1.7+i))*opacity;shapes.push(`<path d="M ${f(x-2.5)} ${f(y)} h 5 M ${f(x)} ${f(y-2.5)} v 5" stroke="#ffffff" stroke-width=".8" opacity="${f(sparkle)}"/>`);}
    }
    if(age<.2)shapes.push(`<circle cx="${cx}" cy="${cy}" r="${f(12*(1-age/.2))}" fill="#fff9d6" opacity="${f(1-age/.2)}"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360">${shapes.join('')}</svg>`;
}
const preview=[];
for(let i=0;i<frames;i++){
  const svg=Buffer.from(frameSvg(i)),hash=crypto.createHash('md5').update(svg).digest('hex');
  await fs.writeFile(`${assets}/frame-${String(i+1).padStart(2,'0')}.svg`,svg);
  zip.file(`${hash}.svg`,svg);
  sprite.costumes.push({name:`烟花${String(i+1).padStart(2,'0')}`,dataFormat:'svg',assetId:hash,md5ext:`${hash}.svg`,rotationCenterX:240,rotationCenterY:180});
  sb[`fw-frame-${i}`]=mk('looks_switchcostumeto',i===0?'fw-show':`fw-wait-${i-1}`,`fw-wait-${i}`,{COSTUME:lit(i+1)});
  sb[`fw-wait-${i}`]=mk('control_wait',`fw-frame-${i}`,i===frames-1?'fw-hide':`fw-frame-${i+1}`,{DURATION:lit(1/24)});
  if([7,17,24,32,43,58].includes(i))preview.push({input:await sharp(svg).resize(480,360).png().toBuffer(),left:(preview.length%3)*480,top:Math.floor(preview.length/3)*360});
}
sb['fw-hide']=mk('looks_hide',`fw-wait-${frames-1}`,'fw-done');
sb['fw-done']=mk('data_setvariableto','fw-hide',null,{VALUE:lit(1)},doneField);
assert.deepEqual(project.targets.filter(t=>!t.isStage),unchanged);
project.targets.push(sprite);
await sharp({create:{width:1440,height:720,channels:3,background:'#14283f'}}).composite(preview).png().toFile(`${assets}/preview.png`);
// Export a clean idle state; all green-flag scripts retain their normal resets.
for(const id of ['game-phase','game-next','quiz-click-ready','%z6KO!=AV03bkJsGH`QJ','mature-tree-count','saxaul-landed-count','seedling-handoff-completed'])stage.variables[id][1]=0;
stage.variables['game-level'][1]=1;stage.currentCostume=0;
for(const t of project.targets)for(const [id,x]of Object.entries(t.blocks)){
  for(const k of ['next','parent'])if(x[k])assert(t.blocks[x[k]],`${t.name}:${id}.${k}`);
  for(const input of Object.values(x.inputs||{}))for(const ref of input.slice(1))if(typeof ref==='string')assert(t.blocks[ref],`${t.name}:${id} input ${ref}`);
}
zip.file('project.json',JSON.stringify(project));
await fs.writeFile(output,await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}}));
console.log(`${output}: one final-level firework, 72 transparent frames, replay unlocked on completion.`);

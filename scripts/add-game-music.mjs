import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
// Original procedural composition: a gentle pentatonic melody over C-Am-F-G.
// No downloaded recordings or third-party music samples.
const rate=44100, beat=60/96, duration=32*beat;
function track(seconds){return new Float64Array(Math.round(seconds*rate));}
function tone(a,start,len,midi,amp,kind='pluck'){
 const f=440*2**((midi-69)/12), begin=Math.round(start*rate), n=Math.round(len*rate);
 for(let i=0;i<n&&begin+i<a.length;i++){
  const t=i/rate, release=Math.min(1,(n-i)/(rate*.07)), attack=Math.min(1,t/.008);
  const env=attack*release*Math.exp(-t/(kind==='pad'?.7:.28));
  const wave=Math.sin(2*Math.PI*f*t)+.22*Math.sin(4*Math.PI*f*t)+.07*Math.sin(6*Math.PI*f*t);
  a[begin+i]+=amp*env*wave;
 }
}
function wav(a){
 const peak=Math.max(...[...Array(100).keys()].map(k=>{let p=0;for(let i=k;i<a.length;i+=100)p=Math.max(p,Math.abs(a[i]));return p;}));
 const gain=peak>.8?.8/peak:1, data=Buffer.alloc(a.length*2);
 for(let i=0;i<a.length;i++)data.writeInt16LE(Math.round(Math.max(-1,Math.min(1,a[i]*gain))*32767),i*2);
 const h=Buffer.alloc(44);h.write('RIFF');h.writeUInt32LE(36+data.length,4);h.write('WAVEfmt ',8);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(1,22);h.writeUInt32LE(rate,24);h.writeUInt32LE(rate*2,28);h.writeUInt16LE(2,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(data.length,40);
 return Buffer.concat([h,data]);
}
const music=track(duration);
const chords=[[48,55,60,64],[45,52,57,60],[41,48,53,57],[43,50,55,59]];
const melodies=[[72,76,79,76,74,72,67,69],[72,69,76,72,69,67,64,67],[69,72,77,76,72,69,67,69],[67,71,74,79,76,74,72,67],[72,76,79,84,79,76,74,72],[69,72,76,79,76,72,69,67],[65,69,72,77,76,72,69,67],[67,74,71,67,72,76,72,null]];
for(let bar=0;bar<8;bar++){
 const chord=chords[bar%4];
 for(let j=0;j<8;j++){
  const t=(bar*4+j*.5)*beat, note=melodies[bar][j];
  if(note!==null)tone(music,t,.34,note,.13);
  tone(music,t,.35,chord[1+j%3],.045,'pad');
 }
 for(const j of [0,2])tone(music,(bar*4+j)*beat,.55,chord[0],.14,'pad');
}
// Taper both loop boundaries to silence to avoid discontinuity clicks.
for(let i=0;i<rate*.02;i++){music[i]*=i/(rate*.02);music[music.length-1-i]*=i/(rate*.02);}
const correct=track(.65);[72,76,79].forEach((n,i)=>tone(correct,i*.12,.35,n,.3));
const victory=track(2.4);[72,76,79,84,79,84].forEach((n,i)=>tone(victory,i*.22,.65,n,.23));[60,64,67,72].forEach(n=>tone(victory,1.5,.85,n,.11,'pad'));
const files=[['desert-garden-loop','沙漠绿洲',music],['answer-correct','答对提示',correct],['forest-complete','绿洲完成',victory]];
const zip=await JSZip.loadAsync(await fs.readFile('mblock-project/exports/沙漠绿色公益-恢复梭梭树苗-v012.mblock'));
const p=JSON.parse(await zip.file('project.json').async('string'));
const stage=p.targets.find(t=>t.isStage),robot=p.targets.find(t=>t.name==='蓝豆机器人');
await fs.mkdir('mblock-project/assets/sounds',{recursive:true});
for(let i=0;i<files.length;i++){
 const [filename,name,samples]=files[i],bytes=wav(samples),hash=crypto.createHash('md5').update(bytes).digest('hex');
 await fs.writeFile(`mblock-project/assets/sounds/${filename}.wav`,bytes);zip.file(hash+'.wav',bytes);
 (i===0?stage:robot).sounds.push({name,assetId:hash,dataFormat:'wav',format:'',rate,sampleCount:samples.length,md5ext:hash+'.wav'});
}
const mk=(opcode,parent,next,inputs={},fields={})=>({opcode,parent,next,inputs,fields,shadow:false,topLevel:false});
function hat(b,id,next,x,y){b[id]={...mk('event_whenflagclicked',null,next),topLevel:true,x,y};}
function sound(b,id,name,parent,next,wait=false){
 b[id]=mk(wait?'sound_playuntildone':'sound_play',parent,next,{SOUND_MENU:[1,id+'-menu']});
 b[id+'-menu']={...mk('sound_sounds_menu',id,null,{}, {SOUND_MENU:[name,null]}),shadow:true};
}
let b=stage.blocks;
hat(b,'music-start','music-volume',900,50);
b['music-volume']=mk('sound_setvolumeto','music-start','music-loop',{VOLUME:[1,[4,'22']]});
b['music-loop']=mk('control_forever','music-volume',null,{SUBSTACK:[2,'music-play']});
sound(b,'music-play','沙漠绿洲','music-loop',null,true);stage.volume=22;
// M toggles background music only. Correct and completion feedback remain audible.
b['music-mute-key']={...mk('event_whenkeypressed',null,'music-mute-if',{}, {KEY_OPTION:['m',null]}),topLevel:true,x:900,y:300};
b['music-mute-if']=mk('control_if_else','music-mute-key',null,{CONDITION:[2,'music-is-muted'],SUBSTACK:[2,'music-unmute'],SUBSTACK2:[2,'music-mute']});
b['music-is-muted']=mk('operator_equals','music-mute-if',null,{OPERAND1:[2,'music-current-volume'],OPERAND2:[1,[4,'0']]});
b['music-current-volume']=mk('sound_volume','music-is-muted',null);
b['music-unmute']=mk('sound_setvolumeto','music-mute-if',null,{VOLUME:[1,[4,'22']]});
b['music-mute']=mk('sound_setvolumeto','music-mute-if',null,{VOLUME:[1,[4,'0']]});
b=robot.blocks;robot.volume=55;
// Non-blocking cue: never delays the answer/animation state machine.
const correctCount='c$CckG`Vmx5SyXEE4pRR', oldNext=b[correctCount].next;
b[correctCount].next='answer-cue';b[oldNext].parent='answer-cue';
sound(b,'answer-cue','答对提示',correctCount,oldNext);
hat(b,'victory-start','effects-volume',1700,50);
b['effects-volume']=mk('sound_setvolumeto','victory-start','victory-reset-wait',{VOLUME:[1,[4,'55']]});
b['victory-reset-wait']=mk('control_wait','effects-volume','victory-wait',{DURATION:[1,[4,'0.3']]});
b['victory-wait']=mk('control_wait_until','victory-reset-wait','victory-growth-wait',{CONDITION:[2,'victory-condition']});
b['victory-condition']=mk('operator_gt','victory-wait',null,{OPERAND1:[2,[12,'种植完成数','seedling-handoff-completed']],OPERAND2:[1,[4,'4']]});
b['victory-growth-wait']=mk('control_wait','victory-wait','victory-cue',{DURATION:[1,[4,'2']]});
sound(b,'victory-cue','绿洲完成','victory-growth-wait',null);
for(const t of p.targets)for(const [id,b] of Object.entries(t.blocks)){
 for(const k of ['next','parent'])if(b[k])assert(t.blocks[b[k]],`${id}.${k}`);
 for(const input of Object.values(b.inputs||{}))for(const v of input.slice(1))if(typeof v==='string')assert(t.blocks[v],`${id} input`);
}
zip.file('project.json',JSON.stringify(p));
const output='mblock-project/exports/沙漠绿色公益-音乐版-v013.mblock';
await fs.writeFile(output,await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}}));
console.log(output);console.log('Audio: 20s background loop, .65s correct cue, 2.4s victory; M toggles background.');

import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import JSZip from 'jszip';

// Original, deterministic instrumental loops; no third-party recordings.
const rate=16000,root='mblock-project/assets/sounds/levels-v033';
const themes=[
 ['金色沙海·出发',100,0,'marimba',[0,4,7,9,7,4,2,0,4,7,12,9,7,4,2,4]],
 ['红岩沙漠·足迹',110,2,'pluck',[0,3,7,10,7,3,5,7,10,12,10,7,5,3,2,0]],
 ['月牙沙丘·月光',80,7,'bell',[7,12,11,7,4,2,4,7,9,7,4,2,0,4,2,0]],
 ['岩丘荒漠·远行',96,5,'flute',[0,2,4,7,4,2,0,-3,0,4,5,9,7,4,2,0]],
 ['黑石戈壁·步伐',112,-3,'pluck',[0,7,3,7,5,10,7,5,3,7,10,12,10,7,3,0]],
 ['盐滩荒漠·微风',76,9,'pad',[0,4,7,11,9,7,4,2,4,7,9,12,11,7,4,0]],
 ['白沙沙漠·晶光',104,4,'bell',[12,7,9,4,7,2,4,0,9,7,12,14,12,9,7,4]],
 ['峡谷沙漠·回声',108,-5,'marimba',[0,7,12,7,3,10,15,10,5,12,17,12,7,14,10,7]],
 ['落日沙海·暖光',88,-2,'guitar',[7,4,0,4,9,7,4,2,5,4,0,2,7,4,2,0]],
 ['星夜沙漠·星河',84,11,'celesta',[12,7,4,11,9,4,2,7,12,16,14,11,9,7,4,0]]
];
const freq=m=>440*2**((m-69)/12);
function tone(a,start,len,midi,amp,kind){
 const begin=Math.round(start*rate),n=Math.round(len*rate),f=freq(midi);
 for(let i=0;i<n&&begin+i<a.length;i++){
  const t=i/rate,release=Math.min(1,(n-i)/(rate*.08));
  let attack=Math.min(1,t/(kind==='pad'?.12:kind==='flute'?.04:.006)),env,wave;
  if(kind==='bell'||kind==='celesta'){env=Math.exp(-t/(kind==='celesta'?.55:.8));wave=Math.sin(2*Math.PI*f*t)+.3*Math.sin(2*Math.PI*f*2.01*t)*Math.exp(-t*3)+.12*Math.sin(2*Math.PI*f*3*t);}
  else if(kind==='flute'){env=.8+.2*Math.exp(-t*3);wave=Math.sin(2*Math.PI*f*t+.015*Math.sin(t*32))+.1*Math.sin(4*Math.PI*f*t);}
  else if(kind==='pad'){env=.65+.35*Math.exp(-t*2);wave=Math.sin(2*Math.PI*f*t)+.18*Math.sin(2*Math.PI*f*1.003*t);}
  else{env=Math.exp(-t/(kind==='guitar'?.5:.25));wave=Math.sin(2*Math.PI*f*t)+.25*Math.sin(4*Math.PI*f*t)+.09*Math.sin(6*Math.PI*f*t);}
  a[begin+i]+=amp*attack*release*env*wave;
 }
}
function drum(a,start,amp,hat=false){
 let seed=123456;const n=Math.round((hat?.055:.13)*rate),begin=Math.round(start*rate);
 for(let i=0;i<n&&begin+i<a.length;i++){const t=i/rate;seed=(seed*1664525+1013904223)>>>0;const wave=hat?(seed/2**31-1):Math.sin(2*Math.PI*(70*t-140*t*t));a[begin+i]+=amp*wave*Math.exp(-t/(hat?.012:.035))*Math.min(1,t/.002);}
}
function wav(a){
 let peak=0;for(const x of a)peak=Math.max(peak,Math.abs(x));const gain=.72/peak;
 const h=Buffer.alloc(44+a.length*2);h.write('RIFF');h.writeUInt32LE(h.length-8,4);h.write('WAVEfmt ',8);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(1,22);h.writeUInt32LE(rate,24);h.writeUInt32LE(rate*2,28);h.writeUInt16LE(2,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(a.length*2,40);
 for(let i=0;i<a.length;i++){const fade=Math.min(1,i/(rate*.02),(a.length-1-i)/(rate*.06));h.writeInt16LE(Math.round(a[i]*gain*fade*32767),44+i*2);}return h;
}
const zip=await JSZip.loadAsync(await fs.readFile('mblock-project/exports/沙漠绿色公益-握紧铁铲-v032.mblock'));
const p=JSON.parse(await zip.file('project.json').async('string')),stage=p.targets.find(t=>t.isStage),b=stage.blocks;
assert.equal(stage.variables['game-total-levels'][1],themes.length);
const beforeSprites=JSON.stringify(p.targets.filter(t=>!t.isStage));
await fs.mkdir(root,{recursive:true});const manifest=[];
for(const [i,[title,bpm,key,kind,melody]]of themes.entries()){
 const beat=60/bpm,a=new Float64Array(Math.round(16*beat*rate)),minor=[1,4,7].includes(i);
 const chordRoots=[0,minor?-4:-3,5,7];
 for(let bar=0;bar<4;bar++){
  const chord=chordRoots[bar],third=minor?3:4;
  for(let j=0;j<8;j++){
   const at=(bar*4+j*.5)*beat,note=melody[(bar%2)*8+j]+(bar===2?12:0);
   if(!(i===5&&j%2))tone(a,at,Math.min(beat*(kind==='pad'?1.7:.8),16*beat-at),72+key+note,.12,kind);
   tone(a,at,.85*beat,48+key+chord+[0,7,12,third+12][(j+i)%4],.035,i%2?'guitar':'marimba');
  }
  for(const j of [0,2]){tone(a,(bar*4+j)*beat,1.4*beat,36+key+chord,.1,'guitar');if([0,1,3,4,7].includes(i))drum(a,(bar*4+j)*beat,.075);}
  if([1,4,6,7].includes(i))for(let j=0;j<8;j++)drum(a,(bar*4+j*.5)*beat,.025,true);
  if([2,5,8,9].includes(i))for(const n of [0,third,7])tone(a,bar*4*beat,3.4*beat,48+key+chord+n,.023,'pad');
 }
 const bytes=wav(a),hash=crypto.createHash('md5').update(bytes).digest('hex'),name=`${String(i+1).padStart(2,'0')} ${title}`,filename=`${String(i+1).padStart(2,'0')}.wav`;
 await fs.writeFile(`${root}/${filename}`,bytes);zip.file(`${hash}.wav`,bytes);
 stage.sounds.push({name,assetId:hash,dataFormat:'wav',format:'',rate,sampleCount:a.length,md5ext:`${hash}.wav`});
 manifest.push({level:i+1,name,bpm,instrument:kind,duration:a.length/rate,file:filename,assetId:hash});
}
stage.lists['game-music-names']=['关卡音乐名称',manifest.map(x=>x.name)];
// Scratch's sound input accepts a reporter containing the sound name.
b['music-play'].inputs.SOUND_MENU=[2,'music-level-track'];
delete b['music-play-menu'];
b['music-level-track']={opcode:'data_itemoflist',next:null,parent:'music-play',inputs:{INDEX:[2,[12,'当前关卡','game-level']]},fields:{LIST:['关卡音乐名称','game-music-names']},shadow:false,topLevel:false};
const next=b['music-start'].next;b['music-start'].next='music-level-stop';b[next].parent='music-level-stop';
b['music-level-stop']={opcode:'sound_stopallsounds',next,parent:'music-start',inputs:{},fields:{},shadow:false,topLevel:false};
assert.equal(JSON.stringify(p.targets.filter(t=>!t.isStage)),beforeSprites);
assert.equal(new Set(manifest.map(x=>x.assetId)).size,10);
await fs.writeFile(`${root}/tracks.json`,JSON.stringify(manifest,null,2)+'\n');
zip.file('project.json',JSON.stringify(p));
const output='mblock-project/exports/沙漠绿色公益-每关不同音乐-v033.mblock';
const bytes=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}});
assert(bytes.length<40*1024*1024,'Keep the project within the MCP export size limit');
await fs.writeFile(output,bytes);console.log(`${output}: ${bytes.length} bytes; ten original tracks.`);

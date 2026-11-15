import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import sharp from 'sharp';

const source='mblock-project/exports/沙漠绿色公益-原地等待-v043.mblock';
const output='mblock-project/exports/沙漠绿色公益-长方形对话框-v044.mblock';
const root='mblock-project/assets/dialogue/v044';await fs.mkdir(root,{recursive:true});
const zip=await JSZip.loadAsync(await fs.readFile(source));
const p=JSON.parse(await zip.file('project.json').async('string'));
const stage=p.targets.find(t=>t.isStage),robot=p.targets.find(t=>t.name==='蓝豆机器人'),rb=robot.blocks;
const panel=p.targets.find(t=>t.name==='题目显示锚点'),template=structuredClone(panel),oldAssets=panel.costumes.map(c=>c.md5ext);
const questions=JSON.parse(await fs.readFile('mblock-project/assets/buttons/v042/questions.json','utf8'));
const plants=stage.lists['game-plant-names'][1],count=questions.length;assert.equal(count,132);assert.equal(plants.length,10);
const frames=questions.map(q=>({type:'question',number:q.number,text:q.question}));
const introSuffix=rb['plant-intro'].inputs.STRING2[1][1],correctPrefix=rb['planted-species-prefix'].inputs.STRING1[1][1],correctSuffix=rb['planted-species-suffix'].inputs.STRING2[1][1];
plants.forEach((plant,i)=>frames.push({type:'intro',level:i+1,text:plant+introSuffix}));
plants.forEach((plant,i)=>frames.push({type:'correct',level:i+1,text:correctPrefix+plant+correctSuffix}));
const wrongText=rb['IpHwF`Xv;#mLn!$TZN7N'].inputs.VALUE[1][1],growthText=rb['|-5),{ApSaAR=5Ln%l}x'].inputs.VALUE[1][1];
frames.push({type:'wrong',text:wrongText},{type:'growth',text:growthText});
const xml=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function lines(text){
 const chars=[...text],width=s=>[...s].reduce((sum,c)=>sum+(/[\x00-\x7f]/.test(c)?.6:1),0),limit=20.8;
 if(width(text)<=limit)return[text];
 const candidates=[];
 for(let i=1;i<chars.length;i++){
  const left=chars.slice(0,i).join(''),right=chars.slice(i).join('');
  if(width(left)>limit||width(right)>limit)continue;
  const score=Math.abs(width(left)-width(right))/2-(/[，；。！？：]/.test(chars[i-1])?10:0)+(/[，；。！？：）]/.test(chars[i])?20:0);
  candidates.push({left,right,score});
 }
 assert(candidates.length,`Text exceeds panel capacity: ${text}`);candidates.sort((a,b)=>a.score-b.score);
 return[candidates[0].left,candidates[0].right];
}
panel.costumes=[];const previews=[];
for(const [i,f]of frames.entries()){
 const textLines=lines(f.text),ys=f.type==='question'?(textLines.length===1?[36]:[28,43]):(textLines.length===1?[30]:[22,38]);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="100" viewBox="0 0 300 50"><rect x="1" y="1" width="298" height="48" fill="#ffffff" stroke="#56aebe" stroke-width="2"/>${textLines.map((line,j)=>`<text x="14" y="${ys[j]}" font-family="PingFang SC,Microsoft YaHei,sans-serif" font-size="13" font-weight="500" fill="#3f4b60">${xml(line)}</text>`).join('')}</svg>`;
 const png=await sharp(Buffer.from(svg)).png({palette:true,colours:128,effort:10}).toBuffer();
 const hash=crypto.createHash('md5').update(png).digest('hex');zip.file(`${hash}.png`,png);await fs.writeFile(`${root}/${hash}.png`,png);
 panel.costumes.push({name:`提示框${String(i+1).padStart(3,'0')}`,dataFormat:'png',bitmapResolution:2,assetId:hash,md5ext:`${hash}.png`,rotationCenterX:300,rotationCenterY:50});
 Object.assign(f,{index:i+1,asset:`${hash}.png`,lines:textLines});
 if([0,102,132,152].includes(i)){const j=previews.length;previews.push({input:png,left:20,top:20+j*120});}
}
const mk=(opcode,parent,next,inputs={},fields={})=>({opcode,parent,next,inputs,fields,shadow:false,topLevel:false});
const n=x=>[1,[4,String(x)]],text=x=>[1,[10,x]],v=(id,name)=>[2,[12,name,id]],ref=id=>[2,id];
const message=v('quiz-display-text','屏幕提示文字'),frameVar='quiz-panel-frame',frame=v(frameVar,'提示框造型');
let bindings=0;
for(const [id,b]of Object.entries({...rb}))if(b.opcode==='data_setvariableto'&&b.fields.VARIABLE?.[1]==='quiz-display-text'){
 const value=b.inputs.VALUE[1];if(Array.isArray(value)&&value[1]==='')continue;
 let index;
 if(value==='question-number-prefix')index=v('quiz-option-number','当前选项题号');
 else if(value==='plant-intro'||value==='planted-species-prefix'){
  const base=value==='plant-intro'?count:count+plants.length,reporter=`panel-frame-${id}-level`;
  rb[reporter]=mk('operator_add',`panel-frame-${id}`,null,{NUM1:n(base),NUM2:v('game-level','当前关卡')});index=ref(reporter);
 }else if(Array.isArray(value)&&value[1]===wrongText)index=n(frames.length-1);
 else if(Array.isArray(value)&&value[1]===growthText)index=n(frames.length);
 else throw Error(`Unmapped dialogue: ${id}`);
 const next=b.next,added=`panel-frame-${id}`;b.next=added;rb[next].parent=added;
 rb[added]=mk('data_setvariableto',id,next,{VALUE:index},{VARIABLE:['提示框造型',frameVar]});bindings++;
}
assert.equal(bindings,5);
const saved=String(stage.variables['quiz-display-text'][1]),qid=Number(stage.variables['quiz-option-number'][1]);
const initial=saved.includes('/5题：')&&qid>=1&&qid<=count?qid:frames.find(f=>f.text===saved)?.index||0;
stage.variables[frameVar]=['提示框造型',initial];
Object.assign(panel,{x:70,y:117,size:100,currentCostume:Math.max(0,initial-1),visible:initial>0,rotationStyle:"don't rotate"});
panel.blocks={
 'speaker-message':{...mk('event_whenbroadcastreceived',null,'panel-check',{}, {BROADCAST_OPTION:['显示屏幕提示','quiz-display-message']}),topLevel:true,x:40,y:40},
 'panel-check':mk('control_if_else','speaker-message',null,{CONDITION:ref('panel-nonempty'),SUBSTACK:ref('panel-costume'),SUBSTACK2:ref('panel-hide')}),
 'panel-nonempty':mk('operator_not','panel-check',null,{OPERAND:ref('panel-empty')}),
 'panel-empty':mk('operator_equals','panel-nonempty',null,{OPERAND1:message,OPERAND2:text('')}),
 'panel-costume':mk('looks_switchcostumeto','panel-check','panel-show',{COSTUME:frame}),
 'panel-show':mk('looks_show','panel-costume',null),
 'panel-hide':mk('looks_hide','panel-check',null),
 'speaker-reset':{...mk('event_whenflagclicked',null,'speaker-clear'),topLevel:true,x:400,y:40},
 'speaker-clear':mk('looks_say','speaker-reset','panel-reset-hide',{MESSAGE:text('')}),
 'panel-reset-hide':mk('looks_hide','speaker-clear',null),
};
const progress={...template,name:'题号显示',blocks:{},costumes:[],sounds:[],variables:{},lists:{},broadcasts:{},comments:{},x:-36,y:132,size:100,rotationStyle:"don't rotate",currentCostume:Math.max(0,Math.min(4,Number(stage.variables['%z6KO!=AV03bkJsGH`QJ'][1]))),visible:initial>0&&initial<=count,layerOrder:Math.max(...p.targets.map(t=>t.layerOrder))+1};
for(let i=1;i<=5;i++){
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="30" viewBox="0 0 60 15"><text x="0" y="11.8" font-family="PingFang SC,Microsoft YaHei,sans-serif" font-size="11.5" font-weight="600" fill="#557a88">第${i}/5题</text></svg>`;
 const png=await sharp(Buffer.from(svg)).png().toBuffer(),hash=crypto.createHash('md5').update(png).digest('hex');zip.file(`${hash}.png`,png);await fs.writeFile(`${root}/progress-${i}.png`,png);
 progress.costumes.push({name:`第${i}题`,dataFormat:'png',bitmapResolution:2,assetId:hash,md5ext:`${hash}.png`,rotationCenterX:60,rotationCenterY:15});
 if(i<=2)previews.push({input:png,left:48,top:25+(i-1)*120});
}
const pb=progress.blocks;
pb.start={...mk('event_whenflagclicked',null,'reset-hide'),topLevel:true,x:30,y:30};pb['reset-hide']=mk('looks_hide','start',null);
pb.message={...mk('event_whenbroadcastreceived',null,'check',{}, {BROADCAST_OPTION:['显示屏幕提示','quiz-display-message']}),topLevel:true,x:350,y:30};
pb.check=mk('control_if_else','message',null,{CONDITION:ref('question-visible'),SUBSTACK:ref('costume'),SUBSTACK2:ref('hide')});
pb['question-visible']=mk('operator_and','check',null,{OPERAND1:ref('has-message'),OPERAND2:ref('question-range')});
pb['has-message']=mk('operator_not','question-visible',null,{OPERAND:ref('empty')});pb.empty=mk('operator_equals','has-message',null,{OPERAND1:message,OPERAND2:text('')});
pb['question-range']=mk('operator_and','question-visible',null,{OPERAND1:ref('positive'),OPERAND2:ref('within-bank')});
pb.positive=mk('operator_gt','question-range',null,{OPERAND1:frame,OPERAND2:n(0)});pb['within-bank']=mk('operator_lt','question-range',null,{OPERAND1:frame,OPERAND2:n(count+1)});
pb.costume=mk('looks_switchcostumeto','check','show',{COSTUME:ref('number')});pb.number=mk('operator_add','costume',null,{NUM1:v('%z6KO!=AV03bkJsGH`QJ','已种树数'),NUM2:n(1)});
pb.show=mk('looks_show','costume',null);pb.hide=mk('looks_hide','check',null);p.targets.push(progress);
for(const file of oldAssets)if(!p.targets.some(t=>t.costumes.some(c=>c.md5ext===file)))zip.remove(file);
const currentAssets=new Set(frames.map(f=>f.asset));
for(const file of await fs.readdir(root))if(/^[a-f0-9]{32}\.png$/.test(file)&&!currentAssets.has(file))await fs.unlink(`${root}/${file}`);
await fs.writeFile(`${root}/frames.json`,JSON.stringify(frames,null,2)+'\n');
await sharp({create:{width:640,height:500,channels:3,background:'#edf4f5'}}).composite(previews).png().toFile(`${root}/preview.png`);
zip.file('project.json',JSON.stringify(p));const bytes=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}});assert(bytes.length<40*1024*1024);
await fs.writeFile(output,bytes);console.log(`${output}: ${frames.length} rectangular message frames and five progress labels; ${bytes.length} bytes.`);

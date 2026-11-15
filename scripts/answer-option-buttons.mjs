import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import sharp from 'sharp';

const source='mblock-project/exports/沙漠绿色公益-沙生绿洲-v041.mblock';
const output='mblock-project/exports/沙漠绿色公益-选项按钮-v042.mblock';
const root='mblock-project/assets/buttons/v042';
await fs.mkdir(root,{recursive:true});
const zip=await JSZip.loadAsync(await fs.readFile(source));
const p=JSON.parse(await zip.file('project.json').async('string'));
const stage=p.targets.find(t=>t.isStage),robot=p.targets.find(t=>t.name==='蓝豆机器人'),rb=robot.blocks;
const questionVar='Ls*3*d8|jjq(bUHN*G6-',numberVar='quiz-option-number';
const questions=[];
for(const [id,b]of Object.entries(rb))if(b.opcode==='data_setvariableto'&&b.fields.VARIABLE?.[1]===questionVar){
 const text=b.inputs.VALUE[1][1],match=text.match(/^(.*?)\s+A\s+(.*?)\s+B\s+(.*?)（点击下方 A 或 B）$/);assert(match,`Unrecognized question: ${id}`);
 const condition=rb[rb[b.parent].inputs.CONDITION[1]],number=Number(condition.inputs.OPERAND2[1][1]);
 const answer=rb[b.next].inputs.VALUE[1][1];assert(['A','B'].includes(answer));
 questions.push({number,question:match[1],A:match[2],B:match[3],answer});
 b.inputs.VALUE=[1,[10,match[1]]];
 const next=b.next,added=`option-question-${number}`;
 b.next=added;rb[next].parent=added;
 rb[added]={opcode:'data_setvariableto',parent:id,next,inputs:{VALUE:[1,[4,String(number)]]},fields:{VARIABLE:['当前选项题号',numberVar]},shadow:false,topLevel:false};
}
questions.sort((a,b)=>a.number-b.number);assert.deepEqual(questions.map(q=>q.number),Array.from({length:132},(_,i)=>i+1));
stage.variables[numberVar]=['当前选项题号',0];
stage.lists['quiz-option-A']=['A选项内容',questions.map(q=>q.A)];
stage.lists['quiz-option-B']=['B选项内容',questions.map(q=>q.B)];
const xml=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function wrap(text){
 const chars=[...text];if(chars.length<=11)return[text];
 const at=Math.ceil(chars.length/2);assert(chars.length<=22,'Option needs a larger layout');
 return[chars.slice(0,at).join(''),chars.slice(at).join('')];
}
function svg(letter,text){
 const lines=wrap(text),ys=lines.length===1?[27.2]:[18.8,35.4],color=letter==='A'?'#117fd0':'#148960';
 return `<svg xmlns="http://www.w3.org/2000/svg" width="448" height="96" viewBox="0 0 224 48"><rect x="1" y="4" width="222" height="43" rx="11" fill="#19546b"/><rect x="1" y="1" width="222" height="43" rx="11" fill="${color}" stroke="#ffffff" stroke-width="1.8"/><circle cx="22" cy="22.5" r="13" fill="#ffffff" fill-opacity=".18"/><text x="22" y="28.2" text-anchor="middle" font-family="Arial,sans-serif" font-size="17" font-weight="700" fill="white">${letter}</text>${lines.map((s,i)=>`<text x="128" y="${ys[i]}" text-anchor="middle" font-family="PingFang SC,Microsoft YaHei,sans-serif" font-size="14" font-weight="600" fill="#ffffff">${xml(s)}</text>`).join('')}</svg>`;
}
const removed=new Set(),costumeCache=new Map(),preview=[];
for(const [side,letter]of ['A','B'].entries()){
 const t=p.targets.find(t=>t.name===`答案${letter}`),b=t.blocks;
 t.costumes.forEach(c=>removed.add(c.md5ext));t.costumes=[];
 for(const q of questions){
  const text=q[letter],key=letter+':'+text;
  if(!costumeCache.has(key)){
   const png=await sharp(Buffer.from(svg(letter,text))).png({palette:true,colours:128,effort:10}).toBuffer();
   const hash=crypto.createHash('md5').update(png).digest('hex');zip.file(`${hash}.png`,png);await fs.writeFile(`${root}/${hash}.png`,png);
   costumeCache.set(key,{hash,png});
  }
  const {hash}=costumeCache.get(key);
  t.costumes.push({name:`${letter}选项${String(q.number).padStart(3,'0')}`,dataFormat:'png',bitmapResolution:2,assetId:hash,md5ext:`${hash}.png`,rotationCenterX:224,rotationCenterY:48});
 }
 Object.assign(t,{x:side===0?-116:116,y:-151,size:100,direction:90,currentCostume:0,visible:false});
 b['display-check'].inputs.SUBSTACK=[2,'option-costume'];b.show.parent='option-costume';
 b['option-costume']={opcode:'looks_switchcostumeto',parent:'display-check',next:'show',inputs:{COSTUME:[2,[12,'当前选项题号',numberVar]]},fields:{},shadow:false,topLevel:false};
}
// Saved play-state text can contain the old combined prompt too.
for(const variables of [robot.variables,stage.variables])for(const entry of Object.values(variables))if(typeof entry[1]==='string'&&entry[1].includes('（点击下方 A 或 B）'))entry[1]=entry[1].replace(/\s+A\s+.*?\s+B\s+.*?（点击下方 A 或 B）$/,'');
for(const file of removed)if(!p.targets.some(t=>t.costumes.some(c=>c.md5ext===file)))zip.remove(file);
for(const [row,n]of [1,66,129].entries()){
 const q=questions[n-1];const label=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="65"><rect width="960" height="65" fill="#eef5f2"/><text x="20" y="42" font-family="PingFang SC,sans-serif" font-size="25" fill="#254b43">${n}. ${xml(q.question)}</text></svg>`);
 preview.push({input:label,left:0,top:row*180});
 for(const [i,letter]of ['A','B'].entries())preview.push({input:costumeCache.get(letter+':'+q[letter]).png,left:15+i*480,top:row*180+65});
}
await sharp({create:{width:960,height:540,channels:3,background:'#eef5f2'}}).composite(preview).png().toFile(`${root}/preview.png`);
await fs.writeFile(`${root}/questions.json`,JSON.stringify(questions,null,2)+'\n');
zip.file('project.json',JSON.stringify(p));const bytes=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}});assert(bytes.length<40*1024*1024);
await fs.writeFile(output,bytes);console.log(`${output}: ${questions.length} stems separated, ${costumeCache.size} unique option images, ${bytes.length} bytes.`);

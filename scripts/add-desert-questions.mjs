import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import JSZip from 'jszip';
import sharp from 'sharp';
const qs = [
['沙漠通常有什么气候特点？ A 降水少 B 常年多雨','A'],
['沙漠昼夜温差通常怎样？ A 比较大 B 总是为零','A'],
['沙漠中的绿洲通常靠近什么？ A 水源 B 火山口','A'],
['沙漠里哪种植物适应干旱？ A 梭梭 B 荷花','A'],
['植物根系能帮助沙地做什么？ A 固定沙土 B 制造塑料','A'],
['保护沙漠植被有什么作用？ A 减少风蚀 B 增加乱采','A'],
['在沙漠旅行时垃圾应如何处理？ A 带走 B 随地丢弃','A'],
['沙漠植物为什么珍贵？ A 能适应缺水环境 B 都需要泡在水中','A'],
['哪些行动有助保护沙漠生态？ A 保护原生植被 B 随意砍伐','A'],
['沙尘暴来临时应该怎么做？ A 尽量待在室内 B 迎风奔跑','A'],
['沙漠中的水资源通常怎样？ A 比较稀缺 B 取之不尽','A'],
['沙漠里每个地方都是沙丘吗？ A 不是 B 是','A'],
['沙丘的形成与什么有关？ A 风搬运沙粒 B 海浪冲洗山顶','A'],
['沙漠中有动物生存吗？ A 有 B 完全没有','A'],
['许多沙漠动物何时更活跃？ A 夜晚 B 正午暴晒时','A'],
['梭梭主要适应什么环境？ A 干旱地区 B 深海','A'],
['防沙治沙时应优先考虑什么？ A 当地水资源 B 随意大量浇水','A'],
['在干旱地区种树应选择什么植物？ A 适合当地的乡土植物 B 随意选择水生植物','A'],
['植物覆盖地面能怎样影响风速？ A 减弱近地面的风 B 让风永远停止','A'],
['沙漠化是指什么？ A 干旱地区土地退化 B 所有土地变成海洋','A'],
['过度放牧可能带来什么影响？ A 植被减少 B 植被一定增加','A'],
['保护沙地时为什么要控制放牧？ A 给植被恢复时间 B 让草木消失','A'],
['沙漠里节水灌溉有什么好处？ A 减少水浪费 B 增加漏水','A'],
['滴灌通常将水送到哪里？ A 植物根部附近 B 空中任意喷洒','A'],
['沙漠中植物的枝叶可以为动物提供什么？ A 栖息空间 B 塑料包装','A'],
['沙漠生态恢复需要什么？ A 长期保护 B 一天就完成','A'],
['进入自然保护区应当怎样？ A 遵守保护规定 B 随意采挖植物','A'],
['沙漠地表除了沙子还可能有什么？ A 砾石和岩石 B 全是冰淇淋','A'],
['沙漠降雨很少时，植物需要怎样适应？ A 减少水分流失 B 增加无谓耗水','A'],
['保护沙漠生态需要谁参与？ A 大家共同努力 B 只有机器人','A']];
const source='mblock-project/exports/沙漠绿色公益-稳定动画-v007.mblock';
const output='mblock-project/exports/沙漠绿色公益-沙漠题库-v008.mblock';
const zip=await JSZip.loadAsync(await fs.readFile(source));
const p=JSON.parse(await zip.file('project.json').async('string'));
const t=p.targets.find(t=>t.name==='蓝豆机器人'), b=t.blocks;
for(const block of Object.values(b)) if(block.opcode==='operator_random' && block.inputs.TO?.[1]?.[1]==='12') block.inputs.TO[1][1]='42';
let prev='I8dreW;KHBgm3p#%#w(?', after=b[prev].next;
qs.forEach(([question,answer],i)=>{
 if (i % 2) { const match=question.match(/^(.*?) A (.*?) B (.*)$/); if (!match) throw new Error(question); question=`${match[1]} A ${match[3]} B ${match[2]}`; answer='B'; }
 const n=i+13, ids=['if','eq','q','a'].map(x=>`desert_${n}_${x}`), [ifid,eqid,qid,aid]=ids;
 b[prev].next=ifid;
 b[ifid]={opcode:'control_if',next:after,parent:prev,inputs:{CONDITION:[2,eqid],SUBSTACK:[2,qid]},fields:{},shadow:false,topLevel:false};
 b[eqid]={opcode:'operator_equals',next:null,parent:ifid,inputs:{OPERAND1:[2,[12,'抽中题号','E+%ar3|qW:DZjq^qGmWZ']],OPERAND2:[1,[4,String(n)]]},fields:{},shadow:false,topLevel:false};
 b[qid]={opcode:'data_setvariableto',next:aid,parent:ifid,inputs:{VALUE:[1,[10,question+'（输入 A 或 B）']]},fields:{VARIABLE:['当前题目','Ls*3*d8|jjq(bUHN*G6-']},shadow:false,topLevel:false};
 b[aid]={opcode:'data_setvariableto',next:null,parent:qid,inputs:{VALUE:[1,[10,answer]]},fields:{VARIABLE:['正确选项','y~RTTqq3ZyBb*3!4k!}~']},shadow:false,topLevel:false};
 prev=ifid;
});
b[after].parent=prev;
const old=p.targets.find(t=>t.name==='梭梭树1').costumes[1];
const metadata=await sharp(await zip.file(old.md5ext).async('nodebuffer')).metadata();
const png=await sharp(await fs.readFile('mblock-project/assets/images/saxaul-mature-slim.png')).resize(metadata.width,metadata.height,{fit:'fill'}).png().toBuffer();
const hash=crypto.createHash('md5').update(png).digest('hex');zip.file(hash+'.png',png);
for(const target of p.targets.filter(t=>/^梭梭树[1-5]$/.test(t.name))){const c=target.costumes.find(c=>c.name==='成熟梭梭树');c.assetId=hash;c.md5ext=hash+'.png';}
zip.file('project.json',JSON.stringify(p));
await fs.writeFile(output,await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}}));
console.log(`Wrote ${output}, ${qs.length} new questions`);

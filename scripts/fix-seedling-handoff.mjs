import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import JSZip from 'jszip';
import sharp from 'sharp';
const zip=await JSZip.loadAsync(await fs.readFile('mblock-project/exports/沙漠绿色公益-适中梭梭树-v010.mblock'));
const p=JSON.parse(await zip.file('project.json').async('string'));
const stage=p.targets.find(t=>t.isStage), robot=p.targets.find(t=>t.name==='蓝豆机器人');
const trees=p.targets.filter(t=>/^梭梭树[1-5]$/.test(t.name));
if(trees.length!==5)throw Error('expected five trees');
const id='seedling-handoff-completed', name='种植完成数';stage.variables[id]=[name,0];
const rb=robot.blocks, reset=rb['@LT-yoF.Tob$/T2TJxT8'];
const resetId='seedling-handoff-reset', oldNext=reset.next;
reset.next=resetId;rb[oldNext].parent=resetId;
rb[resetId]={opcode:'data_setvariableto',next:oldNext,parent:'@LT-yoF.Tob$/T2TJxT8',inputs:{VALUE:[1,[4,'0']]},fields:{VARIABLE:[name,id]},shadow:false,topLevel:false};
const endId='+NH=uWv7^GezL1^(?:M8', end=rb[endId], inc='seedling-handoff-increment';
end.next=inc;rb[inc]={opcode:'data_changevariableby',next:null,parent:endId,inputs:{VALUE:[1,[4,'1']]},fields:{VARIABLE:[name,id]},shadow:false,topLevel:false};
const png=await sharp(await fs.readFile('mblock-project/assets/images/plant-sprout-matching.png')).resize(2508,2508).png().toBuffer();
const hash=crypto.createHash('md5').update(png).digest('hex');zip.file(hash+'.png',png);
for(const tree of trees){
 const c=tree.costumes.find(c=>c.name==='梭梭树1');c.assetId=hash;c.md5ext=hash+'.png';c.rotationCenterX=1254;c.rotationCenterY=1200;
 for(const b of Object.values(tree.blocks)) if(b.opcode==='operator_gt' && b.inputs.OPERAND1?.[1]?.[2]==='%z6KO!=AV03bkJsGH`QJ')b.inputs.OPERAND1=[2,[12,name,id]];
}
zip.file('project.json',JSON.stringify(p));
await fs.writeFile('mblock-project/exports/沙漠绿色公益-苗木衔接-v011.mblock',await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}}));
console.log('Updated five trees and completion-based reveal');

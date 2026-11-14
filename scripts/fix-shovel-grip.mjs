import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import JSZip from 'jszip';

const zip=await JSZip.loadAsync(await fs.readFile('mblock-project/exports/沙漠绿色公益-肩膀无苗-v031.mblock'));
const p=JSON.parse(await zip.file('project.json').async('string'));
const robot=p.targets.find(t=>t.name==='蓝豆机器人'),shovel=p.targets.find(t=>t.name==='机器人铁铲');
const costume=shovel.costumes[0],old=await zip.file(costume.md5ext).async('string');
// The prop is in front of the torso/legs, but its grip has an opening so the
// original fingers remain visible over the shaft. No robot pixels are changed.
const start=old.indexOf('</defs>')+7;assert(start>7);
const mask='<defs><mask id="hand-grip" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="600"><rect width="100" height="600" fill="white"/><ellipse cx="50" cy="280" rx="36" ry="35" fill="black"/></mask></defs>';
const svg=old.slice(0,start)+mask+'<g mask="url(#hand-grip)">'+old.slice(start).replace('</svg>','</g></svg>');
const hash=crypto.createHash('md5').update(svg).digest('hex');zip.file(`${hash}.svg`,svg);
costume.assetId=hash;costume.md5ext=`${hash}.svg`;
await fs.writeFile('mblock-project/assets/props/robot-shovel-grip-v032.svg',svg);
// Calibrated in the original 1254px costume coordinates, with unchanged pivots.
const poses=[{x:535,y:977},{x:545,y:985},{x:590,y:1005},{x:590,y:1025},{x:565,y:1040},{x:535,y:1045}];
const unique=new Map();
for(const [i,c]of robot.costumes.entries()){
 if(i>=5&&!unique.has(c.md5ext))unique.set(c.md5ext,unique.size);
 const grip=i>=5?poses[unique.get(c.md5ext)]:i===3?{x:525,y:1090}:i===4?{x:550,y:1090}:{x:350,y:980};assert(grip);
 shovel.lists['shovel-X'][1][i]=(grip.x-c.rotationCenterX)/2;
 shovel.lists['shovel-Y'][1][i]=(c.rotationCenterY-grip.y)/2;
}
const order=p.targets.filter(t=>!t.isStage&&t!==shovel).sort((a,b)=>a.layerOrder-b.layerOrder);
order.splice(order.indexOf(robot)+1,0,shovel);order.forEach((t,i)=>{t.layerOrder=i+1;});
const i=robot.currentCostume,scale=robot.size/100;
shovel.x=robot.x+shovel.lists['shovel-X'][1][i]*scale;
shovel.y=robot.y+shovel.lists['shovel-Y'][1][i]*scale;
shovel.size=robot.size/2;shovel.direction=shovel.lists['shovel-angle'][1][i];
zip.file('project.json',JSON.stringify(p));
const output='mblock-project/exports/沙漠绿色公益-握紧铁铲-v032.mblock';
await fs.writeFile(output,await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}}));
console.log(output);

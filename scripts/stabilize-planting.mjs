import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import sharp from 'sharp';

const source='mblock-project/exports/沙漠绿色公益-手掌遮挡修正-v035.mblock';
const output='mblock-project/exports/沙漠绿色公益-种植稳固-v036.mblock';
const root='mblock-project/assets/props/stable-v036';
const zip=await JSZip.loadAsync(await fs.readFile(source));
const p=JSON.parse(await zip.file('project.json').async('string'));
const robot=p.targets.find(t=>t.name==='蓝豆机器人');
const shovel=p.targets.find(t=>t.name==='机器人铁铲');
await fs.mkdir(root,{recursive:true});

// Register the contact points on the ground, not the antenna on a bending head.
// Keep the original PNG bytes: the SVG only places the robot and its vector prop.
async function feet(bytes){
 const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let left=info.width,right=-1,bottom=-1;
 for(let y=info.height-1;y>1080&&bottom<0;y--)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>200){bottom=y;break;}
 // Use soles only; the wider upper part of a shoe changes shape when bending.
 for(let y=bottom-70;y<=bottom;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>200){left=Math.min(left,x);right=Math.max(right,x);}
 assert(right>left&&bottom>1080,'No opaque feet detected');
 return {x:(left+right)/2,y:bottom};
}
const stand=robot.costumes[0],reference=await feet(await zip.file(stand.md5ext).async('nodebuffer'));
const ground={x:reference.x-stand.rotationCenterX,y:reference.y-stand.rotationCenterY};
const padding=256,canvas=1254+padding*2,manifest=[],cache=new Map(),previews=[];
const originalCostumes=structuredClone(robot.costumes);
for(const [i,c]of robot.costumes.entries()){
 const original=await zip.file(c.md5ext).async('nodebuffer');
 const foot=await feet(original);
 const pivot={x:foot.x-ground.x,y:foot.y-ground.y};
 const grip={x:c.rotationCenterX+shovel.lists['shovel-X'][1][i]*2,y:c.rotationCenterY-shovel.lists['shovel-Y'][1][i]*2};
 const angle=shovel.lists['shovel-angle'][1][i];
 const prop=await zip.file(shovel.costumes[i].md5ext).async('string');
 const placedProp=prop.replace('<svg ','<svg x="-50" y="-280" ');
 // A single costume commits the body, hand cutout and shovel in one renderer
 // update. Independent forever loops can otherwise display different poses.
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${canvas/2}" height="${canvas/2}" viewBox="0 0 ${canvas} ${canvas}"><g transform="translate(${padding} ${padding})"><image width="1254" height="1254" xlink:href="data:image/png;base64,${original.toString('base64')}"/><g transform="translate(${grip.x} ${grip.y}) rotate(${angle-90})">${placedProp}</g></g></svg>`;
 const bytes=Buffer.from(svg),hash=crypto.createHash('md5').update(bytes).digest('hex');
 zip.file(`${hash}.svg`,bytes);
 const sourceAsset=c.md5ext;
 Object.assign(c,{assetId:hash,md5ext:`${hash}.svg`,dataFormat:'svg',bitmapResolution:1,rotationCenterX:(pivot.x+padding)/2,rotationCenterY:(pivot.y+padding)/2});
 delete c.size;
 manifest.push({costume:i+1,name:c.name,sourceAsset,propAsset:shovel.costumes[i].md5ext,feet:foot,pivot,grip,angle,asset:c.md5ext});
 if(!cache.has(hash))cache.set(hash,bytes);
 // Repeated poses now use exactly the same bytes and pivots both ways.
 if([5,7,9,11,13,15].includes(i)){
  const x=215-c.rotationCenterX*.48,y=185-c.rotationCenterY*.48;
  const view=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="430" height="410"><rect width="430" height="410" fill="#efdfb8"/><svg x="${x}" y="${y}" width="${canvas*.24}" height="${canvas*.24}" viewBox="0 0 ${canvas} ${canvas}">${svg.slice(svg.indexOf('<g'),svg.lastIndexOf('</svg>'))}</svg><path d="M0 ${185+ground.y*.24}H430" stroke="#b1652a" stroke-width="1"/><text x="12" y="24" font-size="16">${c.name}</text></svg>`;
  const j=previews.length;
  previews.push({input:await sharp(Buffer.from(view)).png().toBuffer(),left:j%3*430,top:Math.floor(j/3)*410});
 }
}
// The original stand and the animation were independently drawn. Use the first
// upright planting pose as the gameplay idle too, avoiding a jump at entry/exit.
for(const b of Object.values(robot.blocks))if(b.opcode==='looks_switchcostumeto'&&b.inputs.COSTUME?.[1]?.[1]==='蓝豆机器人')b.inputs.COSTUME=[1,[10,'种树24-01']];
robot.currentCostume=5;
// Retain the editable vector assets, but disable their separate display/follower.
shovel.visible=false;
shovel.blocks={
 'stable-hide-start':{opcode:'event_whenflagclicked',next:'stable-hide-prop',parent:null,inputs:{},fields:{},shadow:false,topLevel:true,x:30,y:30},
 'stable-hide-prop':{opcode:'looks_hide',next:null,parent:'stable-hide-start',inputs:{},fields:{},shadow:false,topLevel:false},
};
// The originals are embedded losslessly in the new SVGs. Remove their unused
// standalone ZIP copies so the project stays within the bridge's 40 MiB limit.
const referenced=new Set(p.targets.flatMap(t=>[...t.costumes,...t.sounds].map(a=>a.md5ext)));
for(const asset of new Set(originalCostumes.map(c=>c.md5ext)))if(!referenced.has(asset))zip.remove(asset);
await fs.writeFile(`${root}/alignment.json`,JSON.stringify({source,ground,padding,canvas,originalCostumes,frames:manifest},null,2)+'\n');
await sharp({create:{width:1290,height:820,channels:3,background:'#efdfb8'}}).composite(previews).png().toFile(`${root}/preview.png`);
zip.file('project.json',JSON.stringify(p));
const archive=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}});
assert(archive.length<40*1024*1024,'Project exceeds MCP export size limit');
await fs.writeFile(output,archive);
console.log(`${output}: ${cache.size} assets, 29 registered poses, one renderer update per body/shovel pose.`);

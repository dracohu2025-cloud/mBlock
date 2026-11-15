import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import JSZip from 'jszip';
import sharp from 'sharp';

const root='mblock-project/assets/props/walk-v037';
const zip=await JSZip.loadAsync(await fs.readFile('mblock-project/exports/沙漠绿色公益-机器人走路-v037.mblock'));
const p=JSON.parse(await zip.file('project.json').async('string'));
const robot=p.targets.find(t=>t.name==='蓝豆机器人'),stage=p.targets.find(t=>t.isStage);
const backdrop=(await zip.file(stage.costumes[0].md5ext).async('nodebuffer')).toString('base64');
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'mblock-walk-preview-'));
const sources=new Map(),tiles=[],sequence=[];
for(let i=0;i<8;i++){
 const c=robot.costumes[i+29],svg=await zip.file(c.md5ext).async('string');sources.set(i+29,svg);
 const tile=`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="330"><rect width="320" height="330" fill="#efdfb8"/><g transform="translate(165 155) scale(.4)">${svg.replace('<svg ',`<svg x="${-c.rotationCenterX}" y="${-c.rotationCenterY}" `)}</g><text x="12" y="24">${c.name}</text></svg>`;
 tiles.push({input:await sharp(Buffer.from(tile)).png().toBuffer(),left:i%4*320,top:Math.floor(i/4)*330});
}
await sharp({create:{width:1280,height:660,channels:3,background:'#efdfb8'}}).composite(tiles).png().toFile(`${root}/preview.png`);
for(let i=0;i<12;i++)sequence.push({index:5,x:-160,y:35});
for(let i=1;i<=24;i++)sequence.push({index:29+(i-1)%8,x:-160+280*i/24,y:35-43*i/24});
for(let i=0;i<24;i++)sequence.push({index:5+i,x:120,y:-8});
for(let i=1;i<=24;i++)sequence.push({index:29+(i-1)%8,x:120-280*i/24,y:-8+43*i/24});
for(let i=0;i<12;i++)sequence.push({index:5,x:-160,y:35});
for(const [i,pose]of sequence.entries()){
 const c=robot.costumes[pose.index];if(!sources.has(pose.index))sources.set(pose.index,await zip.file(c.md5ext).async('string'));
 const body=sources.get(pose.index).replace('<svg ',`<svg x="${-c.rotationCenterX}" y="${-c.rotationCenterY}" `);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="540"><image href="data:image/png;base64,${backdrop}" width="720" height="540"/><g transform="translate(${(240+pose.x)*1.5} ${(180-pose.y)*1.5}) scale(.48)">${body}</g></svg>`;
 await sharp(Buffer.from(svg)).png().toFile(path.join(dir,`${String(i).padStart(3,'0')}.png`));
}
const output=path.resolve(`${root}/walking-preview.mp4`);
const result=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-framerate','24','-i',path.join(dir,'%03d.png'),'-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',output],{encoding:'utf8'});
if(result.status!==0)throw Error(result.stderr);
await fs.rm(dir,{recursive:true});
console.log(`${output}: 96 frames at 24 fps; walking, planting and return. Asset preview, not an App recording.`);

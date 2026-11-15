import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import JSZip from 'jszip';
import sharp from 'sharp';

const file='mblock-project/exports/沙漠绿色公益-种植稳固-v036.mblock';
const zip=await JSZip.loadAsync(await fs.readFile(file));
const p=JSON.parse(await zip.file('project.json').async('string'));
const robot=p.targets.find(t=>t.name==='蓝豆机器人'),stage=p.targets.find(t=>t.isStage);
const backdrop=await zip.file(stage.costumes[0].md5ext).async('nodebuffer');
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'mblock-v036-preview-'));
// Six idle frames on each side expose any start/end jump. Two full cycles.
const cycle=[...Array(6).fill(5),...Array.from({length:24},(_,i)=>i+5),...Array(6).fill(5)];
const cache=new Map();
for(const [i,index]of [...cycle,...cycle].entries()){
 const c=robot.costumes[index];
 if(!cache.has(index)){
  const svg=await zip.file(c.md5ext).async('string');
  const placed=svg.replace('<svg ',`<svg x="${-c.rotationCenterX}" y="${-c.rotationCenterY}" `);
  const frame=`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="540"><image href="data:image/png;base64,${backdrop.toString('base64')}" width="720" height="540"/><g transform="translate(360 225) scale(.48)">${placed}</g></svg>`;
  cache.set(index,await sharp(Buffer.from(frame)).png().toBuffer());
 }
 await fs.writeFile(path.join(dir,`${String(i).padStart(3,'0')}.png`),cache.get(index));
}
const output=path.resolve('mblock-project/assets/props/stable-v036/planting-preview.mp4');
const rendered=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-framerate','24','-i',path.join(dir,'%03d.png'),'-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',output],{encoding:'utf8'});
if(rendered.status!==0)throw Error(rendered.stderr);
console.log(`${output}: 72 frames, 24 fps, 3 seconds. Rendered preview; not an App playthrough.`);

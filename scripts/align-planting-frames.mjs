import fs from 'node:fs/promises';
import JSZip from 'jszip';
import sharp from 'sharp';

const source = 'mblock-project/exports/沙漠绿色公益-透明动画-v006.mblock';
const output = 'mblock-project/exports/沙漠绿色公益-稳定动画-v007.mblock';
const zip = await JSZip.loadAsync(await fs.readFile(source));
const project = JSON.parse(await zip.file('project.json').async('string'));
const robot = project.targets.find(t => t.name === '蓝豆机器人');
if (!robot) throw new Error('Robot missing');
const frames = robot.costumes.filter(c => /^种树24-\d\d$/.test(c.name));
if (frames.length !== 24) throw new Error(`Expected 24 frames, got ${frames.length}`);

// Locate the cyan antenna at the top of each transparent image. Its center is
// a stable horizontal anchor; its changing height preserves the planting motion.
async function antenna(bytes) {
  const {data, info} = await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const cyan = (x,y) => { const p=(y*info.width+x)*4; return data[p]<100 && data[p+1]>170 && data[p+2]>170 && data[p+3]>150; };
  let top=info.height, minX=info.width, maxX=-1;
  for(let y=0;y<info.height;y++) for(let x=0;x<info.width;x++) {
    if(data[(y*info.width+x)*4+3]>0) { minX=Math.min(minX,x); maxX=Math.max(maxX,x); }
    if(y<500 && cyan(x,y)) top=Math.min(top,y);
  }
  if(top===info.height) throw new Error('Antenna not detected');
  let sum=0,count=0;
  for(let y=top;y<Math.min(top+65,info.height);y++) for(let x=0;x<info.width;x++) if(cyan(x,y)) {sum+=x;count++;}
  if(count<100) throw new Error('Antenna detection too small');
  return {x:sum/count,width:info.width,height:info.height,minX,maxX};
}
const stand=robot.costumes.find(c=>c.name==='蓝豆机器人');
const anchor=await antenna(await zip.file(stand.md5ext).async('nodebuffer'));
for(const costume of frames) {
  const bytes=await zip.file(costume.md5ext).async('nodebuffer');
  const a=await antenna(bytes);
  const dx=Math.round(anchor.x-a.x);
  // Move the costume rotation center instead of cropping pixels. mBlock
  // positions costumes relative to this point, so all antennae share an x.
  costume.rotationCenterX -= dx;
  const effectiveX = a.x - costume.rotationCenterX;
  const targetX = anchor.x - stand.rotationCenterX;
  if(Math.abs(effectiveX-targetX)>0.6) throw new Error(`Alignment failed ${costume.name}`);
  console.log(`${costume.name}: center adjustment ${-dx}px`);
}
zip.file('project.json',JSON.stringify(project));
await fs.writeFile(output,await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}}));
console.log(`Wrote ${output}`);

import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import JSZip from 'jszip';
import sharp from 'sharp';
const zip=await JSZip.loadAsync(await fs.readFile('mblock-project/exports/沙漠绿色公益-高挑梭梭树-v009.mblock'));
const project=JSON.parse(await zip.file('project.json').async('string'));
const trees=project.targets.filter(t=>/^梭梭树[1-5]$/.test(t.name));
if(trees.length!==5) throw Error('Expected five trees');
const original=trees[0].costumes.find(c=>c.name==='成熟梭梭树');
const {width,height}=await sharp(await zip.file(original.md5ext).async('nodebuffer')).metadata();
const newHeight=Math.round(height*0.90);
const png=await sharp(await zip.file(original.md5ext).async('nodebuffer')).resize(width,newHeight,{fit:'fill'}).png().toBuffer();
const hash=crypto.createHash('md5').update(png).digest('hex');
zip.file(`${hash}.png`,png);
for(const tree of trees){const c=tree.costumes.find(c=>c.name==='成熟梭梭树');c.assetId=hash;c.md5ext=`${hash}.png`;c.rotationCenterY+=newHeight-height;}
zip.file('project.json',JSON.stringify(project));
await fs.writeFile('mblock-project/exports/沙漠绿色公益-适中梭梭树-v010.mblock',await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}}));
console.log(`Five trees: ${width}x${height} -> ${width}x${newHeight}; roots anchored`);

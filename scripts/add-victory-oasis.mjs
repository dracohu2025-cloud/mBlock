import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import sharp from 'sharp';

const source='mblock-project/exports/沙漠绿色公益-无铲走路-v039.mblock';
const output='mblock-project/exports/沙漠绿色公益-通关绿洲-v040.mblock';
const root='mblock-project/assets/oasis/v040';
const zip=await JSZip.loadAsync(await fs.readFile(source));
const p=JSON.parse(await zip.file('project.json').async('string'));
const stage=p.targets.find(t=>t.isStage),b=stage.blocks;
assert.equal(stage.costumes.length,10);assert.equal(b['fireworks-lock'].next,'fireworks-reset');
const png=await sharp(`${root}/oasis-original.png`).resize(960,720).removeAlpha().png().toBuffer();
await fs.writeFile(`${root}/oasis.png`,png);
const hash=crypto.createHash('md5').update(png).digest('hex');zip.file(`${hash}.png`,png);
stage.costumes.push({name:'胜利绿洲',bitmapResolution:2,dataFormat:'png',assetId:hash,md5ext:`${hash}.png`,rotationCenterX:480,rotationCenterY:360});
// This branch only runs after all five plants have matured in the final level.
// Existing level-start/retry logic selects 1..10; replay restores level 1.
b['fireworks-lock'].next='oasis-victory-backdrop';
b['oasis-victory-backdrop']={opcode:'looks_switchbackdropto',parent:'fireworks-lock',next:'oasis-victory-name',inputs:{BACKDROP:[1,[10,'胜利绿洲']]},fields:{},shadow:false,topLevel:false};
b['oasis-victory-name']={opcode:'data_setvariableto',parent:'oasis-victory-backdrop',next:'fireworks-reset',inputs:{VALUE:[1,[10,'胜利绿洲']]},fields:{VARIABLE:['本关沙漠','game-desert-name']},shadow:false,topLevel:false};
b['fireworks-reset'].parent='oasis-victory-name';
zip.file('project.json',JSON.stringify(p));
const archive=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}});
assert(archive.length<40*1024*1024);await fs.writeFile(output,archive);
console.log(`${output}: final-level oasis before fireworks and badge; ${archive.length} bytes.`);

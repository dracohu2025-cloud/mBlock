import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import JSZip from 'jszip';

const source='mblock-project/exports/沙漠绿色公益-选项按钮-v042.mblock';
const output='mblock-project/exports/沙漠绿色公益-原地等待-v043.mblock';
const zip=await JSZip.loadAsync(await fs.readFile(source));
const p=JSON.parse(await zip.file('project.json').async('string'));
const robot=p.targets.find(t=>t.name==='蓝豆机器人'),b=robot.blocks;
assert.equal(b['quiz-reading-position'].next,'walk-return-if');
const next=b['walk-return-if'].next;
// Wait for the planting animation to finish, then ask at the planted position.
// The next correct answer captures this position as the next walk's origin.
b['quiz-reading-position'].next=next;b[next].parent='quiz-reading-position';
for(const id of Object.keys(b))if(/^(walk-back-|walk-return-|walk-at-|walk-current-)/.test(id))delete b[id];
for(const t of p.targets)for(const [id,block]of Object.entries(t.blocks)){
 for(const ref of [block.parent,block.next])if(ref)assert(t.blocks[ref],`${id}: missing ${ref}`);
 for(const input of Object.values(block.inputs||{}))for(const ref of input.slice(1))if(typeof ref==='string')assert(t.blocks[ref],`${id}: missing input ${ref}`);
}
zip.file('project.json',JSON.stringify(p));
await fs.writeFile(output,await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}}));
console.log(`${output}: planted position retained; planting wait and onward walking preserved.`);

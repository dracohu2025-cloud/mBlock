import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import JSZip from 'jszip';

const zip=await JSZip.loadAsync(await fs.readFile('mblock-project/exports/沙漠绿色公益-通关徽章-v028.mblock'));
const p=JSON.parse(await zip.file('project.json').async('string'));
const robot=p.targets.find(t=>t.name==='蓝豆机器人'),b=robot.blocks;
const position={X:[1,[4,'-160']],Y:[1,[4,'-85']]};
// A fixed, lower reading position keeps the bubble away from the level header,
// including questions asked after the robot has moved to a planting location.
Object.assign(b['aO5KSZdI:Ka`wRN4bRnT'].inputs,structuredClone(position));
robot.x=-160;robot.y=-85;
const say='Cd,{PLq6LSl;PaxXPXTU',parent=b[say].parent;
assert.equal(b[parent].next,say);
b[parent].next='quiz-reading-position';b[say].parent='quiz-reading-position';
b['quiz-reading-position']={opcode:'motion_gotoxy',next:say,parent,inputs:structuredClone(position),fields:{},shadow:false,topLevel:false};
// Remove the question before moving to plant, so its bubble cannot follow the
// robot upwards and overlap the header during the transition.
const wait='Cd,{PLq6LSl;PaxXPXTU-wait',next=b[wait].next;
b[wait].next='quiz-clear-before-feedback';b[next].parent='quiz-clear-before-feedback';
b['quiz-clear-before-feedback']={opcode:'looks_say',next,parent:wait,inputs:{MESSAGE:[1,[10,'']]},fields:{},shadow:false,topLevel:false};
zip.file('project.json',JSON.stringify(p));
const output='mblock-project/exports/沙漠绿色公益-题目避让标题-v029.mblock';
await fs.writeFile(output,await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}}));
console.log(output);

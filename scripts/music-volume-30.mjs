import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
const zip=await JSZip.loadAsync(await fs.readFile('mblock-project/exports/沙漠绿色公益-成长停音乐-v014.mblock'));
const p=JSON.parse(await zip.file('project.json').async('string'));
const stage=p.targets.find(t=>t.isStage);
for(const id of ['music-volume','music-unmute']){
 assert.equal(stage.blocks[id].opcode,'sound_setvolumeto');
 stage.blocks[id].inputs.VOLUME=[1,[4,'30']];
}
stage.volume=30;
assert.equal(stage.blocks['music-stop-sounds'].opcode,'sound_stopallsounds');
assert.equal(stage.blocks['music-stop-loop'].opcode,'control_stop');
zip.file('project.json',JSON.stringify(p));
const output='mblock-project/exports/沙漠绿色公益-音乐30-v015.mblock';
await fs.writeFile(output,await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}}));
console.log(output);

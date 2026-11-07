import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
const zip=await JSZip.loadAsync(await fs.readFile('mblock-project/exports/沙漠绿色公益-音乐版-v013.mblock'));
const p=JSON.parse(await zip.file('project.json').async('string'));
const stage=p.targets.find(t=>t.isStage),robot=p.targets.find(t=>t.name==='蓝豆机器人');
const trees=p.targets.filter(t=>/^梭梭树[1-5]$/.test(t.name));assert.equal(trees.length,5);
const id='mature-tree-count',name='已长大树数';stage.variables[id]=[name,0];
const mk=(opcode,parent,next,inputs={},fields={})=>({opcode,parent,next,inputs,fields,shadow:false,topLevel:false});
const b=stage.blocks;
// Restore 70 both on green flag and when toggling M back on.
for(const key of ['music-volume','music-unmute'])b[key].inputs.VOLUME=[1,[4,'70']];stage.volume=70;
b['music-start'].next='mature-reset';b['music-volume'].parent='mature-reset';
b['mature-reset']=mk('data_setvariableto','music-start','music-volume',{VALUE:[1,[4,'0']]},{VARIABLE:[name,id]});
for(const tree of trees){
 const entry=Object.entries(tree.blocks).find(([k,x])=>x.opcode==='control_repeat'&&Object.values(tree.blocks).some(y=>y.parent===k&&y.opcode==='looks_changesizeby'));
 assert(entry,`${tree.name} growth loop missing`);const [key,loop]=entry;assert.equal(loop.next,null);
 loop.next='notify-mature';tree.blocks['notify-mature']=mk('data_changevariableby',key,null,{VALUE:[1,[4,'1']]},{VARIABLE:[name,id]});
}
b['music-finish-start']={...mk('event_whenflagclicked',null,'music-finish-reset-wait'),topLevel:true,x:1250,y:50};
b['music-finish-reset-wait']=mk('control_wait','music-finish-start','music-finish-wait',{DURATION:[1,[4,'0.3']]});
b['music-finish-wait']=mk('control_wait_until','music-finish-reset-wait','music-stop-sounds',{CONDITION:[2,'music-grown-condition']});
b['music-grown-condition']=mk('operator_gt','music-finish-wait',null,{OPERAND1:[2,[12,name,id]],OPERAND2:[1,[4,'4']]});
b['music-stop-sounds']=mk('sound_stopallsounds','music-finish-wait','music-stop-loop');
b['music-stop-loop']={...mk('control_stop','music-stop-sounds',null,{}, {STOP_OPTION:['other scripts in sprite',null]}),mutation:{tagName:'mutation',children:[],hasnext:'true'}};
// Completion must stay silent; retain robot effect-volume setup for correct answers.
robot.blocks['effects-volume'].next=null;
for(const key of ['victory-reset-wait','victory-wait','victory-condition','victory-growth-wait','victory-cue','victory-cue-menu'])delete robot.blocks[key];
for(const t of p.targets)for(const [key,v] of Object.entries(t.blocks)){
 for(const k of ['next','parent'])if(v[k])assert(t.blocks[v[k]],`${t.name} ${key}.${k}`);
 for(const input of Object.values(v.inputs||{}))for(const ref of input.slice(1))if(typeof ref==='string')assert(t.blocks[ref],`${key} input`);
}
assert.equal(b['music-unmute'].inputs.VOLUME[1][1],'70');
assert.equal(trees.filter(t=>t.blocks['notify-mature']).length,5);
assert(!Object.values(robot.blocks).some(v=>v.opcode==='sound_sounds_menu'&&v.fields.SOUND_MENU[0]==='绿洲完成'));
zip.file('project.json',JSON.stringify(p));
const output='mblock-project/exports/沙漠绿色公益-成长停音乐-v014.mblock';
await fs.writeFile(output,await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}}));
console.log(output);console.log('PASS: music volume 70; five growth-completion signals; stop sounds and loop; no delayed victory playback; block links valid.');

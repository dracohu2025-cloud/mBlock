import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
const zip=await JSZip.loadAsync(await fs.readFile('mblock-project/exports/沙漠绿色公益-机器人铁铲-v018.mblock'));
const p=JSON.parse(await zip.file('project.json').async('string'));
const robot=p.targets.find(t=>t.name==='蓝豆机器人'), b=robot.blocks;
const questions=JSON.parse(await fs.readFile('mblock-project/assets/questions/desert-extra-20.json','utf8'));
assert.equal(questions.length,20);
const templates=Object.fromEntries(['if','eq','q','a'].map(type=>[type,structuredClone(b[`desert_42_${type}`])]));
const after=b.desert_42_if.next;let previous='desert_42_if';
for(const [i,q] of questions.entries()){
 const n=43+i;assert(['A','B'].includes(q.answer));assert(q.question&&q.A&&q.B&&q.A!==q.B);
 for(const type of ['if','eq','q','a']){
  const copy=JSON.parse(JSON.stringify(templates[type]).replaceAll('desert_42_',`desert_${n}_`));
  b[`desert_${n}_${type}`]=copy;
 }
 const id=`desert_${n}_if`;
 b[previous].next=id;b[id].parent=previous;b[id].next=after;
 b[`desert_${n}_eq`].inputs.OPERAND2=[1,[4,String(n)]];
 b[`desert_${n}_q`].inputs.VALUE=[1,[10,`${q.question} A ${q.A} B ${q.B}（点击下方 A 或 B）`]];
 b[`desert_${n}_a`].inputs.VALUE=[1,[10,q.answer]];
 previous=id;
}
b[after].parent=previous;
for(const v of Object.values(b))if(v.opcode==='operator_random'&&String(v.inputs.TO?.[1]?.[1])==='42')v.inputs.TO=[1,[4,'62']];
for(const t of p.targets)for(const [id,v] of Object.entries(t.blocks)){
 for(const k of ['parent','next'])if(v[k])assert(t.blocks[v[k]],`${t.name}:${id}.${k}`);
 for(const input of Object.values(v.inputs||{}))for(const ref of input.slice(1))if(typeof ref==='string')assert(t.blocks[ref],`${id} input ${ref}`);
}
const setters=Object.values(b).filter(x=>x.opcode==='data_setvariableto'&&x.fields.VARIABLE?.[0]==='当前题目');
assert.equal(setters.length,62);assert.equal(new Set(setters.map(x=>x.inputs.VALUE[1][1])).size,62);
assert(!Object.values(b).some(x=>x.opcode==='sensing_askandwait'));
zip.file('project.json',JSON.stringify(p));
const output='mblock-project/exports/沙漠绿色公益-扩展题库-v019.mblock';
await fs.writeFile(output,await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}}));
console.log(`${output}: 62 questions, 20 added; A/B answers balanced in new questions.`);

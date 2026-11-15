import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import sharp from 'sharp';
const file=process.argv[2]||'mblock-project/exports/沙漠绿色公益-选项按钮-v042.mblock';
const zip=await JSZip.loadAsync(await fs.readFile(file));
const source=await JSZip.loadAsync(await fs.readFile('mblock-project/exports/沙漠绿色公益-沙生绿洲-v041.mblock'));
const p=JSON.parse(await zip.file('project.json').async('string')),prior=JSON.parse(await source.file('project.json').async('string'));
const r=p.targets.find(t=>t.name==='蓝豆机器人'),old=prior.targets.find(t=>t.name===r.name),stage=p.targets.find(t=>t.isStage);
const manifest=JSON.parse(await fs.readFile('mblock-project/assets/buttons/v042/questions.json','utf8'));
const expected=new Map(),questionVariable='Ls*3*d8|jjq(bUHN*G6-';
for(const [id,b]of Object.entries(old.blocks))if(b.opcode==='data_setvariableto'&&b.fields.VARIABLE?.[1]===questionVariable){
 const text=b.inputs.VALUE[1][1],a=text.indexOf(' A '),bb=text.indexOf(' B ',a+3);assert(a>0&&bb>a);
 const number=Number(old.blocks[old.blocks[b.parent].inputs.CONDITION[1]].inputs.OPERAND2[1][1]);
 const q={number,question:text.slice(0,a),A:text.slice(a+3,bb),B:text.slice(bb+3).replace('（点击下方 A 或 B）',''),answer:old.blocks[b.next].inputs.VALUE[1][1]};
 expected.set(number,q);assert.deepEqual(manifest[number-1],q);
 assert.equal(r.blocks[id].inputs.VALUE[1][1],q.question,'Bubble must contain only the stem');
 const select=r.blocks[r.blocks[id].next];assert.equal(select.opcode,'data_setvariableto');assert.equal(select.fields.VARIABLE[1],'quiz-option-number');assert.equal(Number(select.inputs.VALUE[1][1]),number);
 assert.equal(select.next,b.next);assert.deepEqual(r.blocks[b.next].inputs,old.blocks[b.next].inputs,'Correct answer must not change');
}
assert.equal(expected.size,132);
assert.equal(new Set(manifest.map(q=>q.number)).size,132);
for(const letter of ['A','B']){
 const t=p.targets.find(t=>t.name===`答案${letter}`),before=prior.targets.find(o=>o.name===t.name);assert.equal(t.costumes.length,132);
 assert.deepEqual(stage.lists['quiz-option-'+letter][1],manifest.map(q=>q[letter]));
 for(const id of ['click','click-check','is-ready-click','lock','select'])assert.deepEqual(t.blocks[id],before.blocks[id],'Click locking and answer code must stay intact');
 assert.equal(t.blocks.show.parent,'option-costume');assert.equal(t.blocks['option-costume'].inputs.COSTUME[1][2],'quiz-option-number');
 assert.equal(t.y,-151);assert(t.x-112>=-240&&t.x+112<=240);assert(t.y-24>=-180);
 for(const [i,c]of t.costumes.entries()){
  assert.equal(c.name,`${letter}选项${String(i+1).padStart(3,'0')}`);assert.equal(c.bitmapResolution,2);
  const meta=await sharp(await zip.file(c.md5ext).async('nodebuffer')).metadata();assert.equal(meta.width,448);assert.equal(meta.height,96);
 }
}
assert.deepEqual(r.costumes,old.costumes,'Robot artwork must not change');
for(const t of p.targets)if(![r.name,'Stage','答案A','答案B'].includes(t.name)){
 const o=prior.targets.find(x=>x.name===t.name);assert.deepEqual(t.blocks,o.blocks);assert.deepEqual(t.costumes,o.costumes);
}
for(const t of p.targets){for(const c of [...t.costumes,...t.sounds])assert(zip.file(c.md5ext));for(const [id,b]of Object.entries(t.blocks)){
 for(const ref of [b.parent,b.next])if(ref)assert(t.blocks[ref],`${id}: broken ${ref}`);
 for(const a of Object.values(b.inputs||{}))for(const ref of a.slice(1))if(typeof ref==='string')assert(t.blocks[ref],`${id}: missing input ${ref}`);
}}
assert((await fs.stat(file)).size<40*1024*1024);
console.log('PASS: all 132 stems/options/answers match the original bank; both 132-costume PNG buttons select by question number; click locks, artwork and unrelated scripts intact; valid geometry/assets/blocks.');

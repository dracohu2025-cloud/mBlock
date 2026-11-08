import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import JSZip from 'jszip';

const zip = await JSZip.loadAsync(await fs.readFile('mblock-project/exports/沙漠绿色公益-答错重来-v021.mblock'));
const project = JSON.parse(await zip.file('project.json').async('string'));
const stage = project.targets.find(t => t.isStage);
const robot = project.targets.find(t => t.name === '蓝豆机器人');
const hud = project.targets.find(t => t.name === '关卡标题');
const next = project.targets.find(t => t.name === '关卡继续按钮');
const additions = JSON.parse(await fs.readFile('mblock-project/assets/questions/levels-4-to-10.json', 'utf8'));
const total = 3 + additions.length;
assert.equal(total, 10);
const num = n => [1, [4, String(n)]];
const str = s => [1, [10, s]];
const totalInput = () => [2, [12, '总关卡数', 'game-total-levels']];
stage.variables['game-total-levels'] = ['总关卡数', total];

// Extend the existing serialized question chain without changing its prompt,
// correct-answer animation or failure/restart scripts.
const rb = robot.blocks;
const templates = Object.fromEntries(['if', 'eq', 'q', 'a'].map(type => [type, structuredClone(rb[`desert_62_${type}`])]));
const afterQuestions = rb.desert_62_if.next;
let previousQuestion = 'desert_62_if';
let questionId = 62;
for (const [i, level] of additions.entries()) {
  assert.equal(level.level, i + 4);
  assert.equal(level.questions.length, 10);
  assert.equal(level.questions.filter(q => q.answer === 'A').length, 5);
  const pool = [];
  for (const q of level.questions) {
    assert(q.question && q.A && q.B && q.A !== q.B && ['A', 'B'].includes(q.answer));
    const n = ++questionId;
    pool.push(n);
    for (const type of ['if', 'eq', 'q', 'a']) {
      rb[`desert_${n}_${type}`] = JSON.parse(JSON.stringify(templates[type]).replaceAll('desert_62_', `desert_${n}_`));
    }
    const id = `desert_${n}_if`;
    rb[previousQuestion].next = id;
    rb[id].parent = previousQuestion;
    rb[id].next = afterQuestions;
    rb[`desert_${n}_eq`].inputs.OPERAND2 = num(n);
    rb[`desert_${n}_q`].inputs.VALUE = str(`${q.question} A ${q.A} B ${q.B}（点击下方 A 或 B）`);
    rb[`desert_${n}_a`].inputs.VALUE = str(q.answer);
    previousQuestion = id;
  }
  stage.lists[`level-bank-${level.level}`] = [`第${level.level}关题号`, pool];
}
rb[afterQuestions].parent = previousQuestion;
assert.equal(questionId, 132);

// Reuse the existing level setup pattern: select this level's pool, then run
// the same five-tree round. Level retry continues to keep the current level.
const sb = stage.blocks;
const sourceIds = Array.from({length: 7}, (_, i) => `levels-${27 + i}`);
const setupTemplates = Object.fromEntries(sourceIds.map(id => [id, structuredClone(sb[id])]));
const afterSetup = sb['levels-27'].next;
let previousSetup = 'levels-27';
function remap(value, mapping) {
  if (typeof value === 'string') return mapping[value] || value;
  if (Array.isArray(value)) return value.map(v => remap(v, mapping));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, remap(v, mapping)]));
  return value;
}
for (const level of additions) {
  const map = Object.fromEntries(sourceIds.map(id => [id, `level-${level.level}-setup-${id.slice(7)}`]));
  for (const id of sourceIds) sb[map[id]] = remap(structuredClone(setupTemplates[id]), map);
  const first = map['levels-27'];
  sb[previousSetup].next = first;
  sb[first].parent = previousSetup;
  sb[first].next = afterSetup;
  sb[map['levels-28']].inputs.OPERAND2 = num(level.level);
  sb[map['levels-29']].inputs.TIMES = num(level.questions.length);
  sb[map['levels-31']].fields.LIST = [`第${level.level}关题号`, `level-bank-${level.level}`];
  previousSetup = first;
}
sb[afterSetup].parent = previousSetup;
assert.equal(sb['levels-3'].opcode, 'control_repeat');
sb['levels-3'].inputs.TIMES = totalInput();
sb['levels-36'].inputs.OPERAND2 = totalInput();
next.blocks['next-51'].inputs.OPERAND2 = totalInput();

// Keep the user's title-strip layout, with a matching costume for every level.
const themes = ['沙漠初探', '绿洲行动', '沙漠守护', ...additions.map(x => x.name)];
await fs.mkdir('mblock-project/assets/levels/v022', {recursive: true});
hud.costumes = [];
for (const [i, theme] of themes.entries()) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="310" height="32"><rect x="1" y="1" width="308" height="30" rx="12" fill="#216b8c" stroke="white" stroke-width="2"/><text x="155" y="22" text-anchor="middle" font-family="PingFang SC,Microsoft YaHei,sans-serif" font-size="16" font-weight="bold" fill="white">第${i+1}/${total}关 · ${theme}  目标：5棵树</text></svg>`;
  const hash = crypto.createHash('md5').update(svg).digest('hex');
  zip.file(`${hash}.svg`, svg);
  await fs.writeFile(`mblock-project/assets/levels/v022/level-${i+1}.svg`, svg);
  hud.costumes.push({name:`level-${i+1}`, dataFormat:'svg', assetId:hash, md5ext:`${hash}.svg`, rotationCenterX:155, rotationCenterY:16});
}
hud.currentCostume = 0;
rb['4rD6{QA8,rj~wYBe`B^I'].inputs.MESSAGE = str('连续答对5题种满本关！答错从本关第1题重来。');

// Export an idle state; green flag owns the actual initialization.
for (const id of ['game-phase','game-next','quiz-click-ready','%z6KO!=AV03bkJsGH`QJ','mature-tree-count','saxaul-landed-count','seedling-handoff-completed']) stage.variables[id][1] = 0;
stage.variables['game-level'][1] = 1;
stage.variables['quiz-click-choice'][1] = '';
stage.lists['game-pool'][1] = [];
for (const t of project.targets.filter(t => /^梭梭树[1-5]$/.test(t.name) || /^答案[AB]$/.test(t.name) || t.name === '关卡继续按钮')) t.visible = false;

const setters = Object.values(rb).filter(b => b.opcode === 'data_setvariableto' && b.fields.VARIABLE?.[0] === '当前题目');
assert.equal(setters.length, 132);
assert.equal(new Set(setters.map(b => b.inputs.VALUE[1][1])).size, 132);
const allIds = themes.flatMap((_,i) => stage.lists[`level-bank-${i+1}`][1]);
assert.equal(allIds.length, 132);
assert.equal(new Set(allIds).size, 132);
for (const t of project.targets) for (const [id,b] of Object.entries(t.blocks)) {
  for (const key of ['next','parent']) if (b[key]) assert(t.blocks[b[key]], `${t.name}:${id}.${key}`);
  for (const input of Object.values(b.inputs || {})) for (const ref of input.slice(1)) if (typeof ref === 'string') assert(t.blocks[ref], `${t.name}:${id} input ${ref}`);
}
zip.file('project.json', JSON.stringify(project));
const output = 'mblock-project/exports/沙漠绿色公益-十关挑战-v022.mblock';
await fs.writeFile(output, await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}}));
console.log(`${output}: ${total} levels, ${questionId} questions; failure-restart preserved.`);

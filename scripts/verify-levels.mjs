// Executes project blocks with a small deterministic scheduler. This checks game
// progression without rendering; it is not a substitute for an mBlock UI playthrough.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
const zip=await JSZip.loadAsync(await fs.readFile(process.argv[2] || 'mblock-project/exports/沙漠绿色公益-三关挑战-v020.mblock'));
const p=JSON.parse(await zip.file('project.json').async('string')),stage=p.targets.find(t=>t.isStage),robot=p.targets.find(t=>t.name==='蓝豆机器人');
const STOP=Symbol('stop-script');
let now=0,threads=[],seed=12345;
const fireworks=p.targets.find(t=>t.name==='通关烟花'),fireworkRuns=[],fireworkFrames=[];
const badge=p.targets.find(t=>t.name==='通关徽章'),badgeAwards=[];
const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32;};
const get=(t,id)=>(t.variables[id]||stage.variables[id])[1];
const set=(t,id,v)=>{(t.variables[id]||stage.variables[id])[1]=v;};
const list=(t,id)=>(t.lists[id]||stage.lists[id])[1];
const eq=(a,b)=>String(a).toLowerCase()===String(b).toLowerCase()||(String(a).trim()!==''&&String(b).trim()!==''&&Number(a)===Number(b));
function input(t,a){let v=a?.[1];if(Array.isArray(v))return v[0]===12?get(t,v[2]):v[1];return typeof v==='string'?value(t,v):v;}
function value(t,id){const b=t.blocks[id],I=k=>input(t,b.inputs[k]);switch(b.opcode){
 case 'operator_equals':return eq(I('OPERAND1'),I('OPERAND2'));
 case 'operator_gt':return Number(I('OPERAND1'))>Number(I('OPERAND2'));
 case 'operator_lt':return Number(I('OPERAND1'))<Number(I('OPERAND2'));
 case 'operator_not':return !I('OPERAND');
 case 'operator_contains':return String(I('STRING1')).includes(String(I('STRING2')));
 case 'operator_join':return String(I('STRING1'))+String(I('STRING2'));
 case 'operator_random':{let a=Number(I('FROM')),b=Number(I('TO'));return a+Math.floor(random()*(b-a+1));}
 case 'operator_add':return Number(I('NUM1'))+Number(I('NUM2'));
 case 'operator_multiply':return Number(I('NUM1'))*Number(I('NUM2'));
 case 'operator_divide':return Number(I('NUM1'))/Number(I('NUM2'));
 case 'data_itemoflist':return list(t,b.fields.LIST[1])[Number(I('INDEX'))-1]??'';
 case 'data_lengthoflist':return list(t,b.fields.LIST[1]).length;
 case 'data_variable':return get(t,b.fields.VARIABLE[1]);
 case 'sensing_of_object_menu':return b.fields.OBJECT[0];
 case 'sensing_of':{const target=p.targets.find(t=>t.name===I('OBJECT'));return ({'x position':target.x,'y position':target.y,'size':target.size,'costume #':target.currentCostume+1})[b.fields.PROPERTY[0]];}
 case 'sound_sounds_menu':return b.fields.SOUND_MENU[0];
 case 'looks_costume':return b.fields.COSTUME[0];
 default:throw Error(`Unknown reporter ${b.opcode}`);
}}
function launch(op,broadcast,target){
 if(op==='event_whenbroadcastreceived'&&broadcast==='final-fireworks')fireworkRuns.push({time:now,level:Number(get(stage,'game-level')),mature:Number(get(stage,'mature-tree-count')),phase:Number(get(stage,'game-phase'))});
 if(op==='event_whenbroadcastreceived'&&broadcast==='victory-badge')badgeAwards.push({level:Number(get(stage,'game-level')),mature:Number(get(stage,'mature-tree-count')),fireworksDone:Number(get(stage,'fireworks-finished'))});
 for(const t of p.targets.filter(t=>!target||t===target))for(const [id,b] of Object.entries(t.blocks))if(b.opcode===op&&(!broadcast||b.fields.BROADCAST_OPTION?.[1]===broadcast)){
 const key=t.name+':'+id;threads=threads.filter(x=>x.key!==key);threads.push({key,t,g:run(t,b.next),wake:now});
}}
function* run(t,id){while(id){const b=t.blocks[id],I=k=>input(t,b.inputs[k]);switch(b.opcode){
 case 'data_setvariableto':set(t,b.fields.VARIABLE[1],I('VALUE'));break;
 case 'data_changevariableby':set(t,b.fields.VARIABLE[1],Number(get(t,b.fields.VARIABLE[1]))+Number(I('VALUE')));break;
 case 'data_deletealloflist':list(t,b.fields.LIST[1]).length=0;break;
 case 'data_addtolist':list(t,b.fields.LIST[1]).push(I('ITEM'));break;
 case 'control_if':if(I('CONDITION'))yield*run(t,b.inputs.SUBSTACK[1]);break;
 case 'control_if_else':yield*run(t,b.inputs[I('CONDITION')?'SUBSTACK':'SUBSTACK2'][1]);break;
 case 'control_repeat':for(let n=0,count=Number(I('TIMES'));n<count;n++){yield*run(t,b.inputs.SUBSTACK[1]);yield 1/30;}break;
 case 'control_forever':for(;;){yield*run(t,b.inputs.SUBSTACK[1]);yield 1/30;}
 case 'control_repeat_until':{let guard=0;while(!I('CONDITION')){if(++guard>10000)throw Error('loop runaway');yield*run(t,b.inputs.SUBSTACK[1]);yield 1/30;}}break;
 case 'control_wait_until':while(!I('CONDITION'))yield 1/30;break;
 case 'control_wait':yield Number(I('DURATION'));break;
 case 'control_stop':throw STOP;
 case 'event_broadcast':launch('event_whenbroadcastreceived',b.inputs.BROADCAST_INPUT[1][2]);break;
 case 'looks_show':t.visible=true;break;
 case 'looks_hide':t.visible=false;break;
 case 'looks_setsizeto':t.size=Number(I('SIZE'));break;
 case 'looks_changesizeby':t.size+=Number(I('CHANGE'));break;
 case 'looks_switchcostumeto':{const c=I('COSTUME');const byName=t.costumes.findIndex(x=>x.name===c);t.currentCostume=byName>=0?byName:(Number(c)-1)%t.costumes.length;if(t===fireworks)fireworkFrames.push({time:now,frame:t.currentCostume});}break;
 case 'looks_switchbackdropto':{const c=I('BACKDROP');const byName=stage.costumes.findIndex(x=>x.name===c);stage.currentCostume=byName>=0?byName:(Number(c)-1)%stage.costumes.length;}break;
 case 'looks_say':break;
 case 'looks_sayforsecs':yield Number(I('SECS'));break;
 case 'motion_gotoxy':t.x=Number(I('X'));t.y=Number(I('Y'));break;
 case 'motion_glidesecstoxy':yield Number(I('SECS'));t.x=Number(I('X'));t.y=Number(I('Y'));break;
 case 'motion_pointindirection':t.direction=Number(I('DIRECTION'));break;
 case 'sound_setvolumeto':t.volume=Number(I('VOLUME'));break;
 case 'sound_play':case 'sound_stopallsounds':break;
 case 'sound_playuntildone':yield .1;break;
 default:throw Error(`Unknown opcode ${b.opcode}`);
 }id=b.next;}}
function until(condition){const deadline=now+120;while(!condition()){
 if(now>deadline)throw Error('Timed out '+JSON.stringify(stage.variables));
 const thread=threads.filter(x=>x.wake<=now).sort((a,b)=>a.wake-b.wake)[0];
 if(!thread){now=Math.min(...threads.map(t=>t.wake));continue;}
 let result;try{result=thread.g.next();}catch(error){if(error!==STOP)throw error;result={done:true};}if(result.done)threads=threads.filter(x=>x!==thread);else thread.wake=now+Math.max(result.value,1/120);
}}
const state=id=>{const x=get(stage,id);return x!==''&&Number.isFinite(Number(x))?Number(x):x;},click=letter=>launch('event_whenthisspriteclicked',null,p.targets.find(t=>t.name===`答案${letter}`));
launch('event_whenflagclicked');
// Let green-flag handlers initialize before inspecting values saved by mBlock.
until(()=>now>=1/30);
const totalLevels=Number(stage.variables['game-total-levels']?.[1] || 3);
assert.equal(p.targets.find(t=>t.name==='关卡标题').costumes.length,totalLevels);
const checkDesert=level=>{if(!stage.lists['game-desert-names'])return;assert.equal(stage.costumes.length,totalLevels);assert.equal(stage.currentCostume,level-1);const name=list(stage,'game-desert-names')[level-1];assert.equal(state('game-desert-name'),name);assert.equal(stage.costumes[stage.currentCostume].name,name);};
for(let level=1;level<=totalLevels;level++){
 const failureMode=!!stage.broadcasts['level-retry'];
 if(failureMode){
  for(let n=0;n<2;n++){until(()=>state('game-level')===level&&state('quiz-click-ready')===1);click(get(robot,'y~RTTqq3ZyBb*3!4k!}~'));until(()=>state('%z6KO!=AV03bkJsGH`QJ')===n+1);}
  until(()=>state('quiz-click-ready')===1);let correct=get(robot,'y~RTTqq3ZyBb*3!4k!}~');click(correct==='A'?'B':'A');until(()=>state('game-phase')===0);
  until(()=>state('quiz-click-ready')===1);assert.equal(state('game-level'),level);assert.equal(state('%z6KO!=AV03bkJsGH`QJ'),0);assert.equal(state('mature-tree-count'),0);assert.equal(state('saxaul-landed-count'),0);assert.equal(state('seedling-handoff-completed'),0);checkDesert(level);
  // A second failure immediately after restart must also remain on this level.
  correct=get(robot,'y~RTTqq3ZyBb*3!4k!}~');click(correct==='A'?'B':'A');until(()=>state('game-phase')===0);until(()=>state('quiz-click-ready')===1);assert.equal(state('game-level'),level);assert.equal(state('%z6KO!=AV03bkJsGH`QJ'),0);
  console.log(`PASS level ${level}: wrong third answer resets progress to question 1; repeated failure retains current level.`);
 }
 const seen=new Set();
 for(let n=0;n<5;n++){
  until(()=>state('game-level')===level&&Number(state('quiz-click-ready'))===1);
  if(robot.blocks['quiz-reading-position']){assert.equal(robot.x,-160);assert.equal(robot.y,-85);}
  if(badge)assert.equal(badge.visible,false,'Badge must stay hidden while answering or retrying');
  checkDesert(level);
  if(stage.lists['game-plant-names']){
   assert.equal(state('game-plant-name'),list(stage,'game-plant-names')[level-1]);
   for(const plant of p.targets.filter(t=>/^植物[1-5]$/.test(t.name)))assert.equal(plant.currentCostume,(level-1)*2);
  }
  const question=get(robot,'E+%ar3|qW:DZjq^qGmWZ');assert(!seen.has(question));seen.add(question);
  const expectedPool=list(stage,`level-bank-${level}`);
  assert.deepEqual(list(stage,'game-pool'),expectedPool);
  assert(expectedPool.includes(question));
  const answer=get(robot,'y~RTTqq3ZyBb*3!4k!}~');
  if(n===0&&!failureMode){click(answer==='A'?'B':'A');until(()=>Number(state('quiz-click-ready'))===0);assert.equal(Number(state('%z6KO!=AV03bkJsGH`QJ')),n);until(()=>Number(state('quiz-click-ready'))===1);}
  click(answer);until(()=>Number(state('quiz-click-ready'))===0);
  // A second answer during the locked interval must not replace the choice.
  click(answer==='A'?'B':'A');until(()=>Number(state('%z6KO!=AV03bkJsGH`QJ'))===n+1);assert.equal(state('quiz-click-choice'),answer);
 }
 if(fireworks&&level===totalLevels){
  until(()=>fireworks.visible);assert.equal(state('game-phase'),3);assert.equal(state('mature-tree-count'),5);assert.equal(state('fireworks-finished'),0);
  if(badge)assert.equal(badge.visible,false,'Award follows fireworks');
  const next=p.targets.find(t=>t.name==='关卡继续按钮');assert.equal(next.visible,false);
  const started=now;launch('event_whenthisspriteclicked',null,next);until(()=>now>=started+.5);
  assert.equal(state('game-phase'),3);assert.equal(state('game-next'),0);assert.equal(next.visible,false);assert.equal(fireworks.visible,true);
 }
 until(()=>state('game-phase')===2);assert.equal(Number(state('mature-tree-count')),5);assert.equal(Number(state('%z6KO!=AV03bkJsGH`QJ')),5);
 if(fireworks){assert.equal(fireworkRuns.length,level===totalLevels?1:0);assert.equal(fireworks.visible,false);if(level===totalLevels){assert.equal(state('fireworks-finished'),1);assert(now-fireworkRuns[0].time>=3);}}
 checkDesert(level);
 if(stage.lists['game-plant-names'])for(const plant of p.targets.filter(t=>/^植物[1-5]$/.test(t.name))){assert.equal(plant.currentCostume,level*2-1);assert.equal(plant.y,-120);assert.equal(plant.costumes[plant.currentCostume].name,`成熟-${list(stage,'game-plant-names')[level-1]}`);}
 until(()=>p.targets.find(t=>t.name==='关卡继续按钮').visible&&p.targets.find(t=>t.name==='关卡标题').currentCostume===level-1);
 if(badge){if(level===totalLevels)until(()=>badge.visible);else assert.equal(badge.visible,false);assert.equal(badgeAwards.length,level===totalLevels?1:0);}
 assert.equal(p.targets.find(t=>t.name==='关卡继续按钮').costumes[p.targets.find(t=>t.name==='关卡继续按钮').currentCostume].name,level===totalLevels?'重新挑战':'下一关');
 console.log(`PASS level ${level}: five distinct themed questions, wrong-answer retry, click lock, five mature trees.`);
 launch('event_whenthisspriteclicked',null,p.targets.find(t=>t.name==='关卡继续按钮'));until(()=>state('game-phase')===0);
}
until(()=>state('game-level')===1&&Number(state('quiz-click-ready'))===1);assert.equal(Number(state('%z6KO!=AV03bkJsGH`QJ')),0);assert.equal(Number(state('mature-tree-count')),0);checkDesert(1);console.log('PASS replay resets level, input, trees and backdrop.');
if(fireworks){
 assert.deepEqual(fireworkRuns.map(({level,mature,phase})=>({level,mature,phase})),[{level:totalLevels,mature:5,phase:3}]);
 assert.deepEqual(fireworkFrames.map(x=>x.frame),Array.from({length:72},(_,i)=>i));
 for(let i=1;i<fireworkFrames.length;i++)assert(Math.abs(fireworkFrames[i].time-fireworkFrames[i-1].time-1/24)<1e-6);
 assert.equal(fireworks.visible,false);assert.equal(state('fireworks-finished'),0);
 console.log('PASS final fireworks: only after five mature plants in final level; 72 frames at 24fps; replay locked during animation and reset afterwards.');
}
if(badge){assert.deepEqual(badgeAwards,[{level:totalLevels,mature:5,fireworksDone:1}]);assert.equal(badge.visible,false);console.log('PASS badge: awarded once after final growth and fireworks; hidden in earlier levels, retries and replay.');}

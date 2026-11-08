import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
const zip=await JSZip.loadAsync(await fs.readFile('mblock-project/exports/沙漠绿色公益-扩展题库-v019.mblock'));
const p=JSON.parse(await zip.file('project.json').async('string'));
const stage=p.targets.find(t=>t.isStage),robot=p.targets.find(t=>t.name==='蓝豆机器人');
const LEVEL='game-level',PHASE='game-phase',NEXT='game-next',INDEX='game-pool-index',POOL='game-pool';
const names={[LEVEL]:'当前关卡',[PHASE]:'关卡状态',[NEXT]:'继续游戏',[INDEX]:'题库索引','mature-tree-count':'已长大树数','%z6KO!=AV03bkJsGH`QJ':'已种树数','saxaul-landed-count':'已落苗数','seedling-handoff-completed':'种植完成数','quiz-click-ready':'等待选择'};
for(const id of [LEVEL,PHASE,NEXT,INDEX])stage.variables[id]=[names[id],0];
const range=(a,b)=>Array.from({length:b-a+1},(_,i)=>a+i);
const pools=[range(13,28),[...range(1,12),...range(29,42)],range(43,62)];
stage.lists[POOL]=['本关题号',[]];pools.forEach((pool,i)=>stage.lists[`level-bank-${i+1}`]=[`第${i+1}关题号`,pool]);
names['game-level-name']='关卡名称';stage.variables['game-level-name']=['关卡名称',''];
const BROADCAST='level-start',message='开始关卡';stage.broadcasts[BROADCAST]=message;
const mk=(opcode,parent,next,inputs={},fields={})=>({opcode,parent,next,inputs,fields,shadow:false,topLevel:false});
const num=n=>[1,[4,String(n)]],str=s=>[1,[10,s]],v=id=>[2,[12,names[id],id]];
// All per-round scripts are launched only after the manager resets the shared state.
for(const t of p.targets){if(t.isStage||t===robot||/^梭梭树[1-5]$/.test(t.name))for(const b of Object.values(t.blocks))if(b.opcode==='event_whenflagclicked'){b.opcode='event_whenbroadcastreceived';b.fields={BROADCAST_OPTION:[message,BROADCAST]};}}
// Stop just this sound watcher. The level manager must survive to advance the game.
const sb=stage.blocks;sb['music-stop-loop'].fields.STOP_OPTION=['this script',null];sb['music-stop-loop'].mutation.hasnext='false';
sb['music-loop'].opcode='control_repeat_until';sb['music-loop'].inputs.CONDITION=[2,'music-loop-complete'];sb['music-loop-complete']=mk('operator_gt','music-loop',null,{OPERAND1:v('mature-tree-count'),OPERAND2:num(4)});
let serial=0;
function builder(blocks,prefix){
 const node=(op,inputs={},fields={})=>{const id=`${prefix}-${++serial}`;blocks[id]=mk(op,null,null,inputs,fields);return id;};
 const chain=ids=>{ids.filter(Boolean).forEach((id,i,all)=>{if(i){blocks[all[i-1]].next=id;blocks[id].parent=all[i-1];}});return ids[0];};
 const reporter=(parent,key,id)=>{blocks[parent].inputs[key]=[2,id];blocks[id].parent=parent;};
 const sub=(parent,key,ids)=>{const first=chain(ids);blocks[parent].inputs[key]=[2,first];blocks[first].parent=parent;};
 const set=(id,val)=>node('data_setvariableto',{VALUE:val},{VARIABLE:[names[id],id]});
 const change=(id,val)=>node('data_changevariableby',{VALUE:num(val)},{VARIABLE:[names[id],id]});
 const eq=(id,val)=>node('operator_equals',{OPERAND1:v(id),OPERAND2:num(val)});
 const wait=(id,val)=>{const w=node('control_wait_until');reporter(w,'CONDITION',eq(id,val));return w;};
 const when=next=>{const id=node('event_whenflagclicked');blocks[id].topLevel=true;blocks[id].x=100;blocks[id].y=100;blocks[id].next=next;blocks[next].parent=id;return id;};
 return {node,chain,reporter,sub,set,change,eq,wait,when};
}
const B=builder(sb,'levels');
const session=B.node('control_forever');B.when(session);
const rounds=B.node('control_repeat',{TIMES:num(3)});
B.sub(session,'SUBSTACK',[B.set(LEVEL,num(1)),rounds]);
const resets=[B.set(PHASE,num(0)),B.set(NEXT,num(0)),...['quiz-click-ready','%z6KO!=AV03bkJsGH`QJ','mature-tree-count','saxaul-landed-count','seedling-handoff-completed'].map(id=>B.set(id,num(0))),B.node('data_deletealloflist',{}, {LIST:['本关题号',POOL]})];
const poolIfs=pools.map((pool,i)=>{
 const branch=B.node('control_if');B.reporter(branch,'CONDITION',B.eq(LEVEL,i+1));
 const repeat=B.node('control_repeat',{TIMES:num(pool.length)});
 const add=B.node('data_addtolist',{}, {LIST:['本关题号',POOL]});
 const item=B.node('data_itemoflist',{INDEX:v(INDEX)},{LIST:[`第${i+1}关题号`,`level-bank-${i+1}`]});B.reporter(add,'ITEM',item);
 B.sub(repeat,'SUBSTACK',[add,B.change(INDEX,1)]);B.sub(branch,'SUBSTACK',[B.set('game-level-name',str(['沙漠初探','绿洲行动','沙漠守护'][i])),B.set(INDEX,num(1)),repeat]);return branch;
});
const launch=B.node('event_broadcast',{BROADCAST_INPUT:[1,[11,message,BROADCAST]]});
const advance=B.node('control_if');const less=B.node('operator_lt',{OPERAND1:v(LEVEL),OPERAND2:num(3)});B.reporter(advance,'CONDITION',less);B.sub(advance,'SUBSTACK',[B.change(LEVEL,1)]);
B.sub(rounds,'SUBSTACK',[...resets,...poolIfs,B.set(PHASE,num(1)),launch,B.wait('mature-tree-count',5),B.set(PHASE,num(2)),B.wait(NEXT,1),advance]);
// Draw an actual question ID from the current theme pool, keeping duplicate rejection.
const rb=robot.blocks;
for(const [id,b] of Object.entries(rb))if(b.opcode==='operator_random'){
 rb[id]=mk('data_itemoflist',b.parent,null,{INDEX:[2,id+'-pool-index']},{LIST:['本关题号',POOL]});
 rb[id+'-pool-index']=mk('operator_random',id,null,{FROM:num(1),TO:[2,id+'-pool-size']});
 rb[id+'-pool-size']=mk('data_lengthoflist',id+'-pool-index',null,{}, {LIST:['本关题号',POOL]});
}
const intro=Object.values(rb).find(b=>b.opcode==='looks_sayforsecs'&&b.inputs.MESSAGE?.[1]?.[1]==='一起答题，为沙漠种下梭梭树！');
const introId=Object.keys(rb).find(k=>rb[k]===intro);intro.inputs.MESSAGE=[2,'level-intro-title'];rb['level-intro-title']=mk('operator_join',introId,null,{STRING1:v('game-level-name'),STRING2:str('：答对5题，种下5棵梭梭树！')});
rb['|-5),{ApSaAR=5Ln%l}x'].inputs.MESSAGE=str('本关种植完成！等梭梭树长大后继续挑战。');
// Add code-native SVG controls with clear level and objective text.
async function costume(name,text,width,height,fill){
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect x="1" y="1" width="${width-2}" height="${height-2}" rx="12" fill="${fill}" stroke="white" stroke-width="2"/><text x="${width/2}" y="${height/2+6}" text-anchor="middle" font-family="PingFang SC,Microsoft YaHei,sans-serif" font-size="17" font-weight="bold" fill="white">${text}</text></svg>`;
 const hash=crypto.createHash('md5').update(svg).digest('hex');zip.file(hash+'.svg',svg);await fs.mkdir('mblock-project/assets/levels',{recursive:true});await fs.writeFile(`mblock-project/assets/levels/${name}.svg`,svg);
 return {name,dataFormat:'svg',assetId:hash,md5ext:hash+'.svg',rotationCenterX:width/2,rotationCenterY:height/2};
}
const layer=Math.max(...p.targets.map(t=>t.layerOrder||0));
function sprite(name,blocks,costumes,x,y,order){return {isStage:false,name,variables:{},lists:{},broadcasts:{},blocks,comments:{},currentCostume:0,costumes,sounds:[],volume:100,layerOrder:order,visible:false,x,y,size:100,direction:90,draggable:false,rotationStyle:'all around',deviceId:null,loadedExtIds:[],editorMode:'block',codes:null,codeTypes:['python']};}
const hud={},H=builder(hud,'hud'),watch=H.node('control_forever');H.when(watch);
const select=H.node('looks_switchcostumeto',{COSTUME:v(LEVEL)});H.sub(watch,'SUBSTACK',[H.node('looks_show'),select]);
p.targets.push(sprite('关卡标题',hud,await Promise.all(['沙漠初探','绿洲行动','沙漠守护'].map((t,i)=>costume(`level-${i+1}`,`第${i+1}关`,72,28,'#216b8c'))),200,164,layer+1));
const btn={},N=builder(btn,'next'),watch2=N.node('control_forever');N.when(watch2);
const choose=N.node('control_if_else');N.reporter(choose,'CONDITION',N.eq(LEVEL,3));N.sub(choose,'SUBSTACK',[N.node('looks_switchcostumeto',{COSTUME:str('重新挑战')})]);N.sub(choose,'SUBSTACK2',[N.node('looks_switchcostumeto',{COSTUME:str('下一关')})]);
const display=N.node('control_if_else');N.reporter(display,'CONDITION',N.eq(PHASE,2));N.sub(display,'SUBSTACK',[choose,N.node('looks_show')]);N.sub(display,'SUBSTACK2',[N.node('looks_hide')]);N.sub(watch2,'SUBSTACK',[display]);
const click=N.node('event_whenthisspriteclicked');btn[click].topLevel=true;btn[click].x=600;btn[click].y=50;
const guard=N.node('control_if');N.reporter(guard,'CONDITION',N.eq(PHASE,2));N.sub(guard,'SUBSTACK',[N.set(PHASE,num(0)),N.set(NEXT,num(1))]);N.chain([click,guard]);
p.targets.push(sprite('关卡继续按钮',btn,[await costume('下一关','下一关 ▶',150,40,'#198653'),await costume('重新挑战','全部通关 · 再玩一次',210,40,'#198653')],0,-151,layer+2));
// Neutral saved state; the manager owns all round resets.
for(const id of ['%z6KO!=AV03bkJsGH`QJ','mature-tree-count','saxaul-landed-count','seedling-handoff-completed','quiz-click-ready'])stage.variables[id][1]=0;
stage.variables['quiz-click-choice'][1]='';for(const t of p.targets.filter(t=>/^梭梭树[1-5]$/.test(t.name))){t.visible=false;t.currentCostume=0;t.size=10;}
robot.x=-190;robot.y=35;robot.currentCostume=0;
for(const t of p.targets)for(const [id,b] of Object.entries(t.blocks)){
 for(const key of ['next','parent'])if(b[key])assert(t.blocks[b[key]],`${t.name}:${id}.${key}`);
 for(const input of Object.values(b.inputs||{}))for(const ref of input.slice(1))if(typeof ref==='string')assert(t.blocks[ref],`${t.name}:${id} input ${ref}`);
}
assert.equal(new Set(pools.flat()).size,62);
zip.file('project.json',JSON.stringify(p));const out='mblock-project/exports/沙漠绿色公益-三关挑战-v020.mblock';await fs.writeFile(out,await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}}));console.log(out);

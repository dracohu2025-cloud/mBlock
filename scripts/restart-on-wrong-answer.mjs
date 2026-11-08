import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
const zip=await JSZip.loadAsync(await fs.readFile('mblock-project/exports/沙漠绿色公益-三关挑战-v020.mblock'));
const p=JSON.parse(await zip.file('project.json').async('string'));
const stage=p.targets.find(t=>t.isStage),robot=p.targets.find(t=>t.name==='蓝豆机器人'),b=robot.blocks;
const fail='level-retry',name='重试本关';stage.broadcasts[fail]=name;
const mk=(opcode,parent,next,inputs={},fields={})=>({opcode,parent,next,inputs,fields,shadow:false,topLevel:false});
const num=n=>[1,[4,String(n)]],str=s=>[1,[10,s]],v=(id,name)=>[2,[12,name,id]];
// Replace the retry-current-question loop with failure -> restart-current-level.
const check=',}XHihVpZ|d904@Qs0b7',eq=b[check].inputs.CONDITION[1],say='IpHwF`Xv;#mLn!$TZN7N';
const obsolete=b[say].next;
function prune(id){if(!id||!b[id])return;const x=b[id];delete b[id];if(x.next)prune(x.next);for(const input of Object.values(x.inputs||{}))for(const ref of input.slice(1))if(typeof ref==='string')prune(ref);}
prune(obsolete);
b[check].opcode='control_if';b[check].inputs.CONDITION=[2,'wrong-choice'];
b['wrong-choice']=mk('operator_not',check,null,{OPERAND:[2,eq]});b[eq].parent='wrong-choice';
b[check].inputs.SUBSTACK=[2,'failure-lock'];
b['failure-lock']=mk('data_setvariableto',check,say,{VALUE:num(0)},{VARIABLE:['关卡状态','game-phase']});
b[say].parent='failure-lock';b[say].inputs.MESSAGE=str('答错了！本关从第1题重新开始。');b[say].inputs.SECS=num(1.2);b[say].next='retry-broadcast';
b['retry-broadcast']=mk('event_broadcast',say,'end-failed-attempt',{BROADCAST_INPUT:[1,[11,name,fail]]});
b['end-failed-attempt']={...mk('control_stop','retry-broadcast',null,{}, {STOP_OPTION:['this script',null]}),mutation:{tagName:'mutation',children:[],hasnext:'false'}};
// A distinct stage handler resets state; the main manager continues waiting on this level.
const sb=stage.blocks;
sb['retry-handler']={...mk('event_whenbroadcastreceived',null,'retry-silence',{}, {BROADCAST_OPTION:[name,fail]}),topLevel:true,x:1500,y:500};
sb['retry-silence']=mk('sound_stopallsounds','retry-handler','retry-reset-0');
const resets=[['quiz-click-ready','等待选择',num(0)],['quiz-click-choice','所选答案',str('')],['%z6KO!=AV03bkJsGH`QJ','已种树数',num(0)],['mature-tree-count','已长大树数',num(0)],['saxaul-landed-count','已落苗数',num(0)],['seedling-handoff-completed','种植完成数',num(0)],['game-next','继续游戏',num(0)],['game-phase','关卡状态',num(1)]];
resets.forEach(([id,name,value],i)=>sb[`retry-reset-${i}`]=mk('data_setvariableto',i?`retry-reset-${i-1}`:'retry-silence',i===resets.length-1?'retry-start':`retry-reset-${i+1}`,{VALUE:value},{VARIABLE:[name,id]}));
sb['retry-start']=mk('event_broadcast',`retry-reset-${resets.length-1}`,null,{BROADCAST_INPUT:[1,[11,'开始关卡','level-start']]});
// Make question number visible so restarting at question one is unambiguous.
const prompt='Cd,{PLq6LSl;PaxXPXTU';b[prompt].inputs.MESSAGE=[2,'question-number-prefix'];
b['question-number-prefix']=mk('operator_join',prompt,null,{STRING1:[2,'question-number-label'],STRING2:v('Ls*3*d8|jjq(bUHN*G6-','当前题目')});
b['question-number-label']=mk('operator_join','question-number-prefix',null,{STRING1:[2,'question-number-start'],STRING2:str('/5题：')});
b['question-number-start']=mk('operator_join','question-number-label',null,{STRING1:str('第'),STRING2:[2,'question-number-value']});
b['question-number-value']=mk('operator_add','question-number-start',null,{NUM1:v('%z6KO!=AV03bkJsGH`QJ','已种树数'),NUM2:num(1)});
for(const [id,x] of Object.entries(b))if(x.opcode==='operator_join'&&x.inputs.STRING2?.[1]?.[1]==='：答对5题，种下5棵梭梭树！')x.inputs.STRING2=str('：连续答对5题；答错从第1题重来。');
for(const t of p.targets)for(const [id,x] of Object.entries(t.blocks)){
 for(const k of ['next','parent'])if(x[k])assert(t.blocks[x[k]],`${t.name}:${id}.${k}`);
 for(const input of Object.values(x.inputs||{}))for(const ref of input.slice(1))if(typeof ref==='string')assert(t.blocks[ref],`${id} input ${ref}`);
}
// Clear saved runtime state so opening the file cannot expose a stale enabled answer.
for(const id of ['game-level','game-phase','game-next','quiz-click-ready','%z6KO!=AV03bkJsGH`QJ','mature-tree-count','saxaul-landed-count','seedling-handoff-completed'])stage.variables[id][1]=0;
stage.variables['quiz-click-choice'][1]='';
for(const t of p.targets.filter(t=>/^梭梭树[1-5]$/.test(t.name)||/^答案[AB]$/.test(t.name)||t.name==='关卡继续按钮'))t.visible=false;
zip.file('project.json',JSON.stringify(p));const out='mblock-project/exports/沙漠绿色公益-答错重来-v021.mblock';await fs.writeFile(out,await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}}));console.log(out);

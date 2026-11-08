import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
const zip=await JSZip.loadAsync(await fs.readFile('mblock-project/exports/沙漠绿色公益-点击答题-v017.mblock'));
const p=JSON.parse(await zip.file('project.json').async('string'));
const robot=p.targets.find(t=>t.name==='蓝豆机器人');
// Native vector prop: the pivot is at the robot's grip, not the image center.
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="480" viewBox="0 0 100 480"><defs><linearGradient id="steel" x1="0" x2="1"><stop stop-color="#748596"/><stop offset=".45" stop-color="#eef5fa"/><stop offset="1" stop-color="#8293a6"/></linearGradient><linearGradient id="wood"><stop stop-color="#86532e"/><stop offset=".5" stop-color="#d4a266"/><stop offset="1" stop-color="#956235"/></linearGradient></defs><path d="M23 14 Q50 -2 77 14 L73 66 Q50 92 27 66 Z M37 27 L39 54 Q50 66 61 54 L63 27 Q50 21 37 27Z" fill="#1973b5" fill-rule="evenodd" stroke="#193d59" stroke-width="5"/><rect x="41" y="73" width="18" height="282" rx="7" fill="url(#wood)" stroke="#634c3c" stroke-width="4"/><path d="M23 349 Q50 337 77 349 L85 409 Q83 449 50 473 Q17 449 15 409 Z" fill="url(#steel)" stroke="#30485d" stroke-width="5"/><path d="M50 358 L50 447 M23 405 Q50 416 77 405" fill="none" stroke="#b2c1ce" stroke-width="3"/><path d="M25 416 Q32 443 48 455" fill="none" stroke="#f8fcff" stroke-width="5" stroke-linecap="round"/></svg>`;
await fs.mkdir('mblock-project/assets/props',{recursive:true});await fs.writeFile('mblock-project/assets/props/robot-shovel.svg',svg);
const hash=crypto.createHash('md5').update(svg).digest('hex');zip.file(hash+'.svg',svg);
const cleanPoses=[{x:535,y:970,a:110},{x:540,y:975,a:106},{x:565,y:990,a:100},{x:575,y:1015,a:92},{x:555,y:1040,a:83},{x:525,y:1045,a:75}];
const indexByHash=new Map();for(let i=5;i<robot.costumes.length;i++)if(!indexByHash.has(robot.costumes[i].md5ext))indexByHash.set(robot.costumes[i].md5ext,indexByHash.size);
const positions=robot.costumes.map((c,i)=>{
 const pose=i>=5?cleanPoses[indexByHash.get(c.md5ext)]:{x:340,y:960,a:110};
 return {x:(pose.x-c.rotationCenterX)/2,y:(c.rotationCenterY-pose.y)/2,a:pose.a};
});
const mk=(opcode,parent,next,inputs={},fields={})=>({opcode,parent,next,inputs,fields,shadow:false,topLevel:false});
const n=x=>[1,[4,String(x)]];
const b={};
b.start={...mk('event_whenflagclicked',null,'show'),topLevel:true,x:30,y:30};
b.show=mk('looks_show','start','loop');b.loop=mk('control_forever','show',null,{SUBSTACK:[2,'sync-size']});
function sensor(id,property,parent){b[id]=mk('sensing_of',parent,null,{OBJECT:[1,id+'-menu']},{PROPERTY:[property,null]});b[id+'-menu']={...mk('sensing_of_object_menu',id,null,{}, {OBJECT:['蓝豆机器人',null]}),shadow:true};return [2,id];}
function item(id,list,name,parent){b[id]=mk('data_itemoflist',parent,null,{INDEX:sensor(id+'-costume','costume #',id)},{LIST:[name,list]});return [2,id];}
function offset(id,axis,parent){b[id]=mk('operator_multiply',parent,null,{NUM1:item(id+'-item','shovel-'+axis,'握点'+axis,id),NUM2:[2,id+'-scale']});b[id+'-scale']=mk('operator_divide',id,null,{NUM1:sensor(id+'-size','size',id+'-scale'),NUM2:n(100)});return [2,id];}
b['sync-size']=mk('looks_setsizeto','loop','sync-position',{SIZE:[2,'prop-size']});
b['prop-size']=mk('operator_divide','sync-size',null,{NUM1:sensor('robot-size','size','prop-size'),NUM2:n(2)});
b['sync-position']=mk('motion_gotoxy','sync-size','sync-angle',{X:[2,'sum-x'],Y:[2,'sum-y']});
b['sum-x']=mk('operator_add','sync-position',null,{NUM1:sensor('robot-x','x position','sum-x'),NUM2:offset('offset-x','X','sum-x')});
b['sum-y']=mk('operator_add','sync-position',null,{NUM1:sensor('robot-y','y position','sum-y'),NUM2:offset('offset-y','Y','sum-y')});
b['sync-angle']=mk('motion_pointindirection','sync-position',null,{DIRECTION:item('angle-item','shovel-angle','铁铲角度','sync-angle')});
// Place the shaft behind the hand so the hand naturally covers the grip.
const layer=robot.layerOrder;for(const t of p.targets)if(t.layerOrder>=layer)t.layerOrder++;
p.targets.push({isStage:false,name:'机器人铁铲',variables:{},lists:{'shovel-X':['握点X',positions.map(x=>x.x)],'shovel-Y':['握点Y',positions.map(x=>x.y)],'shovel-angle':['铁铲角度',positions.map(x=>x.a)]},broadcasts:{},blocks:b,comments:{},currentCostume:0,costumes:[{name:'铁铲',assetId:hash,md5ext:hash+'.svg',dataFormat:'svg',rotationCenterX:50,rotationCenterY:160}],sounds:[],volume:100,layerOrder:layer,visible:true,x:robot.x+positions[robot.currentCostume].x*robot.size/100,y:robot.y+positions[robot.currentCostume].y*robot.size/100,size:robot.size/2,direction:positions[robot.currentCostume].a,draggable:false,rotationStyle:'all around',deviceId:null,loadedExtIds:[],editorMode:'block',codes:null,codeTypes:['python']});
// The vector prop uses half the robot percentage, matching its bitmap resolution 2.
for(const t of p.targets)for(const [id,block] of Object.entries(t.blocks)){
 for(const key of ['parent','next'])if(block[key])assert(t.blocks[block[key]],`${id}.${key}`);
 for(const input of Object.values(block.inputs||{}))for(const ref of input.slice(1))if(typeof ref==='string')assert(t.blocks[ref],`${id} input ${ref}`);
}
zip.file('project.json',JSON.stringify(p));
const out='mblock-project/exports/沙漠绿色公益-机器人铁铲-v018.mblock';await fs.writeFile(out,await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}}));console.log(out);

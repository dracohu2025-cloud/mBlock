import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import sharp from 'sharp';
const root='mblock-project/assets/props/palm-v035';await fs.mkdir(root,{recursive:true});
const zip=await JSZip.loadAsync(await fs.readFile('mblock-project/exports/沙漠绿色公益-铲面朝向修正-v034.mblock'));
const p=JSON.parse(await zip.file('project.json').async('string')),robot=p.targets.find(t=>t.name==='蓝豆机器人'),shovel=p.targets.find(t=>t.name==='机器人铁铲');
const old=await zip.file(shovel.costumes[0].md5ext).async('string');
// Whole glove outlines, in a 240x210 inspection region with grip at (120,150).
const outlines=[
 [[84,49],[161,75],[182,110],[180,140],[151,145],[148,178],[128,188],[100,179],[75,163],[62,136],[59,111],[66,83]],
 [[98,36],[155,60],[177,85],[180,113],[170,139],[165,173],[149,184],[111,183],[83,166],[64,143],[63,118],[66,87],[80,60]],
 [[88,38],[143,46],[173,68],[190,96],[187,131],[165,172],[148,185],[108,185],[78,164],[57,135],[58,100],[70,64]],
 [[72,32],[126,44],[155,56],[187,74],[196,98],[198,126],[177,152],[148,175],[119,178],[91,169],[66,145],[40,114],[43,82],[55,51]],
 [[75,50],[128,57],[148,68],[186,79],[205,102],[205,128],[188,160],[164,188],[133,201],[106,195],[83,173],[57,146],[33,116],[33,90],[48,68]],
 [[57,60],[107,54],[143,65],[168,87],[193,99],[203,121],[199,150],[171,183],[138,201],[105,194],[80,176],[52,151],[31,127],[33,96],[43,75]],
 [[54,78],[96,74],[122,82],[145,94],[170,104],[180,126],[177,151],[153,177],[126,192],[96,188],[73,173],[46,148],[29,125],[31,103]],
 [[67,59],[113,45],[141,55],[179,88],[192,115],[190,153],[165,188],[128,204],[96,201],[69,176],[49,151],[48,110]],
 [[86,69],[128,57],[159,74],[187,105],[198,137],[178,176],[148,202],[113,205],[83,187],[59,162],[60,126]]
];
function inside(x,y,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [a,b]=poly[i],[c,d]=poly[j];if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)yes=!yes;}return yes;}
const seen=new Map(),manifest=[],preview=[];shovel.costumes=[];
for(const [i,c]of robot.costumes.entries()){
 if(i>=5&&!seen.has(c.md5ext))seen.set(c.md5ext,seen.size);
 const outline=i>=5?outlines[1+seen.get(c.md5ext)]:i===3?outlines[7]:i===4?outlines[8]:outlines[0];assert(outline);
 const angle=shovel.lists['shovel-angle'][1][i],theta=(angle-90)*Math.PI/180,co=Math.cos(theta),si=Math.sin(theta);let lo=Infinity,hi=-Infinity;
 for(let u=-207;u<=195;u+=.25)for(let v=-11;v<=11;v+=2)if(inside(120+co*v-si*u,150+si*v+co*u,outline)){lo=Math.min(lo,u);hi=Math.max(hi,u);}
 assert(Number.isFinite(lo)&&hi>lo);
 const from=280+Math.floor(lo)-4,to=280+Math.ceil(hi)+4;assert(from>73&&to<475);
 const svg=old.replace(/<defs><mask[\s\S]*?<\/defs>/,'').replace('<g mask="url(#hand-grip)">','<g>')
 .replace('<svg ',`<svg data-hand-gap="${from},${to}" `)
 .replace('<rect x="41" y="73" width="18" height="402" rx="7" fill="url(#wood)" stroke="#634c3c" stroke-width="4"/>',
 `<rect x="41" y="73" width="18" height="${from-73}" rx="7" fill="url(#wood)" stroke="#634c3c" stroke-width="4"/><rect x="41" y="${to}" width="18" height="${475-to}" rx="7" fill="url(#wood)" stroke="#634c3c" stroke-width="4"/>`);
 assert(!svg.includes('<mask'));assert(svg.includes('data-hand-gap'));
 const buf=Buffer.from(svg),hash=crypto.createHash('md5').update(buf).digest('hex');zip.file(`${hash}.svg`,buf);
 const file=`pose-${String(i+1).padStart(2,'0')}.svg`;await fs.writeFile(`${root}/${file}`,buf);
 shovel.costumes.push({name:`握铲-${String(i+1).padStart(2,'0')}`,dataFormat:'svg',assetId:hash,md5ext:`${hash}.svg`,rotationCenterX:50,rotationCenterY:280});
 // Check real raster alpha along the whole shaft where it crosses the glove.
 const {data,info}=await sharp(buf).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 for(let u=Math.ceil(lo);u<=Math.floor(hi);u++)assert.equal(data[(Math.round(280+u)*info.width+50)*4+3],0,`pose ${i} shaft crosses palm`);
 manifest.push({costume:i+1,name:c.name,angle,gap:[from,to],handOutline:outline,file});
 if([0,5,9,11,13,15].includes(i)){
  const rb=await zip.file(c.md5ext).async('nodebuffer'),x=c.rotationCenterX+2*shovel.lists['shovel-X'][1][i],y=c.rotationCenterY-2*shovel.lists['shovel-Y'][1][i];
  const view=`<svg xmlns="http://www.w3.org/2000/svg" width="1254" height="1254"><rect width="1254" height="1254" fill="#e7d6bb"/><image href="data:image/png;base64,${rb.toString('base64')}" width="1254" height="1254"/><g transform="translate(${x} ${y}) rotate(${angle-90})">${svg.replace('<svg ','<svg x="-50" y="-280" ')}</g></svg>`;
  const j=preview.length;preview.push({input:await sharp(Buffer.from(view)).extract({left:220,top:690,width:600,height:564}).resize(400,376).png().toBuffer(),left:j%3*400,top:Math.floor(j/3)*376});
 }
}
shovel.currentCostume=robot.currentCostume;
const b=shovel.blocks,next=b['sync-size'].next;b['sync-size'].next='grip-sync-costume';b[next].parent='grip-sync-costume';
b['grip-sync-costume']={opcode:'looks_switchcostumeto',next,parent:'sync-size',inputs:{COSTUME:[2,'grip-robot-costume']},fields:{},shadow:false,topLevel:false};
b['grip-robot-costume']={opcode:'sensing_of',next:null,parent:'grip-sync-costume',inputs:{OBJECT:[1,'grip-robot-menu']},fields:{PROPERTY:['costume #',null]},shadow:false,topLevel:false};
b['grip-robot-menu']={opcode:'sensing_of_object_menu',next:null,parent:'grip-robot-costume',inputs:{},fields:{OBJECT:['蓝豆机器人',null]},shadow:true,topLevel:false};
await fs.writeFile(`${root}/poses.json`,JSON.stringify(manifest,null,2)+'\n');
await sharp({create:{width:1200,height:752,channels:3,background:'#e7d6bb'}}).composite(preview).png().toFile(`${root}/preview.png`);
zip.file('project.json',JSON.stringify(p));
const output='mblock-project/exports/沙漠绿色公益-手掌遮挡修正-v035.mblock';await fs.writeFile(output,await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}}));console.log(`${output}: verified palm cutouts in all 29 costumes.`);

import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import sharp from 'sharp';
const file=process.argv[2]||'mblock-project/exports/沙漠绿色公益-握紧铁铲-v032.mblock';
const zip=await JSZip.loadAsync(await fs.readFile(file));
const p=JSON.parse(await zip.file('project.json').async('string'));
const robot=p.targets.find(t=>t.name==='蓝豆机器人'),shovel=p.targets.find(t=>t.name==='机器人铁铲');
assert.equal(shovel.layerOrder,robot.layerOrder+1);
for(const [i,c]of robot.costumes.entries()){
 const x=c.rotationCenterX+shovel.lists['shovel-X'][1][i]*2;
 const y=c.rotationCenterY-shovel.lists['shovel-Y'][1][i]*2;
 const data=await sharp(await zip.file(c.md5ext).async('nodebuffer')).extract({left:x,top:y,width:1,height:1}).raw().toBuffer();
 assert(data[3]>200&&data[2]>data[0]*1.5,`Grip ${i} must land on the opaque blue glove, got ${[...data]}`);
}
if(shovel.blocks['grip-sync-costume']){
 assert.equal(shovel.costumes.length,robot.costumes.length);
 const sync=shovel.blocks['grip-sync-costume'];
 assert.equal(shovel.blocks['sync-size'].next,'grip-sync-costume');
 assert.equal(sync.opcode,'looks_switchcostumeto');
 const reporter=shovel.blocks[sync.inputs.COSTUME[1]];
 assert.equal(reporter.opcode,'sensing_of');
 assert.equal(reporter.fields.PROPERTY[0],'costume #');
 assert.equal(shovel.blocks[reporter.inputs.OBJECT[1]].fields.OBJECT[0],robot.name);
 for(const [i,c]of shovel.costumes.entries()){
  const svg=await zip.file(c.md5ext).async('string');
  assert.equal(c.rotationCenterX,50);assert.equal(c.rotationCenterY,280);
  assert(!svg.includes('<mask'),'Occlusion must survive renderers without SVG mask support');
  assert(svg.includes('height="600"'));
  assert(svg.includes('translate(100 0) scale(-1 1)'),'Keep the corrected blade facing');
  const match=svg.match(/data-hand-gap="(\d+),(\d+)"/);assert(match);
  const [,from,to]=match.map(Number);assert(from<280&&to>280);
  const {data,info}=await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  // Check the entire width of the wooden shaft, including its stroke, through
  // the palm. A narrow finger-only hole would leave opaque pixels here.
  for(let y=from+3;y<=to-3;y++)for(let x=39;x<=61;x++)
   assert.equal(data[(y*info.width+x)*4+3],0,`Costume ${i+1}: exposed shaft at ${x},${y}`);
  assert(data[(90*info.width+50)*4+3]>200,'Upper shaft must remain visible');
  assert(data[(450*info.width+50)*4+3]>200,'Lower shaft must remain visible');
 }
 console.log(`PASS: all ${robot.costumes.length} glove anchors and full-palm cutouts verified; costume synchronization, blade facing and long shaft preserved.`);
}else{
 const c=shovel.costumes[0],svg=await zip.file(c.md5ext).async('string');
 assert.equal(c.rotationCenterY,280);assert(svg.includes('mask="url(#hand-grip)"'));
 assert(svg.includes('height="600"'));assert(svg.includes('height="402"'));
 console.log(`PASS: all ${robot.costumes.length} hand anchors land on blue gloves; front shaft, finger occlusion and long-shovel geometry verified.`);
}

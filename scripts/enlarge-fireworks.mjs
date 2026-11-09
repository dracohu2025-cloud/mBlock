import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import JSZip from 'jszip';

const zip=await JSZip.loadAsync(await fs.readFile('mblock-project/exports/沙漠绿色公益-通关烟花-v025.mblock'));
const project=JSON.parse(await zip.file('project.json').async('string'));
const fireworks=project.targets.find(t=>t.name==='通关烟花');
assert(fireworks);
// Keep the enlarged burst inside the stage; SVG frames retain crisp edges.
fireworks.size=130;
fireworks.x=0;
fireworks.y=-35;
fireworks.visible=false;
zip.file('project.json',JSON.stringify(project));
const output='mblock-project/exports/沙漠绿色公益-放大烟花-v026.mblock';
await fs.writeFile(output,await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}}));
console.log(output);

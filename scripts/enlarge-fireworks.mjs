import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import JSZip from 'jszip';

const versions={
  v026:{source:'沙漠绿色公益-通关烟花-v025',output:'沙漠绿色公益-放大烟花-v026',size:130,y:-35},
  v027:{source:'沙漠绿色公益-放大烟花-v026',output:'沙漠绿色公益-更大烟花-v027',size:160,y:-85}
};
const settings=versions[process.argv[2]||'v026'];
assert(settings,'Supported versions: v026, v027');
const zip=await JSZip.loadAsync(await fs.readFile(`mblock-project/exports/${settings.source}.mblock`));
const project=JSON.parse(await zip.file('project.json').async('string'));
const fireworks=project.targets.find(t=>t.name==='通关烟花');
assert(fireworks);
// Keep the enlarged burst inside the stage; SVG frames retain crisp edges.
fireworks.size=settings.size;
fireworks.x=0;
fireworks.y=settings.y;
fireworks.visible=false;
zip.file('project.json',JSON.stringify(project));
const output=`mblock-project/exports/${settings.output}.mblock`;
await fs.writeFile(output,await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}}));
console.log(output);

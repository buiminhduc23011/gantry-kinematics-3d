const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
(async () => {
  const source = path.resolve(process.argv[2] || 'Rodal 3 trục.stp');
  const bytes = fs.readFileSync(source);
  const occt = await require('occt-import-js')();
  console.log('Tessellating STEP in millimeters…');
  const result = occt.ReadStepFile(bytes, {linearUnit:'millimeter',linearDeflectionType:'absolute_value',linearDeflection:0.5,angularDeflection:0.35});
  if (!result.success || !result.meshes.length) throw new Error('STEP import failed or empty model');
  const chunks = []; let offset = 0; let triangles = 0;
  function append(array, Type) {
    const typed = new Type(array); const buffer = Buffer.from(typed.buffer);
    const info = {offset, length:array.length}; chunks.push(buffer); offset += buffer.length; return info;
  }
  const meshes = result.meshes.map((mesh, id) => {
    triangles += mesh.index.array.length / 3;
    return {id,name:mesh.name || `Part ${id+1}`,color:mesh.color,position:append(mesh.attributes.position.array, Float32Array),normal:mesh.attributes.normal ? append(mesh.attributes.normal.array,Float32Array):null,index:append(mesh.index.array,Uint32Array)};
  });
  const directory = path.resolve('web/public/model'); fs.mkdirSync(directory,{recursive:true});
  fs.writeFileSync(path.join(directory,'geometry.bin'),Buffer.concat(chunks));
  fs.writeFileSync(path.join(directory,'assembly.json'),JSON.stringify({source:path.basename(source),hash:crypto.createHash('sha256').update(bytes).digest('hex'),unit:'mm',triangles,root:result.root,meshes}));
  console.log(JSON.stringify({parts:meshes.length,triangles,bytes:offset,names:meshes.slice(0,12).map(m=>m.name)}));
})().catch(error=>{console.error(error);process.exitCode=1;});

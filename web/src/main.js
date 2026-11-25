import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';
import {cadToWorld,worldToCad} from './coordinates.js';

const $ = id => document.getElementById(id);
const message = text => { $('message').textContent = text; };
let samples = [], sampleIndex = 0, playing = false, elapsed = 0, pending = false;
let pose = {x:0,y:0,z:0}, mapping = {}, selected = null, model = null, storageKey;
const meshes = [], pendingRequests = new Map();
let selectedIds=[], cadGroups=[], dirty=true, cadUp='y', axes;
const bridge = window.chrome?.webview;
const hasEngine = !!bridge;
$('engine').textContent = hasEngine ? '.NET / C# ENGINE' : 'VIEWER ONLY · Mở app desktop để jog';
if (bridge) bridge.addEventListener('message', event => {
  const request = pendingRequests.get(event.data.id);
  if (!request) return;
  clearTimeout(request.timer); pendingRequests.delete(event.data.id);
  event.data.error ? request.reject(new Error(event.data.error)) : request.resolve(event.data.samples);
});
function requestPlan(end) {
  return new Promise((resolve,reject) => {
    if (!bridge) return reject(new Error('Chạy Robot.Desktop để sử dụng thuật toán C#.'));
    const id = crypto.randomUUID();
    const timer = setTimeout(()=>{pendingRequests.delete(id);reject(new Error('C# engine không phản hồi trong 15 giây.'));},15000);
    pendingRequests.set(id,{resolve,reject,timer});
    bridge.postMessage({id,type:'plan',start:pose,end,velocity:Number($('velocity').value),acceleration:Number($('acceleration').value)});
  });
}

THREE.Object3D.DEFAULT_UP.set(0,0,1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38,1,0.1,10000000);
const viewport = $('viewport');
let renderer;
try { renderer = new THREE.WebGLRenderer({antialias:true,alpha:true}); }
catch(error) { $('loading').textContent = 'Không khởi tạo được WebGL. Cần trình điều khiển GPU hỗ trợ WebGL2.'; throw error; }
renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
renderer.setClearColor(0x000000,0);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.4;
viewport.appendChild(renderer.domElement);
const controls = new OrbitControls(camera,renderer.domElement); controls.enableDamping=true;
controls.addEventListener('change',()=>dirty=true);
scene.add(new THREE.HemisphereLight(0xd8e9f5,0x727d72,2.7));
const key = new THREE.DirectionalLight(0xffffff,3); key.position.set(1,-2,3);scene.add(key);
const fill = new THREE.DirectionalLight(0xb3d5ff,1.5);fill.position.set(-2,1,1);scene.add(fill);
const assembly = new THREE.Group();scene.add(assembly);
let grid, bounds, center, radius=1000, reference, path;
const cursor = new THREE.Mesh(new THREE.SphereGeometry(1,16,12),new THREE.MeshBasicMaterial({color:0xc6ef7b,depthTest:false}));
cursor.renderOrder=10;cursor.visible=false;scene.add(cursor);
new ResizeObserver(()=>{const {width,height}=viewport.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();dirty=true;}).observe(viewport);
function fit(top=false) {
  if (!center) return;
  controls.target.copy(center);
  const distance=radius / Math.sin(THREE.MathUtils.degToRad(camera.fov/2)) * Math.max(1,1/camera.aspect)*1.05;
  camera.position.copy(center).add(new THREE.Vector3(...(top?[0,-.001,1]:[1,-1.3,.85])).normalize().multiplyScalar(distance));
  camera.near=Math.max(.1,radius/10000);camera.far=distance*100;camera.updateProjectionMatrix();controls.update();
}
function view(top) {fit(top);$('top').classList.toggle('active',top);$('iso').classList.toggle('active',!top);}
$('iso').onclick=()=>view(false);$('top').onclick=()=>view(true);$('fit').onclick=()=>fit($('top').classList.contains('active'));
$('wire').onclick=()=>{const active=$('wire').getAttribute('aria-pressed')!=='true';$('wire').setAttribute('aria-pressed',String(active));meshes.forEach(mesh=>mesh.material.wireframe=active);dirty=true;};
$('grid').onclick=()=>{const active=$('grid').getAttribute('aria-pressed')!=='true';$('grid').setAttribute('aria-pressed',String(active));if(grid)grid.visible=active;dirty=true;};

function selectPart(id) {
  selectedIds.forEach(index=>meshes[index].material.emissive.setHex(0));
  selectedIds=[id];selected=id;meshes[id].material.emissive.setHex(0x42641b);dirty=true;
  $('cad-group').value='';
  $('selection').textContent=`#${id+1} · ${model.meshes[id].name}`;
  $('group').disabled=playing||pending;$('group').value=mapping[id]||'fixed';
  $('focus-part').disabled=false;
  document.querySelectorAll('.part').forEach(button=>button.classList.toggle('selected',Number(button.dataset.id)===id));
}
function renderParts() {
  const query=$('search').value.toLocaleLowerCase();
  const fragment=document.createDocumentFragment();
  let shown=0;
  model.meshes.forEach((part,id)=>{
    if (!part.name.toLocaleLowerCase().includes(query) && !String(id+1).includes(query)) return;
    if(shown++>=150)return;
    const button=document.createElement('button');button.className='part'+(selectedIds.includes(id)?' selected':'');button.dataset.id=id;
    const icon=document.createElement('i');icon.textContent='◇';
    const name=document.createElement('span');name.textContent=part.name;button.title=`#${id+1} · ${part.name}`;
    const group=document.createElement('small');group.textContent=(mapping[id]||'fixed').toUpperCase();
    button.append(icon,name,group);button.onclick=()=>selectPart(id);fragment.append(button);
  });
  $('parts').replaceChildren(fragment);
  if(shown>150){const note=document.createElement('small');note.textContent=`Hiển thị 150 / ${shown}. Tìm để lọc chi tiết.`;$('parts').append(note);}
  const count=Object.values(mapping).filter(value=>value!=='fixed').length;
  $('mapped-count').textContent=`${count} đã gán`;
  $('jog-note').textContent=count ? `${count} chi tiết đã gán. Jog theo hệ trục ROBOT WORLD sau đổi hướng CAD.` : 'Jog đang khóa: chọn đúng bộ phận robot và gán cụm chuyển động ở bên trái.';
  $('rig-warning').hidden=count>0;
  updateControls();
}
$('search').oninput=()=>{if(model)renderParts();};
$('group').onchange=()=>{
  if (!selectedIds.length || playing || pending) return;
  selectedIds.forEach(id=>mapping[id]=$('group').value);
  try{localStorage.setItem(storageKey,JSON.stringify(mapping));message('Đã lưu cấu hình trục cục bộ.');}catch{message('Không lưu được cấu hình; hãy dùng nút Xuất cấu hình.');}
  renderParts();applyPose();
};
$('cad-group').onchange=()=>{
  if($('cad-group').value==='')return;
  selectedIds.forEach(id=>meshes[id].material.emissive.setHex(0));
  const group=cadGroups[Number($('cad-group').value)];selectedIds=group.meshes;selected=selectedIds[0];
  selectedIds.forEach(id=>meshes[id].material.emissive.setHex(0x42641b));
  $('selection').textContent=`${group.name} · ${selectedIds.length} chi tiết. Gán sẽ áp dụng cho toàn bộ cụm.`;
  $('group').value=mapping[selected]||'fixed';dirty=true;updateControls();renderParts();
  $('focus-part').disabled=false;
};
$('focus-part').onclick=()=>{
  if(!selectedIds.length)return;
  assembly.updateMatrixWorld(true);
  const selectedBounds=new THREE.Box3();selectedIds.forEach(id=>selectedBounds.expandByObject(meshes[id]));
  const savedCenter=center,savedRadius=radius;center=selectedBounds.getCenter(new THREE.Vector3());radius=selectedBounds.getSize(new THREE.Vector3()).length()/2;fit();center=savedCenter;radius=savedRadius;
};
function orientModel(){
  if(!meshes.length)return;
  const basis=new THREE.Matrix4().makeBasis(new THREE.Vector3(...cadToWorld([1,0,0],cadUp)),new THREE.Vector3(...cadToWorld([0,1,0],cadUp)),new THREE.Vector3(...cadToWorld([0,0,1],cadUp)));
  assembly.quaternion.setFromRotationMatrix(basis);
  meshes.forEach(mesh=>mesh.position.set(0,0,0));assembly.updateMatrixWorld(true);
  bounds=new THREE.Box3().setFromObject(assembly);center=bounds.getCenter(new THREE.Vector3());radius=bounds.getSize(new THREE.Vector3()).length()/2;reference=center.clone();
  cursor.scale.setScalar(radius*.009);cursor.visible=true;
  if(grid){scene.remove(grid);grid.geometry.dispose();grid.material.dispose();}
  grid=new THREE.GridHelper(radius*3,30,0x526468,0x303f44);grid.rotation.x=Math.PI/2;grid.position.set(center.x,center.y,bounds.min.z-radius*.015);grid.visible=$('grid').getAttribute('aria-pressed')==='true';scene.add(grid);
  if(axes){scene.remove(axes);axes.dispose();}axes=new THREE.AxesHelper(radius*.25);axes.position.copy(center);scene.add(axes);
  $('axis-convention').textContent=cadUp==='y'?'Robot X = CAD X · Y = −CAD Z · Z = CAD Y':`Chiều đứng CAD ${cadUp.toUpperCase()} → Robot +Z. Jog theo ROBOT WORLD.`;
  applyPose();if(samples.length)drawTrajectory();fit();
}
$('cad-up').onchange=()=>{
  playing=false;generation++;pending=false;cadUp=$('cad-up').value;
  try{localStorage.setItem(storageKey+'-up',cadUp);}catch{}
  orientModel();updateControls();message('Đã đổi cả hướng mô hình và hệ trục jog. Cần xác nhận các cụm chuyển động.');
};
const raycaster=new THREE.Raycaster();let down;
renderer.domElement.addEventListener('pointerdown',event=>{down={x:event.clientX,y:event.clientY};});
renderer.domElement.addEventListener('pointerup',event=>{
  if(event.button!==0 || !down || Math.hypot(event.clientX-down.x,event.clientY-down.y)>5) return;
  const rect=renderer.domElement.getBoundingClientRect();
  raycaster.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),camera);
  const hit=raycaster.intersectObjects(meshes,false)[0];if(hit)selectPart(hit.object.userData.id);
});

async function loadModel() {
  const [manifestResponse,geometryResponse]=await Promise.all([fetch('./model/assembly.json'),fetch('./model/geometry.bin')]);
  if(!manifestResponse.ok || !geometryResponse.ok) throw new Error('Không tìm thấy dữ liệu CAD. Chạy npm run convert rồi npm run build.');
  model=await manifestResponse.json();const binary=await geometryResponse.arrayBuffer();
  function visit(node){if(node.meshes.length)cadGroups.push(node);node.children.forEach(visit);}visit(model.root);
  cadGroups.forEach((group,index)=>{const option=document.createElement('option');option.value=index;option.textContent=`${index+1}. ${group.name} (${group.meshes.length})`;$('cad-group').append(option);});
  storageKey=`rodal-mapping-v1-${model.hash}`;
  try{const savedUp=localStorage.getItem(storageKey+'-up');if(['x','y','z','-x','-y','-z'].includes(savedUp))cadUp=savedUp;}catch{}
  $('cad-up').value=cadUp;
  try { const saved=JSON.parse(localStorage.getItem(storageKey)||'{}');for(const [id,value] of Object.entries(saved)) if(Number.isInteger(Number(id))&&Number(id)>=0&&Number(id)<model.meshes.length&&['fixed','x','xy','xyz'].includes(value))mapping[id]=value; }catch{message('Cấu hình cũ không hợp lệ; dùng mô hình cố định.');}
  for(const part of model.meshes){
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(binary,part.position.offset,part.position.length),3));
    if(part.normal)geometry.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(binary,part.normal.offset,part.normal.length),3));
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(binary,part.index.offset,part.index.length),1));
    if(!part.normal)geometry.computeVertexNormals();geometry.computeBoundingSphere();
    const color=part.color ? new THREE.Color().setRGB(...part.color,THREE.SRGBColorSpace) : new THREE.Color(0xb5c2c7);
    const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,metalness:.35,roughness:.47,side:THREE.DoubleSide}));
    mesh.userData.id=part.id;assembly.add(mesh);meshes.push(mesh);
  }
  orientModel();
  $('part-count').textContent=model.meshes.length.toLocaleString();$('triangle-count').textContent=(model.triangles/1000).toFixed(0)+'k';
  $('loading').hidden=true;renderParts();applyPose();fit();updateControls();
  message(`Đã tải ${model.meshes.length} chi tiết · Chọn chi tiết để gán cụm · Điểm xanh là tham chiếu, chưa phải TCP.`);
}
loadModel().catch(error=>{$('loading').textContent=error.message;message(error.message);console.error(error);});

function applyPose(){
  dirty=true;
  for(const mesh of meshes){const group=mapping[mesh.userData.id]||'fixed';mesh.position.set(...worldToCad([group.includes('x')?pose.x:0,group.includes('y')?pose.y:0,group.includes('z')?pose.z:0],cadUp));}
  if(reference)cursor.position.copy(reference).add(new THREE.Vector3(pose.x,pose.y,pose.z));
  for(const axis of ['x','y','z'])$('pos-'+axis).textContent=pose[axis].toFixed(2);
}
function updateControls(){
  const ready=hasEngine&&!!model&&meshes.length>0;
  $('generate').disabled=!ready||pending||playing;
  document.querySelectorAll('[data-jog]').forEach(button=>{const mapped=Object.values(mapping).some(group=>group!=='fixed'&&group.includes(button.dataset.jog));button.disabled=!ready||pending||playing||!mapped;button.title=mapped?'Jog mô phỏng theo hệ trục robot':`Chưa có chi tiết gán chuyển động ${button.dataset.jog.toUpperCase()}`;});
  for(const id of ['play','step','reset','scrub','export-csv'])$(id).disabled=!samples.length||pending;
  $('step').disabled||=playing;$('stop').disabled=!playing&&!pending;
  $('group').disabled=!selectedIds.length||playing||pending;
  $('play').textContent=playing?'Ⅱ Tạm dừng':'▶ Phát';
}
function displaySample(index){
  sampleIndex=Math.max(0,Math.min(samples.length-1,index));
  const sample=samples[sampleIndex];if(!sample)return;
  pose={...sample.position};applyPose();$('scrub').value=sampleIndex;
  $('time').textContent=`${sample.time.toFixed(2)} / ${samples.at(-1).time.toFixed(2)} s`;
  const x=sample.time/samples.at(-1).time*800;$('chart-cursor').setAttribute('x1',x);$('chart-cursor').setAttribute('x2',x);
}
function drawTrajectory(){
  if(path){scene.remove(path);path.geometry.dispose();path.material.dispose();}
  path=new THREE.Line(new THREE.BufferGeometry().setFromPoints(samples.map(sample=>reference.clone().add(new THREE.Vector3(sample.position.x,sample.position.y,sample.position.z)))),new THREE.LineBasicMaterial({color:0xc6ef7b,depthTest:false}));
  path.renderOrder=9;scene.add(path);
  const peak=Math.max(...samples.map(sample=>sample.velocity));const duration=samples.at(-1).time;
  $('duration').textContent=duration.toFixed(2)+' s';$('peak').textContent=peak.toFixed(2)+' mm/s';
  $('velocity-path').setAttribute('d',samples.map((sample,index)=>`${index?'L':'M'}${(sample.time/duration*800).toFixed(2)},${(80-sample.velocity/(peak||1)*70).toFixed(2)}`).join(' '));
}
let generation=0;
async function plan(end,autoPlay=false){
  if(pending||playing)return;
  const token=++generation;pending=true;updateControls();message('C# đang tính quỹ đạo…');
  try{
    const next=await requestPlan(end);if(token!==generation)return;
    if(!Array.isArray(next)||!next.length)throw new Error('Engine trả về quỹ đạo rỗng.');
    samples=next;elapsed=0;$('scrub').max=samples.length-1;drawTrajectory();displaySample(0);playing=autoPlay;
    message(autoPlay?'Đang jog mô phỏng · Không gửi lệnh phần cứng.':`Đã tính ${samples.length} mẫu bằng C# · Nhấn Phát để xem.`);
  }catch(error){if(token===generation)message(error.message);}finally{if(token===generation){pending=false;updateControls();}}
}
$('motion-form').onsubmit=event=>{event.preventDefault();plan(Object.fromEntries(['x','y','z'].map(axis=>[axis,Number($('target-'+axis).value)])));};
document.querySelectorAll('[data-jog]').forEach(button=>button.onclick=()=>{
  const end={...pose};end[button.dataset.jog]+=Number(button.dataset.sign)*Number($('jog-step').value);
  plan(end,true);
});
$('play').onclick=()=>{if(playing){playing=false;}else{if(sampleIndex===samples.length-1)displaySample(0);elapsed=samples[sampleIndex].time;playing=true;}updateControls();};
$('stop').onclick=()=>{generation++;playing=false;pending=false;updateControls();message('Đã dừng phát tại vị trí hiện tại (không phải lệnh dừng an toàn máy thật).');};
$('step').onclick=()=>{playing=false;displaySample(sampleIndex+1);elapsed=samples[sampleIndex].time;updateControls();};
$('reset').onclick=()=>{playing=false;elapsed=0;displaySample(0);updateControls();};
$('scrub').oninput=()=>{playing=false;displaySample(Number($('scrub').value));elapsed=samples[sampleIndex].time;updateControls();};
function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type}));const anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export-csv').onclick=()=>download('rodal-trajectory.csv','time_s,x_mm,y_mm,z_mm,velocity_mm_s,acceleration_mm_s2\n'+samples.map(s=>[s.time,s.position.x,s.position.y,s.position.z,s.velocity,s.acceleration].join(',')).join('\n'),'text/csv');
$('export-config').onclick=()=>{if(model)download('rodal-axis-mapping.json',JSON.stringify({modelHash:model.hash,cadUp,convention:'Robot world XYZ; serial X -> Y -> Z; imported pose = 0',mapping},null,2),'application/json');};
let previous=performance.now();
function animate(now){
  const delta=(now-previous)/1000;previous=now;
  if(playing&&samples.length){
    elapsed+=delta*Number($('speed').value);
    while(sampleIndex<samples.length-1&&samples[sampleIndex+1].time<=elapsed)sampleIndex++;
    displaySample(sampleIndex);
    if(elapsed>=samples.at(-1).time){displaySample(samples.length-1);playing=false;updateControls();message('Hoàn tất chuyển động mô phỏng.');}
  }
  controls.update();if(dirty){renderer.render(scene,camera);dirty=false;}requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

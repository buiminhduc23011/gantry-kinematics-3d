// CAD-up conversion is a proper rotation (no reflection / geometry distortion).
export function cadToWorld([x,y,z], up) {
  if(up==='y')return [x,-z,y];
  if(up==='-y')return [x,z,-y];
  if(up==='x')return [-z,y,x];
  if(up==='-x')return [z,y,-x];
  if(up==='-z')return [x,-y,-z];
  return [x,y,z];
}
export function worldToCad([x,y,z], up) {
  if(up==='y')return [x,z,-y];
  if(up==='-y')return [x,-z,y];
  if(up==='x')return [z,y,-x];
  if(up==='-x')return [-z,y,x];
  if(up==='-z')return [x,-y,-z];
  return [x,y,z];
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {cadToWorld,worldToCad} from '../web/src/coordinates.js';
test('CAD +Y becomes world +Z; world Y jog follows CAD -Z',()=>{
  assert.deepEqual(cadToWorld([0,1,0],'y').map(value=>value+0),[0,0,1]);
  assert.deepEqual(worldToCad([0,10,0],'y'),[0,0,-10]);
});
test('all six axis orientations round-trip without changing distances',()=>{
  for(const up of ['x','y','z','-x','-y','-z']){
    const original=[123,456,-789];const rotated=cadToWorld(original,up);
    assert.deepEqual(worldToCad(rotated,up),original);
    assert.equal(Math.hypot(...rotated),Math.hypot(...original));
  }
});

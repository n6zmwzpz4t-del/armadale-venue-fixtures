import test from 'node:test';
import assert from 'node:assert/strict';
import {parseLadder,sourceUrl} from '../supporters-core.mjs';
test('official ladder columns map by header, including alternative column order',()=>{
 const rows=parseLadder([[['Rank','Team','MP','W','D','L','GF','GA','PTS','GD'],['1','Armadale SC - First Team','22','14','4','4','45','22','46','23']]]);
 assert.equal(rows[0].points,46);assert.equal(rows[0].goalDifference,23);assert.equal(rows[0].armadale,true);
});
test('empty official ladder is not a fabricated zero table',()=>assert.deepEqual(parseLadder([[['Rank','Team','MP','PTS'],['No data']]]),[]));
test('club and season are explicit in every source link',()=>{const u=new URL(sourceUrl('example','10370',true));assert.equal(u.searchParams.get('yearId'),'8');assert.equal(u.searchParams.get('organisationKey'),'f524913b-317c-4011-8f66-e4eb3f101ebe');});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractFixtures,venueGroup,validateDate,allDivisionResponse,toCsv,toHtml,COMPETITIONS} from '../fixture-core.mjs';
const match=(id,time,venue='Morgan Park')=>({id,startTime:time,team1Id:22,team2Id:33,team1:{name:'Home'},team2:{name:'Away'},venueCourt:{name:'Pitch 2',venue:{name:venue}}});
const round=matches=>({name:'Round 1',division:{name:'U13'},matches});
const extract=rounds=>extractFixtures({rounds},COMPETITIONS[0],1514,'2026-09-13');
test('Perth midnight, both venues, bye and hidden-round exclusions, and duplicate IDs',()=>{
  const {rows,coverage}=extract([round([
    match(1,'2026-09-12T16:00:00Z'),match(1,'2026-09-12T16:00:00Z'),
    match(2,'2026-09-13T15:59:00Z','Alfred Skeet Reserve'),match(3,'2026-09-13T16:00:00Z'),
    match(4,'2026-09-12T15:59:00Z'),match(5,'2026-09-13T02:00:00Z','Other Park'),
    {...match(6,'2026-09-13T03:00:00Z'),team1Id:1}]),
    {...round([match(7,'2026-09-13T03:00:00Z')]),isHidden:true}]);
  assert.deepEqual(rows.map(r=>[r.id,r.time]),[['1','00:00'],['2','23:59']]);
  assert.equal(coverage.hiddenRounds,1);assert.equal(coverage.duplicateMatches,1);assert.equal(coverage.byes,1);
});
test('failures cannot masquerade as no games',()=>{
  assert.throws(()=>extract([]),/No rounds/);
  assert.throws(()=>extractFixtures({rounds:[round([])],allRoundsHidden:true},COMPETITIONS[0],1514,'2026-09-13'),/hidden/);
  assert.throws(()=>extract([round([match(1,'2026-09-13T09:00:00')])]),/unambiguous/);
  assert.throws(()=>extract([round([match(1,'2026-09-13T01:00:00Z'),match(1,'2026-09-13T02:00:00Z')])]),/Conflicting/);
});
test('valid empty result remains distinguishable from failed coverage',()=>{
  const r=extract([round([match(1,'2026-09-13T01:00:00Z','Other Park')])]);
  assert.equal(r.rows.length,0);assert.equal(r.coverage.scanned,1);assert.equal(r.coverage.onDate,1);
});
test('dates and venue boundaries',()=>{
  assert.throws(()=>validateDate('2026-02-30'));assert.throws(()=>validateDate('13/09/2026'));
  assert.equal(venueGroup('Morgan Park (Armadale)'),'Morgan Park');assert.equal(venueGroup('Morgan Parkway'),null);
  assert.equal(venueGroup('Alfred Skeet Oval'),'Alfred Skeet');
});
test('capture only all-division public fixture responses',()=>{
  assert.equal(allDivisionResponse('https://api.squadi.com/livescores/round/matches?divisionId=&teamIds='),true);
  assert.equal(allDivisionResponse('https://api.squadi.com/livescores/round/matches?divisionId=101'),false);
  assert.equal(allDivisionResponse('https://other.example/round/matches'),false);
});
test('exports safely quote spreadsheet values and escape HTML',()=>{
  const rows=extract([round([match(1,'2026-09-13T01:00:00Z')])]).rows;
  rows[0].home='=HYPERLINK("https://example.com")'; rows[0].away='<script>alert(1)</script>';
  assert.ok(toCsv(rows).includes('"\'=HYPERLINK('));
  const html=toHtml({date:'2026-09-13',retrievedAt:'test',coverage:[],fixtures:rows});
  assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));
});

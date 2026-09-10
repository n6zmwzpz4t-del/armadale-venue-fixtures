import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isArmadale,matchOutcome,extractClub} from '../club-core.mjs';
import {COMPETITIONS} from '../fixture-core.mjs';
test('Armadale and ASC source naming, without treating opponents as our club',()=>{
 for(const name of ['Armadale SC - U14 JDL D2','ASC - U11 G Geckos','Armadale SC White - U8G South'])assert.equal(isArmadale(name),true);
 assert.equal(isArmadale('Rockingham City FC'),false);assert.equal(isArmadale('East Armadale United'),false);
});
test('unplayed default zeroes and FINAL resultStatus are not reported as a draw',()=>{
 assert.equal(matchOutcome({team1Score:0,team2Score:0,resultStatus:'FINAL'}).homeScore,null);
 assert.equal(matchOutcome({team1Score:0,team2Score:0,team1ResultId:3,team2ResultId:3,matchSubstatusRefId:1,resultStatus:'FINAL'}).kind,'unknown');
 assert.equal(matchOutcome({team1Score:0,team2Score:0,matchStatus:'ENDED'}).homeScore,0);
 assert.equal(matchOutcome({team1Score:2,team2Score:1}).kind,'reported');
});
test('postponed, abandoned and forfeits take precedence over scores',()=>{
 assert.equal(matchOutcome({matchSubstatusRefId:2,team1Score:0,team2Score:0}).kind,'postponed');
 assert.equal(matchOutcome({team1ResultId:8}).kind,'abandoned');
 assert.equal(matchOutcome({team1ResultId:4,team2ResultId:5}).label,'Away forfeit');
});
test('club fixtures include away grounds and both-club games',()=>{
 const base={id:1,startTime:'2026-09-13T01:00:00Z',team1Id:10,team2Id:20,team1:{id:10,name:'Opponent'},team2:{id:20,name:'Armadale SC'},venueCourt:{name:'Field A',venue:{name:'Away Ground'}}};
 const r=extractClub({rounds:[{division:{name:'U14'},matches:[base,{...base,id:2,team1:{id:30,name:'ASC - U14'}}]}]},COMPETITIONS[0],1514);
 assert.deepEqual(r.rows.map(r=>r.side),['away','both']);assert.equal(r.rows[0].venue,'Away Ground');
});

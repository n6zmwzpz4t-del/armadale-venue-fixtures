import {isArmadale} from './club-core.mjs';
export const ORGANISATION='f524913b-317c-4011-8f66-e4eb3f101ebe';
export const YEAR=2026;
export const YEAR_ID='8';
export function sourceUrl(competitionKey,divisionId='All',ladder=false){
 const u=new URL(ladder?'https://registration.squadi.com/livescorePublicLadder':'https://registration.squadi.com/livescoreSeasonFixture');
 u.search=new URLSearchParams({organisationKey:ORGANISATION,yearId:YEAR_ID,...(competitionKey?{competitionUniqueKey:competitionKey}:{}),divisionId,teamId:'-1'});return u.href;
}
export function parseLadder(tables){
 for(const table of tables){
  const headers=table[0]?.map(s=>s.replace(/\s+/g,' ').trim())||[];
  const idx=key=>headers.findIndex(h=>h.toUpperCase()===key);
  const teamIndex=idx('TEAM'),rankIndex=idx('RANK');
  if(teamIndex<0||rankIndex<0||idx('MP')<0||idx('PTS')<0)continue;
  const rows=[];
  for(const cells of table.slice(1)){
   if(cells.length<headers.length||!/^\d+$/.test(cells[rankIndex]?.trim()))continue;
   const read=key=>{const text=cells[idx(key)]?.trim();return text!==undefined&&/^-?\d+(?:\.\d+)?$/.test(text)?Number(text):null;};
   const team=cells[teamIndex]?.trim();if(!team)continue;
   const row={position:read('RANK'),team,played:read('MP'),won:read('W'),drawn:read('D'),lost:read('L'),goalsFor:read('GF'),goalsAgainst:read('GA'),points:read('PTS'),armadale:isArmadale(team)};
   row.goalDifference=read('GD')??(row.goalsFor!==null&&row.goalsAgainst!==null?row.goalsFor-row.goalsAgainst:null);
   if(row.played===null||row.points===null)throw Error('Ladder cells have an unrecognised format');
   rows.push(row);
  }
  if(rows.length){if(new Set(rows.map(r=>r.team)).size!==rows.length)throw Error('Duplicate ladder rows');return rows;}
 }
 return [];
}

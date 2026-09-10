import {TIMEZONE,fixturePage} from './fixture-core.mjs';
export function isArmadale(name) { return /^(?:armadale(?:\s+(?:sc|soccer\s+club))?\b|asc\s*(?:-|–|—|\b))/i.test(String(name||'').trim()); }
const day = new Intl.DateTimeFormat('en-CA',{timeZone:TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit'});
const clock = new Intl.DateTimeFormat('en-GB',{timeZone:TIMEZONE,hour:'2-digit',minute:'2-digit',hour12:false});
const number = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
export function matchOutcome(m) {
  const status=String(m.matchStatus||'').toUpperCase(), sub=Number(m.matchSubstatusRefId);
  const a=number(m.team1ResultId),b=number(m.team2ResultId);
  if([8,9].includes(a)||[8,9].includes(b)||status==='ABANDONED'||status==='7'||sub===7)return {kind:'abandoned',label:'Abandoned',homeScore:null,awayScore:null};
  if(status==='POSTPONED'||sub===2)return {kind:'postponed',label:'Postponed',homeScore:null,awayScore:null};
  if(['CANCELLED','CANCELED'].includes(status))return {kind:'cancelled',label:'Cancelled',homeScore:null,awayScore:null};
  if([4,5,6].includes(a)||[4,5,6].includes(b))return {kind:'forfeit',label:a===5?'Home forfeit':b===5?'Away forfeit':'Forfeit',homeScore:null,awayScore:null};
  const hs=number(m.team1Score),as=number(m.team2Score);
  // Miniroos may prepopulate DRAW result IDs and zero scores even for future games.
  const completed=status==='ENDED'||status==='5'||sub===5;
  const hasScore=hs!==null&&as!==null;
  const kind=['STARTED','PAUSED'].includes(status)?'live':completed?'completed':hasScore&&(hs>0||as>0)?'reported':'unknown';
  return {kind,label:kind==='live'?'In progress':completed?'Full time':kind==='reported'?'Reported score':'Result not published',
    homeScore:kind!=='unknown'&&hasScore?hs:null,awayScore:kind!=='unknown'&&hasScore?as:null,
    homePenalty:m.hasPenalty?number(m.team1PenaltyScore):null,awayPenalty:m.hasPenalty?number(m.team2PenaltyScore):null};
}
export function extractClub(body,competition,competitionId) {
  const data=Array.isArray(body?.rounds)?body:body?.data;
  if(!data||!Array.isArray(data.rounds)||data.allRoundsHidden||!data.rounds.length)throw new Error('Club fixture coverage is unavailable.');
  const rows=[],seen=new Map(),teams=new Map(),statuses={};let hiddenRounds=0,byes=0;
  for(const round of data.rounds){
    if(round.isHidden){hiddenRounds++;continue;}
    for(const m of round.matches||[]){
      const home=String(m.team1?.name||'').trim(),away=String(m.team2?.name||'').trim();
      const armHome=isArmadale(home),armAway=isArmadale(away);
      if(!armHome&&!armAway)continue;
      if([m.team1Id,m.team2Id].some(id=>String(id)==='1')||[home,away].some(n=>/^bye$/i.test(n))){byes++;continue;}
      if(!m.id||!home||!away)throw new Error('Armadale match is missing its ID or team names.');
      const date=m.startTime?new Date(m.startTime):null;
      if(date&&(!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(m.startTime)||!Number.isFinite(date.getTime())))throw new Error(`Armadale match ${m.id} has an ambiguous start time.`);
      const division=String(round.division?.name||m.divisionName||'').trim();
      for(const [team,own] of [[m.team1,armHome],[m.team2,armAway]])if(own)teams.set(String(team.id||team.teamUniqueKey||team.name),{name:team.name.trim(),division,competition:competition.name});
      const row={id:String(m.id),competitionId:String(competitionId),competition:competition.name,division,
        startTime:date?date.toISOString():null,date:date?day.format(date):null,time:date?clock.format(date):null,
        home,away,armadaleHome:armHome,armadaleAway:armAway,side:armHome&&armAway?'both':armHome?'home':'away',
        venue:m.venueCourt?.venue?.name||'',pitch:m.venueCourt?.name||'',round:round.name||'',
        status:m.matchStatus??null,resultStatus:m.resultStatus??null,matchSubstatusRefId:m.matchSubstatusRefId??null,
        team1ResultId:m.team1ResultId??null,team2ResultId:m.team2ResultId??null,outcome:matchOutcome(m),
        url:`https://registration.squadi.com/matchSummary?matchId=${encodeURIComponent(m.id)}&competitionId=${competitionId}&competitionUniqueKey=${competition.key}`};
      if(seen.has(row.id)){if(JSON.stringify(seen.get(row.id))!==JSON.stringify(row))throw new Error(`Conflicting copies of Armadale match ${row.id}`);continue;}
      seen.set(row.id,row);rows.push(row);statuses[row.outcome.kind]=(statuses[row.outcome.kind]||0)+1;
    }
  }
  return {rows,coverage:{competition:competition.name,competitionId,sourceUrl:fixturePage(competition.key),clubTeams:[...teams.values()],fixtures:rows.length,hiddenRounds,byes,statuses}};
}

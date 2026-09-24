import {chromium} from 'playwright';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {extractClub,isArmadale} from './club-core.mjs';
import {allDivisionResponse,TIMEZONE} from './fixture-core.mjs';
import {sourceUrl,parseLadder,ORGANISATION,YEAR} from './supporters-core.mjs';

const now=()=>new Date().toISOString();
let previous={coverage:[],fixtures:[],ladders:[]};
try{previous=JSON.parse(await readFile('reports/supporters.json','utf8'));}catch{}
const browser=await chromium.launch({headless:true});
const fixtures=[],coverage=[],ladders=[];
const checkedAt=now();
async function newPage(){const c=await browser.newContext({timezoneId:TIMEZONE,locale:'en-AU'});return {context:c,page:await c.newPage()};}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function openDiscoveryPage(attempts=3){
 let lastError;
 for(let attempt=1;attempt<=attempts;attempt++){
  const {context,page}=await newPage();
  try{
   console.log(`Opening Squadi competition selector (attempt ${attempt}/${attempts})`);
   await page.goto(sourceUrl(),{waitUntil:'domcontentloaded',timeout:60000});
   await page.getByText('Armadale Soccer Club',{exact:true}).waitFor({timeout:60000});
   await page.getByRole('dialog').filter({hasText:'Loading...'}).waitFor({state:'hidden',timeout:120000});
   return {context,page};
  }catch(e){
   lastError=e;
   console.warn(`Squadi competition selector attempt ${attempt}/${attempts} failed: ${e.message}`);
   await context.close().catch(()=>{});
   if(attempt<attempts)await sleep(10000*attempt);
  }
 }
 const error=new Error(`Squadi competition selector unavailable after ${attempts} attempts: ${lastError?.message||lastError}`);
 error.name='SquadiUnavailableError';
 throw error;
}
const isTransientSquadiFailure=e=>{
 const message=String(e?.message||e||'');
 return e?.name==='SquadiUnavailableError'||e?.name==='TimeoutError'||/Squadi|timeout|timed out|ERR_|competition discovery|No club fixtures returned|Loading/i.test(message);
};
try{
 const {context,page}=await openDiscoveryPage();
 const reject=page.getByRole('button',{name:'Reject non-essential',exact:true});if(await reject.isVisible())await reject.click({timeout:30000});
 const combo=page.getByRole('combobox').nth(3);await combo.press('ArrowDown');
 await page.getByRole('option').first().waitFor({state:'attached',timeout:60000});
 const competitions=new Map();let previousActive=null;
 for(let i=0;i<200;i++){
  const opts=await page.getByRole('option').evaluateAll(els=>els.map(e=>({name:e.getAttribute('aria-label'),key:e.textContent.trim()})));
  for(const o of opts)if(o.name&&/^[0-9a-f-]{36}$/i.test(o.key))competitions.set(o.key,o.name);
  await combo.press('ArrowDown');
  const active=await combo.getAttribute('aria-activedescendant');
  if(i>0&&active===previousActive)break;previousActive=active;
  // The dropdown wraps; after a full pass all choices have been read.
  if(i>1&&active?.endsWith('_0'))break;
 }
 await context.close();
 if(competitions.size<3)throw Error('Competition discovery returned too few choices; previous data retained');
 console.log(JSON.stringify({organisation:ORGANISATION,year:YEAR,discovered:[...competitions].map(([key,name])=>({key,name}))}));
 for(const [key,name] of competitions){
  const {context,page}=await newPage();
  let timer;const requested=sourceUrl(key);const check={competition:name,competitionKey:key,sourceUrl:requested,checkedAt:now(),status:'ok'};
  try{
   let resolve,reject;const pending=new Promise((yes,no)=>{resolve=yes;reject=no});pending.catch(()=>{});
   timer=setTimeout(()=>reject(Error('Timed out loading published rounds')),125000);
   await page.route('https://api.squadi.com/**/round/matches*',async route=>{
    if(route.request().method()!=='GET'||!allDivisionResponse(route.request().url()))return route.continue();
    try{const response=await route.fetch({timeout:110000});if(!response.ok())throw Error('Squadi returned '+response.status());const body=await response.json();await route.fulfill({response});resolve({body,url:route.request().url()});}catch(e){reject(e);await route.abort().catch(()=>{});}
   });
   await page.goto(requested,{waitUntil:'domcontentloaded',timeout:60000});
   const {body,url}=await pending;clearTimeout(timer);
   const data=Array.isArray(body.rounds)?body:body.data;
   if(!data||!Array.isArray(data.rounds)||data.hasMore||data.nextPage||data.nextCursor)throw Error('Incomplete or unrecognised rounds response');
   if(data.allRoundsHidden){Object.assign(check,{status:'hidden',fixtures:0,clubTeams:[],message:'Fixtures are hidden in Squadi'});}
   else if(!data.rounds.length){Object.assign(check,{fixtures:0,clubTeams:[],message:'No published rounds'});}
   else{
    const competitionId=new URL(url).searchParams.get('competitionId');
    if(!/^\d+$/.test(competitionId))throw Error('Missing competition ID');
    const extracted=extractClub(body,{name,key},competitionId);
    fixtures.push(...extracted.rows.map(r=>({...r,retrievedAt:check.checkedAt})));
    Object.assign(check,extracted.coverage,{sourceUrl:requested});
    const divisions=new Map();
    for(const r of extracted.rows)if(r.divisionId)divisions.set(r.divisionId,r.division);
    // Byes are omitted from match lists but still reveal a club's division.
    for(const round of data.rounds)if(!round.isHidden&&round.division?.id&&(round.matches||[]).some(m=>isArmadale(m.team1?.name)||isArmadale(m.team2?.name)))divisions.set(String(round.division.id),round.division.name);
    check.divisions=[...divisions].map(([id,name])=>({id,name}));
    if(extracted.rows.length&&!divisions.size)throw Error('Division IDs missing; cannot verify ladder coverage');
   }
  }catch(e){
   check.status='error';check.message=e.message;
   const old=previous.coverage.find(c=>c.competitionKey===key);
   if(old){Object.assign(check,{retrievedAt:old.retrievedAt||old.checkedAt,divisions:old.divisions,clubTeams:old.clubTeams,fixtures:old.fixtures});fixtures.push(...previous.fixtures.filter(r=>r.competitionKey===key));}
  }finally{clearTimeout(timer);await context.close();}
  if(check.status==='ok')check.retrievedAt=check.checkedAt;
  coverage.push(check);console.log(JSON.stringify({competition:name,status:check.status,fixtures:check.fixtures,divisions:check.divisions,message:check.message}));
 }
 const jobs=coverage.flatMap(c=>(c.divisions||[]).map(d=>({competition:c.competition,competitionKey:c.competitionKey,division:d.name,divisionId:d.id})));
 async function ladderJob(job){
  const {context,page}=await newPage();const url=sourceUrl(job.competitionKey,job.divisionId,true);
  const entry={...job,url,checkedAt:now(),status:'unpublished',rows:[]};
  try{
   await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
   await page.getByRole('table').waitFor({timeout:45000});
   // Wait for the source's loading dialog to settle, then for data or explicit empty table.
   const panel=page.getByRole('tabpanel',{name:'Ladder',exact:true});
   await panel.getByText(job.division,{exact:true}).filter({visible:true}).first().waitFor({state:'visible',timeout:30000});
   await page.getByRole('dialog').filter({hasText:'Loading...'}).waitFor({state:'hidden',timeout:45000});
   await panel.getByRole('table').getByRole('row').filter({hasText:/^\d+\s|No data|not for public display/i}).first().waitFor({state:'visible',timeout:15000}).catch(()=>{});
   const tables=await panel.getByRole('table').evaluateAll(ts=>ts.map(t=>[...t.rows].map(r=>[...r.cells].map(c=>(c.innerText||c.textContent||'').replace(/\s+/g,' ').trim()))));
   entry.rows=parseLadder(tables);
   if(entry.rows.length){entry.status=entry.rows.some(r=>r.armadale)?'ok':'unlisted';entry.retrievedAt=now();if(entry.status==='unlisted')entry.message='Armadale is not listed in the current table for this division';}
   else{
    const body=await panel.innerText();
    if(!/No data|not available|not published|not displayed|not for public display|currently being worked on/i.test(body))throw Error('Ladder did not finish loading');
    entry.message='No ladder published by Squadi';entry.retrievedAt=now();
   }
  }catch(e){
   entry.status='error';entry.message=e.message;
   const old=previous.ladders.find(l=>l.competitionKey===job.competitionKey&&l.divisionId===job.divisionId&&l.rows?.length);
   if(old){entry.rows=old.rows;entry.retrievedAt=old.retrievedAt;}
  }finally{await context.close();}
  ladders.push(entry);console.log(JSON.stringify({ladder:entry.division,competition:entry.competition,status:entry.status,rows:entry.rows.length,message:entry.message}));
 }
 // Three public pages at a time; no credentials, private rosters or player data.
 let cursor=0;await Promise.all(Array.from({length:3},async()=>{while(cursor<jobs.length)await ladderJob(jobs[cursor++]);}));
 const dedup=new Map(fixtures.map(r=>[r.competitionKey+':'+r.id,r]));
 if(!dedup.size)throw Error('No club fixtures returned; retaining previous report');
 const report={schemaVersion:2,organisationKey:ORGANISATION,organisation:'Armadale Soccer Club',season:YEAR,timezone:TIMEZONE,checkedAt,retrievedAt:now(),refreshIntervalMinutes:60,coverage,fixtures:[...dedup.values()].sort((a,b)=>(a.startTime||'9999').localeCompare(b.startTime||'9999')),ladders:ladders.sort((a,b)=>a.competition.localeCompare(b.competition)||a.division.localeCompare(b.division))};
 await mkdir('reports',{recursive:true});await writeFile('reports/supporters.json.tmp',JSON.stringify(report)+'\n');await rename('reports/supporters.json.tmp','reports/supporters.json');
 console.log(JSON.stringify({fixtures:report.fixtures.length,competitions:coverage.length,failedCompetitions:coverage.filter(c=>c.status==='error').length,ladders:ladders.filter(l=>l.rows.length).length,failedLadders:ladders.filter(l=>l.status==='error').length}));
}catch(e){
 if(isTransientSquadiFailure(e)&&previous.fixtures?.length){
  console.warn(`Squadi is temporarily unavailable; retaining the last good supporter report (${previous.fixtures.length} fixtures).`);
  console.log(JSON.stringify({status:'skipped',reason:'squadi-unavailable',message:e.message,retainedFixtures:previous.fixtures.length,retainedCheckedAt:previous.checkedAt,retainedRetrievedAt:previous.retrievedAt}));
 }else{
  throw e;
 }
}finally{await browser.close();}

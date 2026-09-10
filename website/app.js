import {selectFixtures,validateReport,perthDate,addDays,VIEWS,SIDES} from './view-model.mjs';
const ROOT=new URL('./',import.meta.url), SOURCE='https://raw.githubusercontent.com/n6zmwzpz4t-del/armadale-venue-fixtures/main/reports/club.json';
const container=document.getElementById('fixtures'),notice=document.getElementById('notice'),select=document.getElementById('side'),more=document.getElementById('more');
const suffix=location.pathname.slice(ROOT.pathname.length).replace(/^\/+|\/+$/g,'');
let view=suffix==='results'?'results':suffix==='season'?'season':'upcoming';
let side=new URL(location.href).searchParams.get('side')||'all';if(!SIDES.includes(side))side='all';
let report=null,limit=50;
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const formatDate=date=>new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Perth',weekday:'long',day:'numeric',month:'long'}).format(new Date(date+'T12:00:00+08:00'));
const displayTeamName=name=>String(name||'').split(/\s+-\s+/)[0].trim();
const titles={upcoming:'Next 7 days',results:'Past results',season:'Remaining season'};
function updateNavigation(){
 select.value=side;document.title=titles[view]+' — Armadale SC';document.getElementById('view-title').textContent=titles[view];
 for(const a of document.querySelectorAll('[data-view]')){const url=new URL(a.dataset.view==='upcoming'?'./':a.dataset.view+'/',ROOT);if(side!=='all')url.searchParams.set('side',side);a.href=url.href;if(a.dataset.view===view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}
 const today=perthDate();document.getElementById('view-range').textContent=view==='upcoming'?formatDate(today)+' – '+formatDate(addDays(today,6)):view==='results'?'Most recent dates first · Scores as published':"All upcoming published fixtures · Dates to be confirmed are listed last";
}
function row(r){
 const homeName=displayTeamName(r.home),awayName=displayTeamName(r.away);
 const article=el('article',undefined,'match');article.setAttribute('aria-label',homeName+' versus '+awayName);
 const kickoff=el('div',r.time||'TBC','kickoff');kickoff.append(el('span',r.pitch||'Pitch TBC','pitch'),el('span',r.side==='both'?'Internal':r.side==='home'?'Home':'Away','side'));
 const teams=el('div',undefined,'teams');teams.append(el('div',homeName,r.armadaleHome?'own-team':'other-team'));const away=el('div',undefined,'away '+(r.armadaleAway?'own-team':'other-team'));away.append(el('span','v','versus'),document.createTextNode(awayName));teams.append(away);
 const details=el('div',undefined,'details');details.append(el('div',r.division||'Division TBC','division'),el('div',r.competition,'competition'));
 const end=el('div',undefined,'match-end');const outcome=r.outcome,started=r.startTime&&Date.parse(r.startTime)<Date.now();
 const oldLive=outcome.kind==='live'&&started&&Date.now()-Date.parse(r.startTime)>=4*3600000;
 if(started&&!oldLive&&outcome.homeScore!==null&&outcome.awayScore!==null){end.append(el('div',outcome.homeScore+' – '+outcome.awayScore,'score'));if(outcome.homePenalty!==null&&outcome.homePenalty!==undefined)end.append(el('div','Pens '+outcome.homePenalty+' – '+outcome.awayPenalty,'score-note'));end.append(el('div',outcome.label,'score-note'));}
 else if(view==='results'||['postponed','abandoned','cancelled','forfeit','live'].includes(outcome.kind))end.append(el('div',oldLive?'Result not confirmed':outcome.label,'status'));
 const link=el('a','Squadi','fixture-link');link.href=r.url;link.target='_blank';link.rel='noopener';link.setAttribute('aria-label','View '+homeName+' versus '+awayName+' in Squadi');end.append(link);article.append(kickoff,teams,details,end);return article;
}
function render(){
 updateNavigation();if(!report)return;
 const checked=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Perth',day:'numeric',month:'short',hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(report.retrievedAt));
 document.getElementById('updated').textContent='Checked '+checked+' AWST · All listed Armadale junior teams';
 const all=selectFixtures(report,{view,side}),rows=view==='results'?all.slice(0,limit):all;
 document.getElementById('result-count').textContent=all.length+' '+(all.length===1?'game':'games')+(side==='all'?'':' · '+(side==='home'?'Home':'Away'))+(rows.length<all.length?' · Showing latest '+rows.length:'');
 container.replaceChildren();more.hidden=rows.length>=all.length||view!=='results';
 if(!rows.length){container.append(el('p',view==='results'?'No past games match this filter.':'No upcoming published games match this filter.','result-empty'));return;}
 const dates=new Map();
 for(const r of rows){const date=view==='season'&&(r.outcome.kind==='postponed'||!r.date)?'tbc':r.date||'tbc';if(!dates.has(date))dates.set(date,[]);dates.get(date).push(r);}
 let index=0;
 for(const [date,games] of dates){
  container.append(el('h2',date==='tbc'?'Date to be confirmed':formatDate(date),'day-title'));
  const venues=new Map();for(const r of games){const venue=r.venue||'Venue to be confirmed';if(!venues.has(venue))venues.set(venue,[]);venues.get(venue).push(r);}
  for(const [venue,matches] of venues){
   const section=el('section',undefined,'venue');const heading=el('div',undefined,'venue-heading');const h=el('h3',venue);h.id='venue-'+index++;heading.append(h,el('span',matches.length+' '+(matches.length===1?'game':'games'),'venue-count'));section.setAttribute('aria-labelledby',h.id);section.append(heading);
   for(const r of matches.sort((a,b)=>(a.time||'').localeCompare(b.time||'')||a.pitch.localeCompare(b.pitch,undefined,{numeric:true})))section.append(row(r));container.append(section);
  }
 }
}
function setSide(value){if(!SIDES.includes(value))throw Error('Invalid home/away filter');side=value;limit=50;const u=new URL(location.href);if(side==='all')u.searchParams.delete('side');else u.searchParams.set('side',side);history.replaceState(null,'',u);render();}
select.addEventListener('change',()=>setSide(select.value));more.addEventListener('click',()=>{limit+=50;render();});updateNavigation();
async function load(url){const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Fixtures unavailable');return validateReport(await r.json());}
let fresh=false;
const snapshot=load(new URL('club.json',ROOT)).then(r=>{if(!fresh){report=r;render();}}).catch(()=>{});
load(SOURCE).then(r=>{fresh=true;report=r;render();notice.hidden=false;notice.textContent=Date.now()-Date.parse(r.retrievedAt)>86400000?'This fixture list was checked more than 24 hours ago. Confirm changes in Squadi.':'';notice.hidden=!notice.textContent;}).catch(async()=>{await snapshot;notice.hidden=false;notice.textContent=report?'The latest update could not be loaded. Showing the saved list; check the time above and confirm changes in Squadi.':'The fixture list could not be loaded. Please try again shortly.';if(!report){container.replaceChildren();document.getElementById('updated').textContent='Fixtures unavailable';}});
if(document.modelContext?.registerTool){
 const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
 try{Promise.resolve(document.modelContext.registerTool({name:'filter_armadale_fixtures',title:'Filter Armadale fixtures',description:'Apply the home/away filter to the current fixture view and return the matching games.',inputSchema:{type:'object',properties:{side:{type:'string',enum:SIDES}},required:['side'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute(input){if(!input||!SIDES.includes(input.side)||Object.keys(input).some(k=>k!=='side'))throw Error('Use side all, home or away');if(!report)throw Error('Fixtures are not loaded');setSide(input.side);const matches=selectFixtures(report,{view,side});return {view,side,count:matches.length,truncated:matches.length>50,games:matches.slice(0,50).map(({date,time,home,away,venue,url})=>({date,time,home:displayTeamName(home),away:displayTeamName(away),venue,url}))};}},{signal:lifecycle.signal})).catch(()=>{});}catch{}
}

'use strict';
const SOURCE='https://raw.githubusercontent.com/n6zmwzpz4t-del/armadale-venue-fixtures/main/reports/latest.json';
const container=document.getElementById('fixtures');
const notice=document.getElementById('notice');
function el(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
function validate(report){
 if(!report||!/^\d{4}-\d{2}-\d{2}$/.test(report.date)||!Number.isFinite(Date.parse(report.retrievedAt))||!Array.isArray(report.fixtures)||!Array.isArray(report.coverage)||report.coverage.length!==3)throw Error('Incomplete report');
 for(const r of report.fixtures){
  if(r.date!==report.date||!['Morgan Park','Alfred Skeet'].includes(r.venueGroup)||!/^\d{2}:\d{2}$/.test(r.time)||typeof r.home!=='string'||typeof r.away!=='string')throw Error('Invalid fixture');
  const u=new URL(r.url);if(u.origin!=='https://registration.squadi.com'||u.pathname!=='/matchSummary')throw Error('Invalid match link');
 }
 return report;
}
function render(report){
 const d=new Date(report.date+'T12:00:00+08:00');
 document.getElementById('fixture-date').textContent=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Perth',weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(d);
 const checked=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Perth',day:'numeric',month:'short',hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(report.retrievedAt));
 document.getElementById('updated').textContent=report.fixtures.length+' games across 2 venues · Checked '+checked+' AWST';
 container.replaceChildren();
 for(const [index,name] of ['Morgan Park','Alfred Skeet'].entries()){
  const rows=report.fixtures.filter(r=>r.venueGroup===name).sort((a,b)=>a.time.localeCompare(b.time)||a.pitch.localeCompare(b.pitch,undefined,{numeric:true})||a.home.localeCompare(b.home));
  const section=el('section',undefined,'venue');section.id=name.toLowerCase().replaceAll(' ','-');section.setAttribute('aria-labelledby',section.id+'-title');
  const heading=el('div',undefined,'venue-heading');heading.append(el('span','0'+(index+1),'venue-index'));
  const h2=el('h2',name);h2.id=section.id+'-title';heading.append(h2,el('span',rows.length+' '+(rows.length===1?'game':'games'),'venue-count'));section.append(heading);
  if(!rows.length){section.append(el('p','No published fixtures found for this date.','empty'));}
  else{
   const columns=el('div',undefined,'column-head');columns.setAttribute('aria-hidden','true');for(const s of ['Kick-off','Teams','Competition / Division',''])columns.append(el('span',s));section.append(columns);
   for(const r of rows){
    const article=el('article',undefined,'match');article.setAttribute('aria-label',r.time+' '+r.home+' versus '+r.away);
    const kickoff=el('div',r.time,'kickoff');kickoff.append(el('span',r.pitch||'Pitch TBC','pitch'));
    const teams=el('div',undefined,'teams');teams.append(el('div',r.home));const away=el('div',undefined,'away');away.append(el('span','v','versus'),document.createTextNode(r.away));teams.append(away);
    const details=el('div',undefined,'details');details.append(el('div',r.division||'Division TBC','division'),el('div',r.competition,'competition'));
    if(r.status&& !['NOT_STARTED','SCHEDULED','PENDING'].includes(r.status.toUpperCase()))details.append(el('div',r.status.replaceAll('_',' '),'status'));
    const link=el('a','Squadi','fixture-link');link.href=r.url;link.target='_blank';link.rel='noopener';link.setAttribute('aria-label','View '+r.home+' versus '+r.away+' in Squadi');
    article.append(kickoff,teams,details,link);section.append(article);
   }
  }
  container.append(section);
 }
}
async function load(url){const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Fixtures unavailable');return validate(await response.json());}
(async()=>{
 try{render(await load(SOURCE));}
 catch{
  try{render(await load('./fixtures.json'));notice.hidden=false;notice.textContent='The latest update could not be loaded. Showing the saved fixture list; check the time above and confirm any changes in Squadi.';}
  catch{container.replaceChildren(el('p','The fixture list could not be loaded. Please try again shortly, or open the fixture source below.','empty'));document.getElementById('updated').textContent='Fixtures unavailable';}
 }
})();

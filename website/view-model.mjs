export const VIEWS=['upcoming','results','season'];
export const SIDES=['all','home','away'];
export function perthDate(now=new Date()) {return new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Perth',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function addDays(date,count){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+count);return d.toISOString().slice(0,10);}
export function selectFixtures(report,{view='upcoming',side='all'}={},now=new Date()){
 if(!VIEWS.includes(view)||!SIDES.includes(side))throw new Error('Invalid fixture view or home/away filter');
 const today=perthDate(now),end=addDays(today,7),epoch=now.getTime();
 return report.fixtures.filter(r=>{
  if(side==='home'&&!r.armadaleHome||side==='away'&&!r.armadaleAway)return false;
  const start=r.startTime?Date.parse(r.startTime):null,kind=r.outcome.kind;
  const live=kind==='live'&&start!==null&&start<=epoch&&epoch-start<4*3600000;
  if(view==='results')return start!==null&&start<epoch&&!live;
  if(['completed','forfeit','abandoned','cancelled'].includes(kind))return false;
  if(view==='season'&&(start===null||kind==='postponed'))return true;
  const upcoming=start!==null&&(start>=epoch||live);
  return upcoming&&(view==='season'||r.date>=today&&r.date<end);
 }).sort((a,b)=>{
  if(view==='results')return (b.startTime||'').localeCompare(a.startTime||'')||a.home.localeCompare(b.home);
  const key=r=>r.outcome.kind==='postponed'||!r.startTime?'9999':r.date;
  return key(a).localeCompare(key(b))||a.venue.localeCompare(b.venue)||(a.time||'').localeCompare(b.time||'')||a.pitch.localeCompare(b.pitch,undefined,{numeric:true});
 });
}
export function validateReport(r){
 if(!r||!Array.isArray(r.fixtures)||!Array.isArray(r.coverage)||r.coverage.length!==3||!Number.isFinite(Date.parse(r.retrievedAt)))throw new Error('Incomplete club report');
 for(const f of r.fixtures){
  if(typeof f.home!=='string'||typeof f.away!=='string'||(!f.armadaleHome&&!f.armadaleAway)||!f.outcome||f.startTime&&!Number.isFinite(Date.parse(f.startTime)))throw new Error('Invalid club fixture');
  const u=new URL(f.url);if(u.origin!=='https://registration.squadi.com'||u.pathname!=='/matchSummary')throw new Error('Invalid match link');
 }
 return r;
}

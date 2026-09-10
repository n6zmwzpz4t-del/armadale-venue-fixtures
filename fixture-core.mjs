export const TIMEZONE = 'Australia/Perth';
export const DEFAULT_DATE = '2026-09-13';
export const COMPETITIONS = [
  {name: 'Junior Community League', key: 'fafe940b-0a16-474a-9ac8-9dbf00035b0c'},
  {name: 'Junior Development League', key: '2929eee2-4f37-46f3-a6d6-123acee5443f'},
  {name: 'Miniroos', key: '018d2b7c-6797-4cd1-a2c9-8aa2784cb832'},
];
export function validateDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date)
    throw new Error('Use a real calendar date in YYYY-MM-DD format.');
  return date;
}
export function fixturePage(key) {
  const u = new URL('https://registration.squadi.com/livescoreSeasonFixture');
  u.search = new URLSearchParams({organisationKey:'27a1f3ab-90c1-4412-853f-d85c9b27967c', yearId:'8', competitionUniqueKey:key, divisionId:'All', teamId:'-1'});
  return u.href;
}
export function venueGroup(name) {
  const words = String(name).toLowerCase().replace(/[^a-z0-9]+/g,' ');
  if (/\bmorgan park\b/.test(words)) return 'Morgan Park';
  if (/\balfred skeet\b/.test(words)) return 'Alfred Skeet';
  return null;
}
const dateFormat = new Intl.DateTimeFormat('en-CA',{timeZone:TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit'});
const timeFormat = new Intl.DateTimeFormat('en-GB',{timeZone:TIMEZONE,hour:'2-digit',minute:'2-digit',hour12:false});
export function allDivisionResponse(url) {
  const u = new URL(url);
  const all = v => [null,'','All','all','-1','[]'].includes(v);
  return u.hostname === 'api.squadi.com' && u.pathname.endsWith('/round/matches') && all(u.searchParams.get('divisionId')) && all(u.searchParams.get('teamIds'));
}
export function extractFixtures(body, competition, competitionId, date) {
  validateDate(date);
  const data = Array.isArray(body?.rounds) ? body : body?.data;
  if (!data || !Array.isArray(data.rounds)) throw new Error('Unexpected fixture response: rounds are missing.');
  if (data.allRoundsHidden) throw new Error('Competition fixtures are hidden.');
  if (!data.rounds.length) throw new Error('No rounds returned; competition coverage cannot be verified.');
  if (data.hasMore || data.nextPage || data.nextCursor) throw new Error('Squadi returned a paginated response; scraper needs updating.');
  if (!/^\d+$/.test(String(competitionId))) throw new Error('Missing or invalid competition ID.');
  const rows = [], seen = new Map(), divisions = new Set(), venueCounts = {}, dates = new Set();
  let scanned = 0, onDate = 0, hiddenRounds = 0, byes = 0, duplicateMatches = 0, baseline = null;
  for (const round of data.rounds) {
    if (round.isHidden) { hiddenRounds++; continue; }
    if (!Array.isArray(round.matches)) throw new Error('Unexpected round format.');
    if (round.division?.name) divisions.add(round.division.name);
    for (const match of round.matches) {
      scanned++;
      const venue = match.venueCourt?.venue?.name || '';
      const group = venueGroup(venue);
      const isBye = String(match.team1Id) === '1' || String(match.team2Id) === '1' || [match.team1?.name,match.team2?.name].some(n=>/^bye$/i.test(String(n).trim()));
      if (isBye) { byes++; continue; }
      const hasTimezone = typeof match.startTime === 'string' && /(?:Z|[+-]\d{2}:?\d{2})$/i.test(match.startTime);
      const start = new Date(match.startTime);
      const validTime = hasTimezone && Number.isFinite(start.getTime());
      const matchDate = validTime ? dateFormat.format(start) : null;
      if (matchDate) dates.add(matchDate);
      if (matchDate === date) onDate++;
      if (String(match.id) === '930873') baseline = {id:match.id,venue,pitch:match.venueCourt?.name,date:matchDate,time:validTime?timeFormat.format(start):null};
      if (!group) continue;
      venueCounts[venue] = (venueCounts[venue] || 0) + 1;
      if (!validTime) throw new Error(`Match ${match.id} at ${venue} has no unambiguous start time; date coverage is uncertain.`);
      if (matchDate !== date) continue;
      if (!match.id || !match.team1?.name || !match.team2?.name) throw new Error('A matching fixture is missing its ID or team names.');
      const row = {
        id:String(match.id), date, time:timeFormat.format(start), venueGroup:group, venue,
        pitch:match.venueCourt?.name || '', competition:competition.name,
        division:round.division?.name || match.divisionName || '', home:match.team1.name, away:match.team2.name,
        round:round.name || '', status:match.matchStatus || '', resultStatus:match.resultStatus || '',
        url:`https://registration.squadi.com/matchSummary?matchId=${encodeURIComponent(match.id)}&competitionId=${competitionId}&competitionUniqueKey=${competition.key}`,
      };
      if (seen.has(row.id)) {
        if (JSON.stringify(seen.get(row.id)) !== JSON.stringify(row)) throw new Error(`Conflicting copies of match ${row.id}.`);
        duplicateMatches++; continue;
      }
      seen.set(row.id,row); rows.push(row);
    }
  }
  const sortedDates = [...dates].sort();
  return {rows, coverage:{competition:competition.name, competitionId, sourceUrl:fixturePage(competition.key),
    rounds:data.rounds.length, divisions:divisions.size, scanned, onDate, found:rows.length,
    hiddenRounds, byes, duplicateMatches, venueCounts, firstDate:sortedDates[0] || null,
    lastDate:sortedDates.at(-1) || null, suppliedExample:baseline}};
}
export function sortFixtures(rows) {
  return rows.sort((a,b)=>a.venueGroup.localeCompare(b.venueGroup)||a.time.localeCompare(b.time)||a.pitch.localeCompare(b.pitch,undefined,{numeric:true})||a.home.localeCompare(b.home));
}
export const COLUMNS = ['date','time','venue','pitch','competition','division','home','away','round','status','url'];
export function csvCell(value) {
  const s = String(value ?? '');
  return '"'+(/^[\s]*[=+@-]/.test(s)?"'"+s:s).replaceAll('"','""')+'"';
}
export function toCsv(rows) {
  return '\ufeff'+[COLUMNS,...rows.map(r=>COLUMNS.map(c=>r[c]))].map(r=>r.map(csvCell).join(',')).join('\r\n')+'\r\n';
}
export function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
export function toMarkdown(report) {
  const esc = v => String(v ?? '').replaceAll('|','\\|').replace(/[\r\n]/g,' ');
  const lines = [`# Morgan Park and Alfred Skeet — ${report.date}`, '', `**${report.fixtures.length} published fixtures. All times are Perth time.**`, '', `Checked: ${report.retrievedAt}`, '', 'Coverage is limited to the three supplied competitions. Hidden rounds and byes are excluded. Check Squadi links for changes and cancellations.', '', '| Competition | Divisions | Fixtures checked | Fixtures on selected date (all venues) | Matching games | Hidden rounds |', '|---|---:|---:|---:|---:|---:|'];
  for (const c of report.coverage) lines.push(`| ${esc(c.competition)} | ${c.divisions} | ${c.scanned} | ${c.onDate} | ${c.found} | ${c.hiddenRounds} |`);
  for (const venue of ['Morgan Park','Alfred Skeet']) {
    const rows = report.fixtures.filter(r=>r.venueGroup===venue);
    lines.push('',`## ${venue} — ${rows.length} games`, '');
    if (!rows.length) {lines.push('No matching published fixtures were returned.');continue;}
    lines.push('| Time | Pitch | Competition / Division | Home | Away | Status | Fixture |','|---|---|---|---|---|---|---|');
    for(const r of rows) lines.push(`| ${esc(r.time)} | ${esc(r.pitch)} | ${esc(r.competition)} / ${esc(r.division)} | ${esc(r.home)} | ${esc(r.away)} | ${esc(r.status)} | [Squadi](${r.url}) |`);
  }
  return lines.join('\n')+'\n';
}
export function toHtml(report) {
  const e=escapeHtml;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Venue fixtures ${report.date}</title><style>body{font:16px system-ui;margin:2rem;color:#172b37}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:.6rem;border-bottom:1px solid #ddd}th{background:#eef4f7}small{color:#526471}.scroll{overflow-x:auto}@media print{body{font-size:10px;margin:0}th,td{padding:.3rem}}</style></head><body><h1>Morgan Park &amp; Alfred Skeet</h1><p>${report.date} · Perth time · ${report.fixtures.length} published games</p><p><small>Checked ${e(report.retrievedAt)}. Covers the three supplied competitions; hidden rounds and byes are excluded. Check match links for changes and cancellations.</small></p><p>${report.coverage.map(c=>e(c.competition)+': '+c.scanned+' checked, '+c.found+' matching games, '+c.hiddenRounds+' hidden rounds').join('<br>')}</p>${report.fixtures.length?'':'<p>No matching published fixtures returned.</p>'}<div class="scroll"><table><thead><tr>${COLUMNS.map(c=>'<th>'+e(c)+'</th>').join('')}</tr></thead><tbody>${report.fixtures.map(r=>'<tr>'+COLUMNS.map(c=>'<td>'+(c==='url'?'<a href="'+e(r[c])+'">Squadi</a>':e(r[c]))+'</td>').join('')+'</tr>').join('')}</tbody></table></div></body></html>`;
}

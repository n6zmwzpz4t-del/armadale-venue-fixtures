import { chromium } from 'playwright';
import {extractClub} from './club-core.mjs';
import { writeFile, appendFile, mkdir, rename, rm } from 'node:fs/promises';
import { COMPETITIONS, DEFAULT_DATE, TIMEZONE, validateDate, fixturePage, allDivisionResponse, extractFixtures, sortFixtures, toCsv, toMarkdown, toHtml } from './fixture-core.mjs';

const date = validateDate(process.argv[2] || DEFAULT_DATE);
const output = `reports/${date}`;
let browser;
try {
  browser = await chromium.launch({headless:process.env.HEADED !== '1'});
  const fixtures = [], coverage = [], clubFixtures = [], clubCoverage = [];
  for (const competition of COMPETITIONS) {
    console.log(`Loading ${competition.name}…`);
    // A fresh context prevents a previous competition selection in local storage being reused.
    const context = await browser.newContext({timezoneId:TIMEZONE, locale:'en-AU'});
    const page = await context.newPage();
    const requests = [];
    page.on('response', r => {
      const u = new URL(r.url());
      if(u.hostname === 'api.squadi.com') requests.push({path:u.pathname,status:r.status()});
    });
    let timer;
    try {
      let accept, reject;
      const pending = new Promise((resolve,fail)=>{accept=resolve;reject=fail;});
      timer=setTimeout(()=>reject(new Error('Timed out waiting for all-division fixtures.')),150000);
      pending.catch(()=>{});
      // Miniroos is larger than Chromium's inspector response-body cache. Read the
      // normal public page request through Playwright's routing API instead.
      // The browser supplies its normal request; no credentials or endpoints are invented.
      await page.route('https://api.squadi.com/**/round/matches*', async route => {
        if(route.request().method()!=='GET' || !allDivisionResponse(route.request().url())) {
          await route.continue(); return;
        }
        try {
          const response=await route.fetch({timeout:120000});
          if(!response.ok()) throw new Error(`Fixture request returned HTTP ${response.status()}.`);
          const body=await response.json();
          await route.fulfill({response});
          accept({body,url:route.request().url()});
        } catch(error) {
          reject(error);
          await route.abort().catch(()=>{});
        }
      });
      await page.goto(fixturePage(competition.key),{waitUntil:'domcontentloaded',timeout:60000});
      const response = await pending;
      const {rows,coverage:checked} = extractFixtures(response.body,competition,new URL(response.url).searchParams.get('competitionId'),date);
      fixtures.push(...rows); coverage.push(checked);
      const club=extractClub(response.body,competition,new URL(response.url).searchParams.get('competitionId'));
      clubFixtures.push(...club.rows);clubCoverage.push(club.coverage);
      console.log(JSON.stringify({clubCoverage:club.coverage}));
      console.log(JSON.stringify({coverage:checked}));
    } catch(error) {
      console.error(JSON.stringify({competition:competition.name,requests}));
      throw new Error(`${competition.name}: ${error.message}`);
    } finally { clearTimeout(timer); await context.close(); }
  }
  const report = {date,timezone:TIMEZONE,retrievedAt:new Date().toISOString(),coverage,fixtures:sortFixtures(fixtures)};
  const clubReport={season:2026,timezone:TIMEZONE,retrievedAt:report.retrievedAt,coverage:clubCoverage,fixtures:clubFixtures.sort((a,b)=>(a.startTime||'9999').localeCompare(b.startTime||'9999'))};
  const staging = `reports/.staging-${Date.now()}`;
  await mkdir(staging,{recursive:true});
  await writeFile(`${staging}/fixtures.csv`,toCsv(report.fixtures));
  await writeFile(`${staging}/fixtures.json`,JSON.stringify(report,null,2)+'\n');
  await writeFile(`${staging}/fixtures.html`,toHtml(report));
  await writeFile(`${staging}/README.md`,toMarkdown(report));
  await rm(output,{recursive:true,force:true});
  await rename(staging,output);
  await writeFile('reports/club.json.tmp',JSON.stringify(clubReport,null,2)+'\n');
  await rename('reports/club.json.tmp','reports/club.json');
  console.log(JSON.stringify({clubSummary:{fixtures:clubReport.fixtures.length,teams:clubCoverage.reduce((n,c)=>n+c.clubTeams.length,0),samples:clubReport.fixtures.filter(r=>r.outcome.kind==='completed').slice(-3)}}));
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,toMarkdown(report));
  // Only the selected public fixtures are logged, never request headers or account/roster data.
  console.log(JSON.stringify({report}));
  console.log(`Saved ${fixtures.length} published fixtures to ${output}.`);
} catch(error) {
  console.error(`FAILED: ${error.message} A failed fetch does not mean there are no games. Any existing report is from a previous successful run.`);
  process.exitCode = 1;
} finally { await browser?.close(); }

import { chromium } from 'playwright';
import { writeFile, appendFile, mkdir, rename, rm } from 'node:fs/promises';
import { COMPETITIONS, DEFAULT_DATE, TIMEZONE, validateDate, fixturePage, allDivisionResponse, extractFixtures, sortFixtures, toCsv, toMarkdown, toHtml } from './fixture-core.mjs';

const date = validateDate(process.argv[2] || DEFAULT_DATE);
const output = `reports/${date}`;
let browser;
try {
  browser = await chromium.launch({headless:process.env.HEADED !== '1'});
  const fixtures = [], coverage = [];
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
    try {
      const pending = page.waitForResponse(r => r.request().method()==='GET' && allDivisionResponse(r.url()),{timeout:120000});
      pending.catch(()=>{});
      await page.goto(fixturePage(competition.key),{waitUntil:'domcontentloaded',timeout:60000});
      const response = await pending;
      if (!response.ok()) throw new Error(`Fixture request returned HTTP ${response.status()}.`);
      const {rows,coverage:checked} = extractFixtures(await response.json(),competition,new URL(response.url()).searchParams.get('competitionId'),date);
      fixtures.push(...rows); coverage.push(checked);
      console.log(JSON.stringify({coverage:checked}));
    } catch(error) {
      console.error(JSON.stringify({competition:competition.name,requests}));
      throw new Error(`${competition.name}: ${error.message}`);
    } finally { await context.close(); }
  }
  const report = {date,timezone:TIMEZONE,retrievedAt:new Date().toISOString(),coverage,fixtures:sortFixtures(fixtures)};
  const staging = `reports/.staging-${Date.now()}`;
  await mkdir(staging,{recursive:true});
  await writeFile(`${staging}/fixtures.csv`,toCsv(report.fixtures));
  await writeFile(`${staging}/fixtures.json`,JSON.stringify(report,null,2)+'\n');
  await writeFile(`${staging}/fixtures.html`,toHtml(report));
  await writeFile(`${staging}/README.md`,toMarkdown(report));
  await rm(output,{recursive:true,force:true});
  await rename(staging,output);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,toMarkdown(report));
  // Only the selected public fixtures are logged, never request headers or account/roster data.
  console.log(JSON.stringify({report}));
  console.log(`Saved ${fixtures.length} published fixtures to ${output}.`);
} catch(error) {
  console.error(`FAILED: ${error.message} A failed fetch does not mean there are no games. Any existing report is from a previous successful run.`);
  process.exitCode = 1;
} finally { await browser?.close(); }

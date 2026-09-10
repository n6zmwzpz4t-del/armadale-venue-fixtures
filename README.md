# Armadale venue fixtures

Collects published Squadi fixtures for **Morgan Park** and **Alfred Skeet**, grouped by venue and sorted by Perth kick-off time.

Competitions: Junior Community League, Junior Development League and Miniroos. All divisions and all teams are included in each competition. The initial report date is **Sunday 13 September 2026**.

## Webpage

The mobile-friendly webpage source is in `website/`. It loads the latest successful report from this repository, groups games under Morgan Park and Alfred Skeet, and sorts each venue by Perth kick-off time. The page shows the date and checked time; it does not claim to be a live feed from Squadi.

## Get the fixtures

1. Open **Actions → Collect venue fixtures → Run workflow**.
2. Enter the fixture date as `YYYY-MM-DD` and run it.
3. Open the completed run to see the venue lists in its summary. Download the `venue-fixtures-...` artifact for CSV, JSON, Markdown and printable HTML.
4. Checked results are also saved under `reports/YYYY-MM-DD/`. `reports/latest.json` contains the latest successful report.

The first code push runs the scraper automatically. There is no recurring schedule. Refresh before relying on fixture times, venues or cancellations.

## How coverage is checked

The scraper opens the normal public fixture page in Chromium and reads its `/round/matches` response for all divisions. Each competition uses a separate browser context to avoid reusing a previous selection. The application code inspected on 10 September 2026 uses one all-rounds response rather than visible-row pagination.

Only match-level schedule information is retained. Hidden rounds and byes are excluded. Reports include competition coverage, divisions, scanned matches, matching venue names, selected-date counts and retrieval time. Dates are converted to `Australia/Perth` before filtering. Duplicate match IDs are removed; conflicting duplicates, malformed results, missing times at the selected venues and failed competitions cause an error, rather than a misleading empty list. Existing successful reports are retained if retrieval fails, so always check the date and checked time.

Match status is preserved as supplied by Squadi. Published cancelled or postponed games can still appear; follow the match link to confirm their current status. Coverage is limited to the three supplied competitions, not every competition in Squadi.

## Run locally

Requires Node.js 22 or newer.

```bash
npm ci
npx playwright install chromium
npm test
npm start -- 2026-09-13
```

Use `HEADED=1 npm start -- 2026-09-13` on macOS/Linux to see the browser. No Squadi account, password, API key or OpenAI credit is required. If Squadi refuses access, the run stops; it does not attempt to bypass access controls.

## Sources

- [Junior Community League](https://registration.squadi.com/livescoreSeasonFixture?organisationKey=27a1f3ab-90c1-4412-853f-d85c9b27967c&yearId=8&competitionUniqueKey=fafe940b-0a16-474a-9ac8-9dbf00035b0c&divisionId=All&teamId=-1)
- [Junior Development League](https://registration.squadi.com/livescoreSeasonFixture?organisationKey=27a1f3ab-90c1-4412-853f-d85c9b27967c&yearId=8&competitionUniqueKey=2929eee2-4f37-46f3-a6d6-123acee5443f&divisionId=All)
- [Miniroos](https://registration.squadi.com/livescoreSeasonFixture?organisationKey=27a1f3ab-90c1-4412-853f-d85c9b27967c&yearId=8&competitionUniqueKey=018d2b7c-6797-4cd1-a2c9-8aa2784cb832&divisionId=All)

The competition keys and `yearId=8` are from the supplied 2026 links. Update them for a different season. The public app does not promise a stable API, so future changes may require a scraper update.

## Initial verification

The [live investigation](INVESTIGATION.md) records the successful end-to-end run and coverage checks. On 10 September the three supplied competitions returned **16 games for Sunday 13 September: 11 at Morgan Park and 5 at Alfred Skeet**.

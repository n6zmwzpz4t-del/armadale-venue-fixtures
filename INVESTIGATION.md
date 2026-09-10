# Live verification — 10 September 2026

The scraper was run on GitHub Actions against all three supplied public Squadi pages for Sunday 13 September 2026. The successful run is [34437722198](https://github.com/n6zmwzpz4t-del/armadale-venue-fixtures/actions/runs/34437722198).

| Competition | Public divisions | Fixture records examined | Games on target date, all venues | Matching games |
|---|---:|---:|---:|---:|
| Junior Community League | 42 | 3,349 | 0 | 0 |
| Junior Development League | 27 | 2,414 | 128 | 5 |
| Miniroos | 125 | 10,154 | 529 | 11 |
| Total | 194 | 15,917 | 657 | 16 |

The examined-record totals include byes. No hidden rounds were returned. There were 11 matching games at Morgan Park and 5 at Alfred Skeet Reserve.

The supplied example, match 930873, was found in the Community League response at Morgan Park, Field 1, on 6 September 2026 at 09:15 Perth time. This verifies the venue field used by the filter against the user's example.

The first run fetched Community and Development League successfully, but Chromium evicted the large Miniroos response from its inspector cache before `response.json()` could read it. The revised scraper uses Playwright's documented `route.fetch()` and `route.fulfill()` to read the normal public page request without that inspector-cache limit. The next full GitHub run succeeded and wrote all reports. It does not use a guessed API token, scrape a login, or bypass an access restriction.

Perth midnight boundaries, venue-name variants, byes, hidden rounds, duplicate/conflicting match IDs, invalid dates, empty-versus-failed results, CSV escaping and HTML escaping are covered by the six passing tests.

The data is a checked snapshot, not proof that fixtures will remain unchanged. Run the workflow again to refresh it. Results are limited to the supplied competitions. Squadi's resultStatus `FINAL` is preserved only as source metadata; it is not interpreted as meaning an upcoming match has already been played.

One source detail to confirm with the club: Alfred Skeet lists both the U14 Division 2 JDL game and U8 Girls South game at 09:00 on Field 3. Different pitch layouts may explain that, but the report deliberately preserves Squadi's listed field rather than changing it.

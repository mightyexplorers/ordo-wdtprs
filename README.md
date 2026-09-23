# WDTPRS Ordo

A day-by-day index of Fr. John Zuhlsdorf's *What Does The Prayer Really Say?* commentary
([wdtprs.com](https://wdtprs.com)), arranged by both the 1962 calendar and the current
General Roman Calendar. Pick a date and see the commentary on that day's prayers.

Proof of concept. The site shows each prayer, Fr. Z's literal rendering, and a short excerpt,
and links every entry back to the full post on wdtprs.com.

## How it works

| Source | Used for |
| --- | --- |
| wdtprs.com WordPress REST API | Posts in the WDTPRS and PRAYERCAzT categories, plus prayer posts filed elsewhere (title search) |
| [1962ordo.today](https://1962ordo.today) `/get-liturgical-days/` | The 1962 calendar |
| [romcal](https://github.com/romcal/romcal) | The current calendar (USA), computed locally |

Posts are matched by the **liturgical day named in the title**, not by publication date.
For example, "28th Ordinary Sunday (N.O.)" maps to `28thSundayOfOrdinaryTime`, and
"XVII Sunday after Pentecost" and "17th Sunday after Pentecost" normalize to the same key.
See [scripts/lib/normalize.mjs](scripts/lib/normalize.mjs) and [scripts/lib/match.mjs](scripts/lib/match.mjs).

- Markers in the title ("Novus Ordo", "2002MR", "Vetus Ordo", "EF") or calendar-specific names
  ("after Pentecost", "Ordinary Time") decide which calendar a post belongs to. When a title
  fits both calendars, the post body breaks the tie.
- On weekdays without their own proper, the page also shows the preceding Sunday's commentary,
  because the Mass repeats that Sunday's collect.
- Posts on the same Latin prayer are linked across the two calendars.
- Reposts of the same commentary are grouped under the newest one.

`data/report.json` lists every matched and unmatched title; use it to tune the matcher.

## Commands

```sh
npm install
npm run fetch     # download posts + 1962 calendar into data/raw/ (gitignored, ~2 min)
npm run data      # data/raw -> src/data/*.json + data/report.json
npm run dev       # http://localhost:4321/ordo-wdtprs/
npm run build     # static site + Pagefind search index into dist/
```

### Docker

```sh
docker compose up --build                     # http://localhost:8080/ordo-wdtprs/
docker compose --profile tools run --rm refresh   # refresh src/data from the sources
```

## Deploying

`.github/workflows/deploy.yml` builds and deploys to GitHub Pages on every push to `main`
and nightly, to pick up new posts. If a source is unreachable, it builds from the committed
`src/data`. To serve under a different path, set `BASE_PATH` and `SITE_URL`.

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
| [Divinum Officium](https://github.com/DivinumOfficium/divinum-officium) (MIT), run locally in Docker | The 1962 calendar, "Rubrics 1960 - 2020 USA" variant, plus the plain 1962 calendar for days the 2020 additions replace (`data/do/`) |
| [romcal](https://github.com/romcal/romcal) | The current calendar (USA) and its colors, computed locally |

Posts are matched by the **liturgical day named in the title**, not by publication date.
For example, "28th Ordinary Sunday (N.O.)" maps to `28thSundayOfOrdinaryTime`, and
"XVII Sunday after Pentecost" and "17th Sunday after Pentecost" normalize to the same key.
See [scripts/lib/normalize.mjs](scripts/lib/normalize.mjs) and [scripts/lib/match.mjs](scripts/lib/match.mjs).

- Markers in the title ("Novus Ordo", "2002MR", "Vetus Ordo", "EF") or calendar-specific names
  ("after Pentecost", "Ordinary Time") decide which calendar a post belongs to. When a title
  fits both calendars, the post body breaks the tie.
- On weekdays without their own proper, the page also shows the preceding Sunday's commentary,
  because the Mass repeats that Sunday's collect.
- Where a 2020 USA addition replaces the plain 1962 celebration, posts on the replaced day and on
  the day's commemorations still appear, labelled. Day keys are Divinum Officium office files
  (`vo:Tempora/Pent17-0`, `vo:Sancti/09-21`), so they don't change from year to year.
- Posts on the same Latin prayer are linked across the two calendars.
- Reposts of the same commentary are grouped under the newest one.

`data/report.json` lists every matched and unmatched title; use it to tune the matcher.

## Commands

```sh
npm install
npm run calendar  # once a year: export the 1962 calendar from a local Divinum Officium container
                  #   into data/do/ (committed); `npm run calendar -- 2017 2028` for a range
npm run fetch     # download posts into data/raw/ (gitignored, ~3 min)
npm run data      # data/raw -> src/data/*.json + data/report.json
npm run dev       # http://localhost:4321/ordo-wdtprs/
npm run build     # static site + Pagefind search index into dist/
```

### Docker

```sh
docker compose up --build                     # http://localhost:8080/ordo-wdtprs/
docker compose --profile tools run --rm refresh   # refresh posts and src/data
```

## Deploying

`.github/workflows/deploy.yml` builds and deploys to GitHub Pages on every push to `main`
and nightly, to pick up new posts. If a source is unreachable, it builds from the committed
`src/data`. To serve under a different path, set `BASE_PATH` and `SITE_URL`.

## WordPress plugin (for wdtprs.com)

`wp-plugin/wdtprs-ordo/` puts the Ordo inside the WordPress site itself. It installs from
**Plugins → Add New → Upload** (no server access needed) and shows nothing until switched on.

```sh
npm run data && npm run plugin    # writes wp-plugin/wdtprs-ordo/data/ and dist-plugin/wdtprs-ordo-<version>.zip
```

- **Liturgical Day** taxonomy on posts; **Settings → WDTPRS Ordo → Tag posts** imports the
  matcher's results in batches (sets terms only; posts already tagged by hand are skipped).
- An **Ordo page** with `[wdtprs_ordo]`: `/ordo/2026-10-08/` (day) and `/ordo/2026-10/` (month).
- **Today in the Liturgy** widget; it carries ±7 days in the page and picks the reader's
  date in JavaScript, so page-cached copies stay correct with no extra requests.
- Optional box at the end of tagged posts ("next on …"), off by default.
- Calendar data ships as PHP arrays (`data/`), so lookups need no queries or outside calls.
  Each year: `npm run calendar`, `npm run data`, `npm run plugin`, then upload the new zip.

Local test site with the real posts (Docker): `cd wp-plugin/dev && docker compose up -d && ./setup.sh`
→ http://localhost:8085 (admin / admin).

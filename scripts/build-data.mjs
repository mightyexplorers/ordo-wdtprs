// data/raw/* -> src/data/*.json consumed by the Astro site, plus data/report.json
// listing how every post was (or wasn't) matched, for tuning.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { buildNovusOrdo, novusOrdoDictionary, build1962, voDictionary, iso } from './lib/calendars.mjs';
import { compileDictionary, matchTitle, prayerPart } from './lib/match.mjs';
import { extract, incipit } from './lib/extract.mjs';

const decode = (s) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');

const rawPosts = JSON.parse(await readFile('data/raw/posts.json', 'utf8'));
const rawOrdo = JSON.parse(await readFile('data/raw/ordo1962.json', 'utf8'));
let colors1962 = {};
try { colors1962 = JSON.parse(await readFile('data/colors1962.json', 'utf8')); } catch {}
const catNames = new Map(rawPosts.categories.map((c) => [c.id, decode(c.name)]));

// ---- calendars ----
const feedDates = rawOrdo.days.map((d) => d.date).sort();
const firstYear = Number(feedDates[0].slice(0, 4));
const lastYear = Math.max(Number(feedDates.at(-1).slice(0, 4)), new Date().getUTCFullYear() + 1);
const startDate = `${feedDates[0].slice(0, 4)}-${feedDates[0].slice(4, 6)}-${feedDates[0].slice(6, 8)}`;

const noDays = await buildNovusOrdo(firstYear, lastYear);
const voDays = build1962(rawOrdo.days, colors1962);
const dicts = {
  no: compileDictionary(await novusOrdoDictionary(2005, lastYear)),
  vo: compileDictionary(voDictionary(rawOrdo.days)),
};

// ---- posts ----
const INCIDENTAL = /\bPOLL\b|\bPOLLS\b|ASK FATHER|QUAERITUR|Noveritis|Let y.all know|Stations of the Cross|\bnews\b|Oldie posts|Beauty Break|Spiritual Bouquet/i;
const posts = [];
const report = { matched: [], unmatched: [] };
for (const p of rawPosts.posts) {
  const title = decode(p.title.rendered).replace(/\s+/g, ' ').trim();
  const { latin, literal, excerpt, bodyText } = extract(p.content.rendered);
  // Polls, Q&A and news posts can name a feast without commenting on its prayers.
  const incidental = INCIDENTAL.test(title);
  const matches = incidental ? {} : matchTitle(title, bodyText, dicts, { date: p.date.slice(0, 10), categories: p.categories });
  const post = {
    id: p.id,
    date: p.date.slice(0, 10),
    title,
    link: p.link,
    categories: p.categories.map((c) => catNames.get(c)).filter((c) => c && c !== 'Uncategorized'),
    part: prayerPart(title),
    latin,
    literal,
    excerpt,
    incipit: incipit(latin),
    matches,
  };
  posts.push(post);
  const line = `${post.date} ${title}`;
  if (Object.keys(matches).length) {
    report.matched.push(`${line}  =>  ${Object.entries(matches).map(([f, m]) => `${f}:${m.name} (${m.score.toFixed(2)})`).join(' | ')}`);
  } else if (latin) {
    report.unmatched.push(line);
  }
}
posts.sort((a, b) => b.date.localeCompare(a.date));

// ---- indexes ----
const byKey = {};
const byIncipit = {};
for (const p of posts) {
  for (const m of Object.values(p.matches)) (byKey[m.key] ||= []).push(p.id);
  if (p.incipit) (byIncipit[p.incipit] ||= []).push(p.id);
}
for (const k of Object.keys(byIncipit)) if (byIncipit[k].length < 2) delete byIncipit[k];

// ---- days ----
const days = {};
let noHits = 0, voHits = 0, total = 0;
for (let d = new Date(`${startDate}T00:00:00Z`); d.getUTCFullYear() <= lastYear; d.setUTCDate(d.getUTCDate() + 1)) {
  const date = iso(d);
  const no = noDays.get(date), vo = voDays.get(date);
  days[date] = { no, vo };
  total++;
  if (no && [...no.keys, no.weekKey].some((k) => byKey[k])) noHits++;
  if (vo && [...vo.keys, vo.weekKey].some((k) => byKey[k])) voHits++;
}

await mkdir('src/data', { recursive: true });
await writeFile('src/data/posts.json', JSON.stringify(posts));
await writeFile('src/data/days.json', JSON.stringify(days));
await writeFile('src/data/index.json', JSON.stringify({ byKey, byIncipit, builtAt: new Date().toISOString() }));

const stats = {
  posts: posts.length,
  matchedPosts: report.matched.length,
  unmatchedWithLatin: report.unmatched.length,
  days: total,
  daysWithNovusOrdoPost: noHits,
  daysWith1962Post: voHits,
};
await writeFile('data/report.json', JSON.stringify({ stats, ...report }, null, 1));
console.log(stats);

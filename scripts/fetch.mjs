// Downloads source data into data/raw/ (gitignored — full post bodies are only used
// locally to extract excerpts and prayer text, never published).
//   - every prayer-related post from wdtprs.com via the WordPress REST API
//   - the 1962 liturgical calendar feed from 1962ordo.today
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const UA = 'ordoWDTPRS/0.1 (liturgical calendar index; +https://github.com/mightyexplorers/ordo-wdtprs)';
const WP = 'https://wdtprs.com/wp-json/wp/v2';
const FIELDS = 'id,date,modified,link,title,content,categories';

// 13 = WDTPRS, 31 = PRAYERCAzT. Search terms catch prayer posts filed elsewhere:
// the series names are searched in full text, generic words ("Collect") in titles only,
// since full-text search on those matches most of the blog.
const CATEGORIES = [13, 31];
const SEARCHES = [
  ['WDTPRS', 'full'], ['What Does The Prayer Really Say', 'full'], ['PRAYERCAzT', 'full'],
  ['Collect', 'title'], ['Super oblata', 'title'], ['Post communion', 'title'],
];
const TITLE_FILTER = /wdtprs|what does the (\(\w+\) )?prayer|prayercazt|collect|super oblata|secret|post ?communion|hymn|preface/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, tries = 4) {
  for (let i = 1; ; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (res.ok) return { json: await res.json(), totalPages: Number(res.headers.get('x-wp-totalpages') || 1) };
    if (res.status === 400) return { json: [], totalPages: 0 }; // WP returns 400 past the last page
    if (i >= tries) throw new Error(`${res.status} ${url}`);
    await sleep(1000 * i);
  }
}

async function paged(params) {
  const out = [];
  for (let page = 1, total = 1; page <= total; page++) {
    const { json, totalPages } = await getJson(`${WP}/posts?${params}&per_page=100&page=${page}&_fields=${FIELDS}`);
    total = totalPages;
    out.push(...json);
    await sleep(300);
  }
  return out;
}

async function fetchPosts() {
  const byId = new Map();
  const byCat = await paged(`categories=${CATEGORIES.join(',')}`);
  for (const p of byCat) byId.set(p.id, p);
  console.log(`categories ${CATEGORIES}: ${byCat.length} posts`);

  for (const [q, scope] of SEARCHES) {
    const columns = scope === 'title' ? '&search_columns=post_title' : '';
    const hits = (await paged(`search=${encodeURIComponent(q)}${columns}`)).filter((p) => TITLE_FILTER.test(p.title.rendered));
    let added = 0;
    for (const p of hits) if (!byId.has(p.id)) { byId.set(p.id, p); added++; }
    console.log(`search "${q}": ${hits.length} title hits, ${added} new`);
  }

  const { json: cats } = await getJson(`${WP}/categories?per_page=100&orderby=count&order=desc&_fields=id,name,slug`);
  return { fetchedAt: new Date().toISOString(), categories: cats, posts: [...byId.values()] };
}

async function fetch1962() {
  const { json } = await getJson('https://1962ordo.today/get-liturgical-days/');
  return { fetchedAt: new Date().toISOString(), days: json.liturgicalDays };
}

// The 1962 feed has no liturgical color; each day's page does ("II class<br>Violet").
// Results are cached in data/colors1962.json (committed) so only new days are fetched.
const COLORS_FILE = 'data/colors1962.json';
const COLOR_DELAY = 1500;
const CLASS_COLOR_RE = /class\s*(?:<br\s*\/?>|\s)\s*(violet|purple|white|red|green|rose|black|gold)\b/i;
const COLOR_RE = /\b(violet|purple|white|red|green|rose|black|gold)\b/i;

// One request at a time with a pause; back off on 429 and give up for this run after
// repeated refusals (the rest are picked up on later runs).
async function fetchColors(days) {
  let cache = {};
  try { cache = JSON.parse(await readFile(COLORS_FILE, 'utf8')); } catch {}
  const todo = days.filter((d) => cache[d.date]?.link !== d.permalink);
  console.log(`1962 colors: ${todo.length} day pages to fetch`);
  const save = () => writeFile(COLORS_FILE, JSON.stringify(
    Object.fromEntries(Object.entries(cache).sort(([a], [b]) => a.localeCompare(b)))));
  let done = 0, refusals = 0;
  for (const d of todo) {
    const res = await fetch(d.permalink, { headers: { 'User-Agent': UA } }).catch(() => null);
    if (res?.status === 429) {
      if (++refusals >= 3) { console.log(`  rate-limited; stopping after ${done} (rest next run)`); break; }
      await sleep(120_000 * refusals);
      continue;
    }
    if (!res?.ok) { await sleep(COLOR_DELAY); continue; }
    refusals = 0;
    const html = await res.text();
    // The block under the day's <h2> name has a line like "II class<br />Violet"
    // (sometimes after a subtitle such as "Protomartyr").
    const block = html.match(/<h2>[^<]*<\/h2>([\s\S]*?)<\/div>/)?.[1] || '';
    const color = (block.match(CLASS_COLOR_RE) || block.match(COLOR_RE))?.[1]?.toLowerCase();
    cache[d.date] = { link: d.permalink, color: color === 'violet' ? 'purple' : color };
    if (++done % 200 === 0) { console.log(`  ${done} fetched`); await save(); }
    await sleep(COLOR_DELAY);
  }
  await save();
  const withColor = Object.values(cache).filter((c) => c.color).length;
  console.log(`1962 colors: ${withColor} of ${days.length} days have a color`);
}

await mkdir('data/raw', { recursive: true });
const [posts, ordo] = await Promise.all([fetchPosts(), fetch1962()]);
await writeFile('data/raw/posts.json', JSON.stringify(posts));
await writeFile('data/raw/ordo1962.json', JSON.stringify(ordo));
console.log(`saved ${posts.posts.length} posts, ${ordo.days.length} 1962 days`);
await fetchColors(ordo.days);

// Downloads source data into data/raw/ (gitignored — full post bodies are only used
// locally to extract excerpts and prayer text, never published).
//   - every prayer-related post from wdtprs.com via the WordPress REST API
//   - the 1962 liturgical calendar feed from 1962ordo.today
import { mkdir, writeFile } from 'node:fs/promises';

const UA = 'ordoWDTPRS/0.1 (liturgical calendar index; +https://github.com/mightyexplorers/ordo-wdtprs)';
const WP = 'https://wdtprs.com/wp-json/wp/v2';
const FIELDS = 'id,date,modified,link,title,content,categories';

// 13 = WDTPRS, 31 = PRAYERCAzT. Search terms catch prayer posts filed elsewhere.
const CATEGORIES = [13, 31];
const SEARCHES = ['WDTPRS', 'What Does The Prayer Really Say', 'PRAYERCAzT', 'Collect', 'Super oblata', 'Post communion'];
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

  for (const q of SEARCHES) {
    const hits = (await paged(`search=${encodeURIComponent(q)}&search_columns=post_title`)).filter((p) => TITLE_FILTER.test(p.title.rendered));
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

await mkdir('data/raw', { recursive: true });
const [posts, ordo] = await Promise.all([fetchPosts(), fetch1962()]);
await writeFile('data/raw/posts.json', JSON.stringify(posts));
await writeFile('data/raw/ordo1962.json', JSON.stringify(ordo));
console.log(`saved ${posts.posts.length} posts, ${ordo.days.length} 1962 days`);

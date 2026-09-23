import posts from '../data/posts.json';
import days from '../data/days.json';
import index from '../data/index.json';

export const BASE = import.meta.env.BASE_URL.replace(/\/?$/, '/');
export const url = (path = '') => BASE + path.replace(/^\//, '');

export const postsById = new Map(posts.map((p) => [p.id, p]));
export const allPosts = posts;
export const allDays = days;
export const dates = Object.keys(days).sort();
export const builtAt = index.builtAt;

const forKey = (key) => (key && index.byKey[key] ? index.byKey[key].map((id) => postsById.get(id)) : []);

// Posts for one calendar's side of a day: its own proper(s), the preceding Sunday
// (ferias reuse the Sunday collect), and posts discussing the same Latin prayer.
export function postsForDay(entry) {
  if (!entry) return { own: [], week: [], same: [] };
  const own = [...new Map(entry.keys.flatMap(forKey).map((p) => [p.id, p])).values()];
  const seen = new Set(own.map((p) => p.id));
  const week = forKey(entry.weekKey).filter((p) => !seen.has(p.id));
  week.forEach((p) => seen.add(p.id));
  const same = [];
  for (const p of [...own, ...week]) {
    for (const id of index.byIncipit[p.incipit] || []) {
      if (!seen.has(id)) { seen.add(id); same.push(postsById.get(id)); }
    }
  }
  return { own: collapse(own), week: collapse(week), same: collapse(same) };
}

// Fr. Z reposts his commentary most years; show the newest copy of each prayer
// with the older ones listed under it.
function collapse(list) {
  const groups = new Map();
  for (const p of [...list].sort((a, b) => b.date.localeCompare(a.date))) {
    const k = `${p.part}|${p.incipit || p.id}`;
    if (groups.has(k)) groups.get(k).reposts.push(p);
    else groups.set(k, { ...p, reposts: [] });
  }
  return [...groups.values()];
}

export function samePrayer(post) {
  return (index.byIncipit[post.incipit] || []).filter((id) => id !== post.id).map((id) => postsById.get(id));
}

// Dates (within the built range) on which a liturgical key is celebrated.
const datesByKey = new Map();
for (const [date, d] of Object.entries(days)) {
  for (const side of ['no', 'vo']) for (const k of d[side]?.keys || []) {
    if (!datesByKey.has(k)) datesByKey.set(k, []);
    datesByKey.get(k).push(date);
  }
}
export const datesFor = (key) => datesByKey.get(key) || [];

export const usccbLink = (date) =>
  `https://bible.usccb.org/bible/readings/${date.slice(5, 7)}${date.slice(8, 10)}${date.slice(2, 4)}.cfm`;

const fmt = new Intl.DateTimeFormat('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
export const longDate = (date) => fmt.format(new Date(`${date}T00:00:00Z`));
const fmtShort = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
export const shortDate = (date) => fmtShort.format(new Date(`${date}T00:00:00Z`));

export const FORMS = {
  vo: { label: 'Vetus Ordo', sub: '1962 Missale Romanum' },
  no: { label: 'Novus Ordo', sub: '2002 Missale Romanum' },
};

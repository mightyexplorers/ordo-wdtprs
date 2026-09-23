// Builds per-date entries for both calendars.
//   Novus Ordo: computed with romcal (General Roman Calendar, USA).
//   1962:       the 1962ordo.today feed.
// Each day gets `keys` (its own propers, in priority order) and `weekKey` (the
// preceding Sunday, whose collect ferias reuse).
import romcalPkg from 'romcal';
import { slug, tokens, dayOfYear } from './normalize.mjs';

const romcal = romcalPkg.default || romcalPkg;

export const iso = (d) => d.toISOString().slice(0, 10);
export const addDays = (isoDate, n) => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
const dow = (isoDate) => new Date(`${isoDate}T00:00:00Z`).getUTCDay();
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// ---------- Novus Ordo ----------

// Extra names Fr. Z uses for romcal celebrations.
const NO_ALIASES = {
  divineMercySunday: ['2nd Sunday of Easter'],
  christmas: ['Nativity of the Lord'],
  christTheKing: ['Our Lord Jesus Christ, King of the Universe'],
  birthOfJohnTheBaptist: ['Nativity of Saint John the Baptist'],
  josephHusbandOfMary: ['Saint Joseph'],
  dedicationOfTheLateranBasilica: ['Dedication of Saint John Lateran'],
  holySaturday: ['Easter Vigil', 'Vigil of Easter'],
  palmSunday: ['Palm Sunday of the Passion of the Lord'],
};
const SEASON_KEY = { Advent: 'Advent', Lent: 'Lent', Easter: 'Easter' };
const ordinal = (n) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

// romcal lists only the winning celebration, so a memorial hides the Advent/Lent/Easter
// weekday whose prayers still apply; 17–24 December have their own propers.
function seasonalWeekdayKey(date, sundayKey) {
  const [, , m, d] = date.match(/^(\d{4})-(\d\d)-(\d\d)$/);
  if (m === '12' && Number(d) >= 17 && Number(d) <= 24) return { key: `no:december${Number(d)}`, name: `${Number(d)} December` };
  const k = sundayKey === 'no:divineMercySunday' ? 'no:2ndSundayOfEaster' : sundayKey;
  const hit = k?.match(/^no:(\d+)(?:st|nd|rd|th)SundayOf(Advent|Lent|Easter)$/);
  if (!hit) return null;
  const day = WEEKDAYS[dow(date)];
  return {
    key: `no:${day}OfThe${ordinal(Number(hit[1]))}WeekOf${SEASON_KEY[hit[2]]}`,
    name: `${day[0].toUpperCase()}${day.slice(1)} of the ${ordinal(Number(hit[1]))} week of ${hit[2]}`,
  };
}

async function romcalYears(fromYear, toYear) {
  const days = new Map();
  for (let y = fromYear; y <= toYear; y++) {
    for (const c of await romcal.calendarFor({ year: y, country: 'unitedStates', locale: 'en' })) {
      const date = c.moment.slice(0, 10);
      if (!days.has(date)) days.set(date, []);
      days.get(date).push({
        key: `no:${c.key}`,
        name: c.name,
        rank: c.type,
        season: c.data?.season?.value,
        color: c.data?.meta?.liturgicalColor?.key,
        cycle: c.data?.meta?.cycle?.value,
      });
    }
  }
  const sorted = [...days.keys()].sort();
  const out = new Map();
  for (const date of sorted) {
    const celebrations = days.get(date);
    const main = celebrations[0];
    const entry = { ...main, celebrations, keys: celebrations.map((c) => c.key) };
    if (dow(date) !== 0) {
      const sunday = days.get(addDays(date, -dow(date)))?.[0];
      if (sunday) {
        entry.weekKey = sunday.key;
        entry.weekName = sunday.name;
        const extra = main.rank !== 'SOLEMNITY' && main.rank !== 'FEAST' && seasonalWeekdayKey(date, sunday.key);
        if (extra && !entry.keys.includes(extra.key)) {
          entry.keys.push(extra.key);
          entry.extra = extra;
        }
      }
    }
    out.set(date, entry);
  }
  return out;
}

export async function buildNovusOrdo(fromYear, toYear) {
  return romcalYears(fromYear, toYear);
}

// key -> { names, doys } for title matching; doys are the days of the year the
// celebration fell on, used to break ties by the post's publication date.
export async function novusOrdoDictionary(fromYear, toYear) {
  const dict = new Map();
  const add = (key, names, date) => {
    if (!dict.has(key)) dict.set(key, { names: [], doys: new Set() });
    const e = dict.get(key);
    for (const n of names) if (!e.names.includes(n)) e.names.push(n);
    e.doys.add(dayOfYear(date));
  };
  for (const [date, entry] of await romcalYears(fromYear, toYear)) {
    for (const c of entry.celebrations) {
      const bare = c.key.slice(3);
      add(c.key, [...c.name.split('/').map((s) => s.trim()), ...(NO_ALIASES[bare] || [])], date);
    }
    if (entry.extra) add(entry.extra.key, [entry.extra.name, entry.extra.name.replace(/(\d+) December/, 'December $1')], date);
  }
  return dict;
}

// ---------- 1962 ----------

// Feed names carry extras like "(First Friday)" or "Feria / Stigmata of St. Francis".
function voNameParts(name) {
  return name.replace(/\([^)]*\)/g, ' ').split(/\s*[/–]\s*|,\s*(?=ember|rogation|external)/i).map((s) => s.trim()).filter(Boolean);
}
const GENERIC = new Set(['feria', 'advent', 'lent', 'easter', 'christmas', 'weekday', 'ferial', 'saturday', 'blessed', 'virgin', 'mary', 'saint', 'first', 'friday', 'thursday', 'rogations', '1', 'on']);
const isGeneric = (part) => tokens(part).every((t) => GENERIC.has(t));
export const voKey = (part) => `vo:${slug(part)}`;
const feedDate = (d) => `${d.date.slice(0, 4)}-${d.date.slice(4, 6)}-${d.date.slice(6, 8)}`;

export function build1962(feedDays) {
  const days = new Map();
  for (const d of feedDays) {
    const cls = d.nameML?.DE?.match(/\b(I{1,3}|IV)\.\s*Klasse/)?.[1];
    days.set(feedDate(d), {
      name: d.name.trim(),
      rank: cls ? `${cls} class` : undefined,
      link: d.permalink,
      keys: voNameParts(d.name).filter((p) => !isGeneric(p)).map(voKey),
    });
  }
  for (const [date, entry] of days) {
    if (dow(date) === 0) continue;
    const sunday = days.get(addDays(date, -dow(date)));
    if (sunday?.keys.length) {
      entry.weekKey = sunday.keys[0];
      entry.weekName = sunday.name;
    }
  }
  return days;
}

export function voDictionary(feedDays) {
  const dict = new Map();
  for (const d of feedDays) {
    for (const part of voNameParts(d.name)) {
      if (isGeneric(part)) continue;
      const k = voKey(part);
      if (!dict.has(k)) dict.set(k, { names: [], doys: new Set() });
      const e = dict.get(k);
      if (!e.names.includes(part)) e.names.push(part);
      e.doys.add(dayOfYear(feedDate(d)));
    }
  }
  return dict;
}

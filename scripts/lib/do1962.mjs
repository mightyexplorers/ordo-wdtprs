// The 1962 calendar from Divinum Officium exports (data/do/<year>-usa.json and -1960.json,
// written by scripts/calendar1962.mjs). The 2020 USA calendar is the one shown; where it
// replaces the plain 1962 celebration, that celebration is kept as an alternate so posts
// about it still appear. Keys are DO office files ("vo:Tempora/Pent17-0", "vo:Sancti/09-21"),
// which are stable from year to year.
import { readdir, readFile } from 'node:fs/promises';
import { dayOfYear } from './normalize.mjs';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ord = (n) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;
const dow = (date) => new Date(`${date}T00:00:00Z`).getUTCDay();
const weeksBetween = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 6048e5);

// "Tempora/Pent03-2Feria" and "Sancti/04-28r" are variants of "Tempora/Pent03-2" and "Sancti/04-28".
export function officeKey(file) {
  const t = file.match(/^(Tempora\/[A-Za-z]+\d+(?:-\d)?)/);
  return `vo:${t ? t[1] : file.replace(/r$/, '')}`;
}

// DO gives English titles for saints, but Sundays and ferias keep their Latin title.
const LATIN_LOOKING = /\b(Dominica|Feria|Sabbato|Die|Diei|Hebdomadam|Quattuor|infra|Festum|Sanct(?:ae|æ)|Sanctissim\w*)\b/;
const LATIN_ALIASES = [
  [/Famili(?:ae|æ)/, 'Holy Family'],
  [/Corporis Christi/, 'Corpus Christi'],
  [/Cordis (?:Domini Nostri )?Jesu/, 'Sacred Heart of Jesus'],
  [/Maternitatis/, 'Motherhood of the Blessed Virgin Mary'],
  [/Sanct(?:ae|æ) Mari(?:ae|æ) Sabbato/, 'Our Lady on Saturday'],
  [/Vigilia Pentecostes/, 'Vigil of Pentecost'],
  [/In Vigilia Ascensionis/, 'Vigil of the Ascension'],
  [/In Ascensione Domini/, 'Ascension of Our Lord'],
  [/Trinitatis/, 'Trinity Sunday'],
  [/Nominis Jesu/, 'Most Holy Name of Jesus'],
];
const EMBER_SEASON = { Adv: 'Advent', Quad: 'Lent', Pasc: 'Pentecost', Pent: 'September' };
const SEPTUAGESIMA = ['', 'Septuagesima', 'Sexagesima', 'Quinquagesima'];

function temporaName(day, pentecost) {
  const m = day.file.match(/^Tempora\/(Adv|Nat|Epi|Quadp|Quad|Pasc|Pent)(\d+)(?:-(\d))?/);
  if (!m) return null;
  const [, s, nStr] = m;
  const n = Number(nStr);
  const wd = WEEKDAYS[dow(day.date)];
  const month = Number(day.date.slice(5, 7));
  if (/Quattuor Temporum/i.test(day.latin)) return `Ember ${wd} of ${EMBER_SEASON[s]}`;
  // The Sundays after Epiphany left over in January are resumed before Advent.
  const resumed = s === 'Epi' && month >= 10;
  const afterPent = (count) => `${ord(count)} Sunday after Pentecost`;

  if (s === 'Nat') return month === 1 && /^Die /.test(day.latin) ? `${Number(day.date.slice(8))} January` : null;
  if (wd === 'Sunday') {
    switch (s) {
      case 'Adv': return `${ord(n)} Sunday of Advent${n === 3 ? ' (Gaudete)' : ''}`;
      case 'Epi': return resumed ? `${afterPent(weeksBetween(pentecost, day.date))} (${ord(n)} after Epiphany)` : `${ord(n)} Sunday after Epiphany`;
      case 'Quadp': return `${SEPTUAGESIMA[n]} Sunday`;
      case 'Quad': return n <= 4 ? `${ord(n)} Sunday of Lent${n === 4 ? ' (Laetare)' : ''}` : n === 5 ? 'Passion Sunday' : 'Palm Sunday';
      case 'Pasc': return ['Easter Sunday', 'Low Sunday'][n] || (n <= 5 ? `${ord(n)} Sunday after Easter` : n === 6 ? 'Sunday after the Ascension' : 'Pentecost Sunday');
      case 'Pent': return n === 1 ? 'Trinity Sunday' : afterPent(n);
    }
  }
  switch (s) {
    case 'Adv': return `${wd} of the ${ord(n)} week of Advent`;
    case 'Epi': return resumed ? `${wd} after the ${afterPent(weeksBetween(pentecost, day.date))}` : `${wd} after the ${ord(n)} Sunday after Epiphany`;
    case 'Quadp':
      if (/Cinerum/i.test(day.latin)) return 'Ash Wednesday';
      return /Cineres/i.test(day.latin) ? `${wd} after Ash Wednesday` : `${wd} after ${SEPTUAGESIMA[n]}`;
    case 'Quad':
      if (n <= 4) return `${wd} of the ${ord(n)} week of Lent`;
      if (n === 5) return `${wd} of Passion Week`;
      return { Thursday: 'Holy Thursday', Friday: 'Good Friday', Saturday: 'Holy Saturday' }[wd] || `${wd} of Holy Week`;
    case 'Pasc':
      if (n === 0) return `Easter ${wd}`;
      if (n === 7) return `Pentecost ${wd}`;
      return `${wd} after ${n === 1 ? 'Low Sunday' : n === 6 ? 'the Sunday after the Ascension' : `the ${ord(n)} Sunday after Easter`}`;
    case 'Pent': return `${wd} after ${n === 1 ? 'Trinity Sunday' : `the ${afterPent(n)}`}`;
  }
  return null;
}

// "S. Peter Chanel, priest and martyr" -> "St. Peter Chanel, Priest and Martyr"
function tidySaint(name) {
  return name
    .replace(/^S\.\s/, 'St. ').replace(/^Ss\.\s/, 'Sts. ')
    .replace(/, (.*)$/, (_, rest) => `, ${rest.replace(/\b([a-z])([a-z]+)/g, (w, a, b) => (/^(and|of|the|in|de|la|et)$/i.test(w) ? w : a.toUpperCase() + b))}`);
}

export function englishName(day, pentecost) {
  if (day.english && day.english !== day.latin && !LATIN_LOOKING.test(day.english)) return tidySaint(day.english);
  // Feasts kept in Tempora files (Holy Family, Corpus Christi…) before the generic week names.
  for (const [re, name] of LATIN_ALIASES) if (re.test(day.latin)) return name;
  const t = day.file.startsWith('Tempora/') && temporaName(day, pentecost);
  return t || tidySaint(day.english || day.latin);
}

// DO picks text colors from the Latin title (black stands for white vestments, grey for black).
const DO_COLORS = { green: 'GREEN', red: 'RED', purple: 'PURPLE', blue: 'WHITE', black: 'WHITE', grey: 'BLACK' };
const COLOR_OVERRIDES = {
  'vo:Tempora/Adv3-0': ['ROSE', 'Violet (rose may be worn)'],
  'vo:Tempora/Quad4-0': ['ROSE', 'Violet (rose may be worn)'],
  'vo:Tempora/Quad6-0': ['PURPLE', 'Red (procession), Violet (Mass)'],
  'vo:Tempora/Quad6-4': ['WHITE', 'White (Mass), Violet (Office)'],
  'vo:Tempora/Quad6-5': ['BLACK', 'Black; Violet for Communion'],
  'vo:Tempora/Quad6-6': ['PURPLE', 'Violet; White for the Easter Vigil'],
};
const rankLabel = (r) => (r?.match(/\b([IV]+)\.?\s*classis/i) ? `${r.match(/\b([IV]+)\.?\s*classis/i)[1]} class` : r);

export async function loadDO(dir = 'data/do') {
  const files = (await readdir(dir)).filter((f) => /^\d{4}-(usa|1960)\.json$/.test(f));
  const byYear = {};
  for (const f of files) {
    const [, year, tag] = f.match(/^(\d{4})-(usa|1960)/);
    (byYear[year] ||= {})[tag] = JSON.parse(await readFile(`${dir}/${f}`, 'utf8')).days;
  }
  return byYear;
}

const doLink = (date) => `https://www.divinumofficium.com/cgi-bin/missa/missa.pl?date=${date.slice(5, 7)}-${date.slice(8, 10)}-${date.slice(0, 4)}&version=${encodeURIComponent('Rubrics 1960 - 2020 USA')}`;

// date -> { name, latin, rank, color, colorNote, link, keys, alt, weekKey, weekName }
export function build1962(byYear) {
  const days = new Map();
  for (const { usa, 1960: std } of Object.values(byYear)) {
    if (!usa) continue;
    const pentecost = usa.find((d) => d.file.startsWith('Tempora/Pasc7-0'))?.date;
    const stdByDate = new Map((std || []).map((d) => [d.date, d]));
    for (const d of usa) {
      const key = officeKey(d.file);
      const [color, colorNote] = COLOR_OVERRIDES[key] || [DO_COLORS[d.color] || 'WHITE'];
      const alt = [];
      const plain = stdByDate.get(d.date);
      if (plain && officeKey(plain.file) !== key) {
        alt.push({ key: officeKey(plain.file), name: englishName(plain, pentecost), label: 'In the 1962 calendar before the 2020 additions' });
      }
      for (const c of d.commemorations) {
        const ck = officeKey(c.file);
        if (ck !== key && !alt.some((a) => a.key === ck)) {
          alt.push({ key: ck, name: englishName({ ...c, date: d.date }, pentecost), label: 'Commemorated' });
        }
      }
      days.set(d.date, {
        name: englishName(d, pentecost),
        latin: d.latin,
        rank: rankLabel(d.rank),
        color,
        colorNote,
        link: doLink(d.date),
        keys: [key],
        alt,
      });
    }
  }
  for (const [date, entry] of days) {
    if (dow(date) === 0) continue;
    const sunday = new Date(`${date}T00:00:00Z`);
    sunday.setUTCDate(sunday.getUTCDate() - dow(date));
    const s = days.get(sunday.toISOString().slice(0, 10));
    if (s) { entry.weekKey = s.keys[0]; entry.weekName = s.name; }
  }
  return days;
}

// In the 1962 Missal, weekdays outside Lent repeat the Sunday's prayers; only these Tempora
// weekdays have proper Masses. Posts can't be about the others, so they aren't match targets
// (the Novus Ordo gives every Advent and Easter weekday its own collect, so those posts are NO).
const PROPER_WEEKDAY = /^Tempora\/(Quad\d|Quadp3-[3-6]|Pasc0|Pasc7|Pasc5-[34]|Pasc6-6|Pent01-4|Pent02-5|Nat)/;
const matchable = (d) => !/^Tempora\/\w+\d+-[1-6]/.test(d.file) || PROPER_WEEKDAY.test(d.file) || /Quattuor|Vigilia|Rogation/i.test(d.latin);

// key -> { names, doys } for title matching, from both variants and commemorations.
export function voDictionary(byYear) {
  const dict = new Map();
  const add = (key, names, date) => {
    if (!dict.has(key)) dict.set(key, { names: [], doys: new Set() });
    const e = dict.get(key);
    for (const n of names) if (n && !e.names.includes(n)) e.names.push(n);
    e.doys.add(dayOfYear(date));
  };
  for (const variants of Object.values(byYear)) {
    const pentecost = variants.usa?.find((d) => d.file.startsWith('Tempora/Pasc7-0'))?.date;
    for (const list of Object.values(variants)) {
      for (const d of list) {
        if (matchable(d)) add(officeKey(d.file), [englishName(d, pentecost), d.english, d.latin], d.date);
        for (const c of d.commemorations) if (matchable(c)) add(officeKey(c.file), [englishName({ ...c, date: d.date }, pentecost), c.english, c.latin], d.date);
      }
    }
  }
  return dict;
}

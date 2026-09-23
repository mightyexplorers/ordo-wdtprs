// Turns liturgical day names ("XVII Sunday after Pentecost", "17th Ordinary Sunday",
// "Sts. Cornelius and Cyprian") into comparable token lists so post titles can be
// matched against calendar entries by name.

const ROMAN = { i: 1, v: 5, x: 10, l: 50 };
const ROMAN_RE = /^(?=[ivxl]+$)l?x{0,3}(ix|iv|v?i{0,3})$/;

function romanToInt(s) {
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = ROMAN[s[i]], next = ROMAN[s[i + 1]] || 0;
    total += cur < next ? -cur : cur;
  }
  return total;
}

const ORDINAL_WORDS = [
  'zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
  'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth',
  'nineteenth', 'twentieth',
];
const TENS = { twenty: 20, thirty: 30 };

export const DAY_WORDS = new Set(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']);
export const SEASON_WORDS = new Set(['advent', 'lent', 'easter', 'pentecost', 'epiphany', 'ordinary', 'christmas', 'nativity']);

const STOP = new Set([
  'the', 'of', 'in', 'a', 'an', 'and', 'on', 'within', 'for', 'to', 'time', 'day', 'mass', 'our',
  // prayer-part and blog labels that appear in titles but not calendar names
  'wdtprs', 'collect', 'collecta', 'secret', 'secreta', 'super', 'oblata', 'postcommunion', 'postcommunio',
  'post', 'communion', 'communionem', 'prayer', 'over', 'offerings', 'preface', 'oratio', 'prayercazt',
  'redux', 'repost', 'oldie', 'mr', 'class', 'commemoration', 'feast', 'solemnity', 'memorial', 'optional',
]);

// Phrases that mark which Missal a post is about; stripped before name matching.
const FORM_PHRASES = [
  /novus\s+ordo/g, /vetus\s+ordo/g, /extraordinary\s+form/g, /ordinary\s+form/g, /usus\s+antiquior/g,
  /\b(19|20)\d\d\s*mr\b/g, /\b(19|20)\d\d\b/g, /\bn\.\s?o\.?(?=\s|$|\))/g, /\(\s*(ef|of|no|vo|nor?)\s*\)/g,
  /missale\s+romanum/g, /\bef\b/g, /\btlm\b/g,
];

// Latin and traditional names that the 1962 feed and Fr. Z's titles use interchangeably.
const FERIA_DAYS = { ii: 'monday', iii: 'tuesday', iv: 'wednesday', v: 'thursday', vi: 'friday' };
const ALIASES = [
  [/\bferia\s+(ii|iii|iv|v|vi)\b/g, (_, n) => FERIA_DAYS[n]],
  [/\bsabbato\b/g, 'saturday'],
  [/\bdominica\b/g, 'sunday'],
  [/\bquasimodo\b|\bin\s+albis\b/g, ' low '],
  [/\bcathedra\b/g, 'chair'],
  [/\bmt\b\.?/g, 'mount'],
  [/\blady\s+day\b/g, 'annunciation'],
  [/\bcandlemas\b/g, 'presentation'],
  [/\bchildermas\b/g, 'holy innocents'],
  [/\bproto-?martyrs\b/g, 'first martyrs'],
  [/\bchristmas\b|\bmidnight\s+mass\b/g, 'nativity'],
  [/\blaetare(\s+sunday)?\b/g, '4th sunday of lent'],
  [/\bgaudete(\s+sunday)?\b/g, '3rd sunday of advent'],
  [/\bwhit\s+(monday|tuesday)\b/g, '$1 pentecost'],
  [/\bwhit\s*sunday\b/g, 'pentecost sunday'],
  [/\bspy\s+wednesday\b/g, 'wednesday of holy week'],
  [/\bmaundy\b/g, ' '],
  [/\bsunday\s+of\s+the\s+year\b/g, 'sunday ordinary'],
  [/\bbody\s+and\s+blood\s+of\s+(the\s+lord|christ)\b/g, 'corpus christi'],
  [/\bpre-?\s?lent(en)?\b/g, ' '],
  // Resumed Sundays after Pentecost reuse the remaining Sundays after Epiphany.
  [/\b(which\s+)?(remained|remaining|resumed)\b/g, ' '],
];

// Tokens too common to count toward similarity ("Presentation" = "Presentation of the Lord").
// Saints' titles too: "St. Apollonia, virgin and martyr" must not match "St. Agatha, Virgin and Martyr".
const WEAK = new Set([
  'sunday', 'lord', 'feast', 'our', 'most', 'holy', 'saint', 'blessed', 'virgin', 'virgins', 'martyr', 'martyrs',
  'bishop', 'bishops', 'doctor', 'priest', 'priests', 'apostle', 'apostles', 'evangelist', 'pope', 'abbot',
  'religious', 'deacon', 'companions', 'church', 'confessor', 'widow',
]);

export function stripAccents(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function tokens(input) {
  let s = stripAccents(String(input)).toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/&amp;/g, ' and ')
    .replace(/\bsts?\.\s*|\bss\.\s*/g, (m) => (m.startsWith('sts') || m.startsWith('ss') ? 'saints ' : 'saint '))
    .replace(/\bb\.\s?v\.\s?m\.?/g, 'blessed virgin mary ')
    .replace(/\bbvm\b/g, 'blessed virgin mary');
  for (const re of FORM_PHRASES) s = s.replace(re, ' ');
  for (const [re, to] of ALIASES) s = s.replace(re, to);
  s = s
    .replace(/\bordinary\s+sunday/g, 'sunday ordinary')
    .replace(/(\d+)(st|nd|rd|th)\b/g, '$1')
    .replace(/\b(twenty|thirty)[\s-]+(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth)\b/g,
      (_, t, o) => String(TENS[t] + ORDINAL_WORDS.indexOf(o)))
    .replace(/\bthirtieth\b/g, '30')
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/'s\b/g, '')
    .replace(/'/g, '');

  const raw = s.split(/\s+/).filter(Boolean);
  const out = [];
  for (let i = 0; i < raw.length; i++) {
    let t = raw[i];
    const ordIdx = ORDINAL_WORDS.indexOf(t);
    if (ordIdx > 0) t = String(ordIdx);
    else if (t === 'saints') t = 'saint';
    else if (ROMAN_RE.test(t) && t !== 'l' && (t !== 'i' || /^(sunday|week|class)$/.test(raw[i + 1] || ''))) {
      t = String(romanToInt(t));
    }
    if (!STOP.has(t)) out.push(t);
  }
  return out;
}

// Order-independent so "Low Sunday" and "Dominica in Albis" share a key.
export const slug = (s) => [...new Set(tokens(s))].sort().join('-');

export function features(name) {
  const toks = tokens(name);
  const strong = toks.filter((t) => !WEAK.has(t));
  const set = new Set(strong.length ? strong : toks);
  return {
    toks,
    set,
    lead: strong[0],
    nums: toks.filter((t) => /^\d+$/.test(t)).sort().join(','),
    days: toks.filter((t) => DAY_WORDS.has(t)).sort().join(','),
    seasons: new Set(toks.filter((t) => SEASON_WORDS.has(t))),
  };
}

// Similarity between a title fragment (a) and a calendar name (b); 0 when numbers,
// weekdays or seasons contradict, otherwise the Dice coefficient of their tokens.
export function similarity(a, b) {
  if (!a.set.size || !b.set.size) return 0;
  if (a.nums !== b.nums) return 0;
  if (a.days && b.days && a.days !== b.days) return 0;
  if (!a.days && b.days && b.days !== 'sunday') return 0;
  if (a.seasons.size && b.seasons.size && ![...a.seasons].some((x) => b.seasons.has(x))) return 0;
  let inter = 0, words = 0;
  for (const t of a.set) if (b.set.has(t)) { inter++; if (!/^\d+$/.test(t)) words++; }
  if (!words) return 0;
  const dice = (2 * inter) / (a.set.size + b.set.size);
  // A multi-word calendar name contained whole in a longer title fragment
  // ("Exaltation of the Holy Cross and Basil Emeritus") is a strong match.
  const contained = b.set.size >= 2 && inter === b.set.size ? 0.8 : 0;
  // A one-word saint's name leading the fragment ("St. Lucy in the sky…").
  const leading = b.set.size === 1 && a.lead === [...b.set][0] && !/^\d+$/.test(a.lead) ? 0.65 : 0;
  return Math.max(dice, contained, leading);
}

export function dayOfYear(isoDate) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return Math.floor((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 864e5);
}

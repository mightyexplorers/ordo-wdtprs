// Maps a post title onto a liturgical day in each calendar by name, e.g.
// "WDTPRS – 28th Ordinary Sunday (N.O.): A seminar on grace!" -> no:28thSundayOfOrdinaryTime
// "WDTPRS – 17th Sunday after Pentecost – Diabolical Contagion" -> vo:17-sunday-after-pentecost
import { features, similarity, dayOfYear } from './normalize.mjs';

export const THRESHOLD = 0.72;

const NO_MARKERS = /novus\s+ordo|\bn\.\s?o\.|\(no\)|\(of\)|ordinary\s+form|\b(19[7-9]\d|20[0-2]\d)\s*mr\b|ordinary\s+(sunday|time)|\bof\s+easter\b|\bweek\s+of\s+easter\b|divine\s+mercy|christ\s+the\s+king/i;
const VO_MARKERS = /vetus\s+ordo|\b1962\b|\(ef\)|\bef\b|extraordinary\s+form|usus\s+antiquior|\btlm\b|after\s+(pentecost|epiphany|easter)|septuagesima|sexagesima|quinquagesima|\bember\b|\bsecreta?\b|passion\s+sunday|low\s+sunday|within\s+the\s+octave/i;

// Signals in the post body, used only when the title fits both calendars.
const NO_BODY = /novus\s+ordo|\bicel\b|2002\s*mr|ordinary\s+form|missale\s+romanum\s*\(?2002|third\s+typical|1973|2011\s+translation/gi;
const VO_BODY = /vetus\s+ordo|1962|extraordinary\s+form|usus\s+antiquior|traditional\s+latin\s+mass|\btlm\b/gi;

function segments(title) {
  const t = title
    .replace(/^\s*(you do it\s+)?(wdtprs|what does the (\(\w+\) )?prayer really say\??|prayercazt\s*\d*|podcazt\s*\d*)\s*[:–—-]?\s*/i, '');
  const segs = new Set([t]);
  for (const s of t.split(/\s*[:–—|!?“”"]\s*|\s+-\s+/)) if (s.trim()) segs.add(s.trim());
  for (const s of t.split(/\s*[:–—|!?&“”"()]\s*|\s+-\s+/)) if (s.trim()) segs.add(s.trim());
  return [...segs].map(features).filter((f) => f.set.size);
}

export function compileDictionary(dict) {
  const out = [];
  for (const [key, { names, doys }] of dict) for (const name of names) out.push({ key, name, doys, f: features(name) });
  return out;
}

// Posts usually go up a few days before the celebration; a candidate that falls
// near the post's date in the year wins ties such as the four Ember Wednesdays.
const NEAR_DAYS = 12;
const near = (doys, doy) => [...doys].some((d) => { const diff = Math.abs(d - doy); return Math.min(diff, 365 - diff) <= NEAR_DAYS; });

function bestMatch(segs, compiled, postDoy) {
  let best = null;
  for (const s of segs) {
    for (const e of compiled) {
      let score = similarity(s, e.f);
      if (score < 0.6) continue;
      if (near(e.doys, postDoy)) score += 0.1;
      if (score >= THRESHOLD && (!best || score > best.score)) best = { key: e.key, name: e.name, score: Math.min(score, 1) };
    }
  }
  return best;
}

// Before Summorum Pontificum (July 2007) the WDTPRS column covered only the Novus Ordo;
// PRAYERCAzT is by its own description a 1962 Missal series.
const SUMMORUM = '2007-07-07';
const PRAYERCAZT = 31;

export function matchTitle(title, bodyText, { no, vo }, { date, categories = [] }) {
  const segs = segments(title);
  const doy = dayOfYear(date);
  const found = { no: bestMatch(segs, no, doy), vo: bestMatch(segs, vo, doy) };
  const titleNO = NO_MARKERS.test(title), titleVO = VO_MARKERS.test(title);

  let forms;
  if (titleNO && !titleVO) forms = ['no'];
  else if (titleVO && !titleNO) forms = ['vo'];
  else if (!titleVO && date < SUMMORUM && found.no) forms = ['no'];
  else if (!titleNO && categories.includes(PRAYERCAZT) && found.vo) forms = ['vo'];
  else if (found.no && found.vo) {
    const n = (bodyText.match(NO_BODY) || []).length, v = (bodyText.match(VO_BODY) || []).length;
    forms = n > v ? ['no'] : v > n ? ['vo'] : ['no', 'vo'];
  } else forms = ['no', 'vo'];

  const result = {};
  for (const f of forms) if (found[f]) result[f] = found[f];
  return result;
}

const PART_PATTERNS = [
  ['Prayer over the Offerings', /super\s+oblata|secreta?\b|prayer\s+over\s+the\s+(offerings|gifts)/i],
  ['Post Communion', /post\s*-?\s*communion(em)?|postcommunio/i],
  ['Preface', /\bpreface\b|praefatio/i],
  ['Hymn', /\bhymn\b|sequence|exs?ultet|ave maris stella|veni creator/i],
  ['Collect', /\bcollect(a)?\b/i],
];
export function prayerPart(title) {
  for (const [label, re] of PART_PATTERNS) if (re.test(title)) return label;
  return 'Collect';
}

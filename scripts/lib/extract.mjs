// Pulls the short, quotable pieces out of a post: the Latin prayer, Fr. Z's literal
// rendering, and an opening excerpt. The full post body is never kept.
import { parse } from 'node-html-parser';

const LATIN_WORDS = /\b(quaesumus|domine|deus|omnipotens|nostris|nobis|tuae|tuis|tuam|tuum|qui|ut|et|per|sempiterne|concede|praesta|famulis|ecclesiae|misericordiam|gratiam|nostra|nos|quae|atque|ac|sanctorum|beatae)\b/gi;
const ENGLISH_WORDS = /\b(the|and|you|your|we|our|that|this|is|of|to|with)\b/gi;

const clean = (s) => s.replace(/\s+/g, ' ').trim();
const words = (s) => s.split(/\s+/).filter(Boolean).length;

function isLatin(text) {
  const n = words(text);
  if (n < 6 || n > 200) return false;
  const lat = (text.match(LATIN_WORDS) || []).length;
  const eng = (text.match(ENGLISH_WORDS) || []).length;
  return lat >= 3 && lat > eng * 2;
}

function truncateWords(text, max) {
  const w = text.split(/\s+/);
  return w.length <= max ? text : `${w.slice(0, max).join(' ')}…`;
}

export function extract(html) {
  const root = parse(html);
  const text = clean(root.textContent);

  // Blockquotes and top-level paragraphs, in document order. (node-html-parser's
  // querySelectorAll ignores comma-separated selectors, so walk everything.)
  const blocks = root.querySelectorAll('*')
    .filter((el) => el.tagName === 'BLOCKQUOTE' || (el.tagName === 'P' && !el.closest('blockquote')))
    .map((el) => ({ el, text: clean(el.textContent) }));

  const latinBlock = blocks.find((b) => isLatin(b.text.replace(/^(COLLECT|COLLECTA|SECRET|SUPER OBLATA|POST ?COMMUNION)\s*:?\s*/i, '')));
  let latin = latinBlock?.text.replace(/^(COLLECT|COLLECTA|SECRET|SUPER OBLATA|POST ?COMMUNION)\s*:?\s*/i, '');
  if (!latin) {
    // The prayer is often an italic run inside a paragraph that also has English.
    latin = root.querySelectorAll('*')
      .filter((el) => ['EM', 'I', 'SPAN'].includes(el.tagName))
      .map((el) => clean(el.textContent))
      .find(isLatin);
  }

  // "LITERAL RENDERING:" / "SLAVISHLY LITERAL TRANSLATION" followed by the text, either
  // in the same paragraph after the heading or in the next block.
  let literal;
  const hi = blocks.findIndex((b) => /LITERAL\s+(RENDERING|VERSION|TRANSLATION)/.test(b.text) && b.el.tagName === 'P');
  if (hi >= 0) {
    const rest = blocks[hi].text.replace(/^.*?LITERAL\s+(RENDERING|VERSION|TRANSLATION)\s*(\([^)]*\))?\s*:?\s*/, '');
    literal = words(rest) >= 6 ? rest : blocks[hi + 1]?.text;
  }

  const paras = blocks
    .filter((b) => b.el.tagName === 'P' && b !== latinBlock && words(b.text) >= 4 && !isLatin(b.text))
    .map((b) => b.text);
  let excerpt = '';
  for (const p of paras) {
    excerpt = excerpt ? `${excerpt} ${p}` : p;
    if (words(excerpt) >= 45) break;
  }

  // Drop headings like "COLLECT – LATIN TEXT (2002MR):" that precede the prayer.
  const LABEL = /^[^a-z]{0,40}\b(LATIN|COLLECTA?|SECRETA?|SUPER OBLATA|POST ?COMMUNIO(N|NEM)?|TEXT)\b[^:]{0,60}:\s*/;
  latin = latin?.replace(LABEL, '').replace(/^[\s–—:-]*(\([^)]*\))?[\s:]*/, '');
  literal = literal?.replace(LABEL, '');

  return {
    latin: latin && truncateWords(latin, 120),
    literal: literal && truncateWords(literal, 120),
    excerpt: truncateWords(excerpt, 60),
    bodyText: text,
  };
}

// First few normalized Latin words, used to link posts about the same prayer
// (many collects moved between the 1962 and 2002 Missals).
export function incipit(latin) {
  if (!latin) return undefined;
  const w = latin.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/ae/g, 'e').replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean);
  return w.length >= 5 ? w.slice(0, 5).join(' ') : undefined;
}

// Walk each FamousGame in src/features/games/catalog.ts and flag any
// keyMoment whose label disagrees with its declared ply, plus any moveNote
// at index N whose text doesn't match the SAN at ply N+1.
//
// Heuristic: each label starts with a token like "16...Nd3" or "17. Nab1"
// before an em-dash; that token tells us which move was meant. We map that
// to an expected ply via the standard 1-indexed convention and compare.
// SAN parsing is loose: we strip annotation glyphs and trailing punctuation.

import { Chess } from 'chess.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const catalogPath = resolve(here, '../src/features/games/catalog.ts');
const src = readFileSync(catalogPath, 'utf8');

// Hack: pull each GAME object out of the source. We rely on the source being
// well-formed; the goal is a dev-time audit, not a real parser.
function extractGames() {
  const games = [];
  const idRe = /id:\s*'([^']+)'/g;
  let m;
  while ((m = idRe.exec(src))) games.push(m[1]);
  return games;
}

// For a given id, slurp { pgn: `...`, keyMoments: [...], moveNotes: {...} } via regex.
function sliceFor(id) {
  const idx = src.indexOf(`id: '${id}'`);
  if (idx < 0) return null;
  // Find the closing brace of this object. We use a naive depth counter
  // starting at the next '{' after idx.
  let depth = 0;
  let start = src.lastIndexOf('{', idx);
  let i = start;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) break; }
  }
  return src.slice(start, i + 1);
}

function extractPgn(slice) {
  const m = slice.match(/pgn:\s*`([\s\S]*?)`/);
  return m ? m[1] : null;
}

function extractKeyMoments(slice) {
  const block = slice.match(/keyMoments:\s*\[([\s\S]*?)\]/);
  if (!block) return [];
  const items = [];
  const re = /\{\s*ply:\s*(\d+),\s*label:\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)\s*\}/g;
  let m;
  while ((m = re.exec(block[1]))) items.push({ ply: Number(m[1]), label: m[2] ?? m[3] ?? m[4] });
  return items;
}

function extractMoveNotes(slice) {
  const block = slice.match(/moveNotes:\s*\{([\s\S]*?)\n\s*\},?/);
  if (!block) return {};
  const out = {};
  const re = /(\d+):\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/g;
  let m;
  while ((m = re.exec(block[1]))) {
    const k = Number(m[1]);
    out[k] = m[2] ?? m[3] ?? m[4];
  }
  return out;
}

// Parse a "16...Nd3" or "17. Nab1" prefix from a label and return
// { moveNumber, isWhite, san } or null.
function parseLabelMove(label) {
  // Examples:
  //   "16...Nd3 — the knight lands"   → move 16 black
  //   "17. Nab1 — White cedes"        → move 17 white
  //   "11...Na4!! — the offer"        → move 11 black
  //   "23. Be7# — mate"               → move 23 white
  //   "26. f5! — the breakthrough"    → move 26 white
  const m = label.match(/^(\d+)(\.\.\.|\.)\s*([^\s—-]+)/);
  if (!m) return null;
  const moveNumber = Number(m[1]);
  const isWhite = m[2] === '.';
  // Strip glyphs and annotation marks for comparison.
  const san = m[3].replace(/[!?]+$/, '').replace(/#$/, '#').replace(/\+$/, '+');
  return { moveNumber, isWhite, san };
}

function normalizeSan(s) {
  return s.replace(/[!?]+/g, '').toLowerCase();
}

// For each move in the game, compute (moveNumber, isWhite, san).
function moveTable(pgn) {
  const c = new Chess();
  c.loadPgn(pgn, { strict: false });
  const hist = c.history();
  return hist.map((san, i) => ({
    ply: i + 1,
    moveNumber: Math.floor(i / 2) + 1,
    isWhite: i % 2 === 0,
    san,
  }));
}

const issues = [];
for (const id of extractGames()) {
  const slice = sliceFor(id);
  if (!slice) continue;
  const pgn = extractPgn(slice);
  if (!pgn) continue;
  const km = extractKeyMoments(slice);
  const notes = extractMoveNotes(slice);
  const table = moveTable(pgn);

  // Check keyMoments.
  for (const k of km) {
    const parsed = parseLabelMove(k.label);
    if (!parsed) continue;
    const expectedPly = (parsed.moveNumber - 1) * 2 + (parsed.isWhite ? 1 : 2);
    const move = table[k.ply - 1];
    const labelSan = normalizeSan(parsed.san.replace(/[+#]$/, ''));
    const actualSan = move ? normalizeSan(move.san.replace(/[+#]$/, '')) : '?';
    if (k.ply !== expectedPly) {
      issues.push({
        id, kind: 'keyMoment.ply',
        label: k.label,
        actualPly: k.ply,
        expectedPly,
        sanAtActual: actualSan,
        sanAtExpected: table[expectedPly - 1] ? normalizeSan(table[expectedPly - 1].san.replace(/[+#]$/, '')) : '?',
      });
    } else if (move && !actualSan.startsWith(labelSan) && !labelSan.startsWith(actualSan)) {
      issues.push({
        id, kind: 'keyMoment.label-mismatch',
        label: k.label,
        ply: k.ply,
        sanAtPly: actualSan,
      });
    }
  }

  // Check moveNotes — each index N should describe the move at ply N+1.
  for (const [keyStr, text] of Object.entries(notes)) {
    const idx = Number(keyStr);
    const ply = idx + 1;
    const move = table[idx];
    if (!move) {
      issues.push({ id, kind: 'moveNote.out-of-range', idx, ply, text: text.slice(0, 60) });
      continue;
    }
    // Try to parse a SAN-like token from the start of the note text.
    const tok = text.match(/^([A-Za-z0-9+#=:-]+)/);
    if (!tok) continue;
    const noteSan = normalizeSan(tok[1].replace(/[+#]$/, ''));
    const actualSan = normalizeSan(move.san.replace(/[+#]$/, ''));
    // Many notes start with SAN ("Nd3 —", "Rxe7+ —") and a few don't ("Anderssen offers..."),
    // so only flag when the token looks like SAN: capital first letter or pure file/rank.
    const looksLikeSan = /^[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8]/.test(tok[1]) || /^O-O/.test(tok[1]);
    if (looksLikeSan && noteSan !== actualSan && !actualSan.includes(noteSan) && !noteSan.includes(actualSan)) {
      // Find which ply this SAN actually appears at, if any.
      const foundAt = table.find((mv) => normalizeSan(mv.san.replace(/[+#]$/, '')) === noteSan);
      issues.push({
        id, kind: 'moveNote.san-mismatch',
        idx, declaredPly: ply,
        noteSan, sanAtPly: actualSan,
        sanFoundAtPly: foundAt ? foundAt.ply : null,
      });
    }
  }
}

if (issues.length === 0) {
  console.log('No issues found across', extractGames().length, 'games.');
} else {
  console.log(`Found ${issues.length} issue(s):`);
  for (const i of issues) console.log(JSON.stringify(i));
}

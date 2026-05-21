// Eager-import every piece SVG as raw text. Vite inlines these at build time
// so we don't pay a network round-trip and we can splice the SVG content into
// CSS data-URIs at runtime.
const modules = import.meta.glob('./*/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export type PieceCode = 'wK' | 'wQ' | 'wR' | 'wB' | 'wN' | 'wP' | 'bK' | 'bQ' | 'bR' | 'bB' | 'bN' | 'bP';

const PIECE_CODES: PieceCode[] = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'];

export interface PieceSet {
  id: string;
  label: string;
  attribution: string;
  pieces: Record<PieceCode, string>;
}

function loadSet(id: string, label: string, attribution: string): PieceSet {
  const pieces = {} as Record<PieceCode, string>;
  for (const code of PIECE_CODES) {
    const key = `./${id}/${code}.svg`;
    const svg = modules[key];
    if (!svg) throw new Error(`Missing piece SVG: ${key}`);
    pieces[code] = svg;
  }
  return { id, label, attribution, pieces };
}

export const PIECE_SETS: PieceSet[] = [
  loadSet('cburnett', 'Cburnett', 'Colin M.L. Burnett · CC-BY-SA 3.0'),
  loadSet('merida', 'Merida', 'Armando Hernandez Marroquin · GPL'),
  loadSet('alpha', 'Alpha', 'Eric Bentzen · public domain'),
  loadSet('staunty', 'Staunty', 'Will Entriken · CC-BY-SA 3.0'),
  loadSet('chess7', 'Chess7', 'Lichess design team · CC-BY-SA 3.0'),
  loadSet('california', 'California', 'Jerry S · CC-BY-NC-SA 4.0'),
  loadSet('horsey', 'Horsey', 'Cody O\'Neil · CC-BY-SA 3.0'),
  loadSet('maestro', 'Maestro', 'sadsnake1 · CC-BY-NC-SA 4.0'),
  loadSet('pixel', 'Pixel', 'therealqtpi · CC-BY-SA 3.0'),
  loadSet('fantasy', 'Fantasy', 'Maurizio Monge · public domain'),
  loadSet('letter', 'Letter', 'Public domain · text-based'),
];

export function findPieceSet(id: string): PieceSet {
  return PIECE_SETS.find((s) => s.id === id) ?? PIECE_SETS[0];
}

const CHESSGROUND_PIECE_CLASS: Record<PieceCode, { color: 'white' | 'black'; kind: string }> = {
  wK: { color: 'white', kind: 'king' },
  wQ: { color: 'white', kind: 'queen' },
  wR: { color: 'white', kind: 'rook' },
  wB: { color: 'white', kind: 'bishop' },
  wN: { color: 'white', kind: 'knight' },
  wP: { color: 'white', kind: 'pawn' },
  bK: { color: 'black', kind: 'king' },
  bQ: { color: 'black', kind: 'queen' },
  bR: { color: 'black', kind: 'rook' },
  bB: { color: 'black', kind: 'bishop' },
  bN: { color: 'black', kind: 'knight' },
  bP: { color: 'black', kind: 'pawn' },
};

function dataUri(svg: string): string {
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
}

/** CSS block targeting chessground's piece classes for a given set. */
export function pieceSetCss(setId: string): string {
  const set = findPieceSet(setId);
  const lines: string[] = [];
  for (const code of PIECE_CODES) {
    const { color, kind } = CHESSGROUND_PIECE_CLASS[code];
    lines.push(`.cg-wrap piece.${color}.${kind} { background-image: ${dataUri(set.pieces[code])}; }`);
  }
  return lines.join('\n');
}

/** Get a single piece SVG (used by the canvas video exporter). */
export function getPieceSvg(setId: string, code: PieceCode): string {
  return findPieceSet(setId).pieces[code];
}

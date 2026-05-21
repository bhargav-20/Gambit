/**
 * Fetch a PGN from a Lichess or Chess.com game URL. Both providers expose
 * public REST endpoints that return PGN text — no API key required.
 */

export interface FetchedGame {
  pgn: string;
  source: 'lichess' | 'chesscom';
  title?: string;
}

const LICHESS_URL = /lichess\.org\/(?:embed\/)?(?:game\/)?([a-zA-Z0-9]{8,12})/;
// Chess.com game URLs: chess.com/game/live/<id> or chess.com/game/daily/<id> or chess.com/live/game/<id>
const CHESSCOM_URL = /chess\.com\/(?:game\/(?:live|daily)|live\/game|daily\/game)\/(\d+)/;

export function detectProvider(input: string): 'lichess' | 'chesscom' | null {
  if (LICHESS_URL.test(input)) return 'lichess';
  if (CHESSCOM_URL.test(input)) return 'chesscom';
  return null;
}

/**
 * Lichess: GET https://lichess.org/game/export/{id}?clocks=0&evals=0
 * Returns PGN text directly when Accept: application/x-chess-pgn.
 */
async function fetchLichess(id: string): Promise<FetchedGame> {
  const res = await fetch(`https://lichess.org/game/export/${id}?clocks=0&evals=0`, {
    headers: { Accept: 'application/x-chess-pgn' },
  });
  if (!res.ok) throw new Error(`Lichess returned ${res.status}`);
  const pgn = await res.text();
  if (!pgn.trim()) throw new Error('Lichess returned an empty PGN');
  return { pgn, source: 'lichess', title: `Lichess #${id}` };
}

/**
 * Chess.com: their public API returns games per month per user, not per game id.
 * The cleanest no-auth approach is the callback endpoint that gives JSON for a
 * single game: https://www.chess.com/callback/live/game/{id}
 * Returns a JSON object with a `pgnHeaders` and `moveList` we'd need to
 * reconstruct. We use the more reliable `https://www.chess.com/callback/live/game/{id}/pgn`
 * when available, otherwise fall back to instructing the user.
 */
async function fetchChessCom(id: string): Promise<FetchedGame> {
  // Chess.com's official Published Data API requires the username + month, which
  // a URL alone doesn't give us. The callback endpoints below sometimes work
  // depending on game type and CORS — best-effort. If they fail, we surface a
  // clear error so the user can paste the PGN manually.
  const endpoints = [
    `https://www.chess.com/callback/live/game/${id}`,
    `https://www.chess.com/callback/daily/game/${id}`,
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const json = (await res.json()) as { game?: { pgnHeaders?: Record<string, string>; moveList?: string; pgn?: string } };
      const g = json.game;
      if (!g) continue;
      if (typeof g.pgn === 'string' && g.pgn.trim()) {
        return { pgn: g.pgn, source: 'chesscom', title: `Chess.com #${id}` };
      }
    } catch {
      /* try the next endpoint */
    }
  }
  throw new Error(
    'Chess.com blocked the request (CORS) or the game is private. Open the game on Chess.com, click Share → PGN, and paste it instead.',
  );
}

export async function fetchGameFromUrl(input: string): Promise<FetchedGame> {
  const trimmed = input.trim();
  const lichessMatch = trimmed.match(LICHESS_URL);
  if (lichessMatch) return fetchLichess(lichessMatch[1]);
  const chessComMatch = trimmed.match(CHESSCOM_URL);
  if (chessComMatch) return fetchChessCom(chessComMatch[1]);
  throw new Error('Not a recognized Lichess or Chess.com game URL.');
}

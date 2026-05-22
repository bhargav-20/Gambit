// Curated catalog of historically important games. Each entry is a full PGN
// plus the storytelling that makes the game worth studying — players, event,
// the narrative of what was at stake and why the game is famous, an outcome
// paragraph on the result and its impact, and a few "key moment" plies the
// user can jump to with one click.
//
// Schema-validated at module load via `validateGames()` — every PGN is
// re-parsed through chess.js so a typo or stray character surfaces in the
// dev console immediately. Production builds skip the validator.

import { Chess } from 'chess.js';

export type GameEra = 'romantic' | 'classical' | 'modern' | 'contemporary' | 'engine';

export interface FamousGame {
  id: string;
  title: string;
  players: {
    white: string;
    black: string;
    whiteElo?: number;
    blackElo?: number;
  };
  event?: string;
  date?: string;
  site?: string;
  round?: string;
  result: '1-0' | '0-1' | '1/2-1/2';
  era: GameEra;
  tags: string[];
  pgn: string;
  /** Multi-paragraph backstory. Plain text — paragraphs separated by blank lines. */
  narrative: string;
  /** Closing paragraph about the result and historical impact. */
  outcome: string;
  /** Plies the user can jump to as "highlights" — the moves that made the game famous. */
  keyMoments: Array<{ ply: number; label: string }>;
}

export const GAME_ERAS: Array<{ id: GameEra; label: string; years: string }> = [
  { id: 'romantic',     label: 'Romantic',     years: '1800–1880' },
  { id: 'classical',    label: 'Classical',    years: '1880–1925' },
  { id: 'modern',       label: 'Modern',       years: '1925–1985' },
  { id: 'contemporary', label: 'Contemporary', years: '1985–2010' },
  { id: 'engine',       label: 'Engine era',   years: '2010+' },
];

export const GAMES: FamousGame[] = [
  {
    id: 'immortal',
    title: 'The Immortal Game',
    players: { white: 'Adolf Anderssen', black: 'Lionel Kieseritzky' },
    event: 'Casual game',
    site: 'London',
    date: '1851.06.21',
    result: '1-0',
    era: 'romantic',
    tags: ['Immortal', 'Sacrifice', 'Brilliancy', "King's Gambit"],
    pgn: `[Event "Casual game"]
[Site "London"]
[Date "1851.06.21"]
[White "Adolf Anderssen"]
[Black "Lionel Kieseritzky"]
[Result "1-0"]

1. e4 e5 2. f4 exf4 3. Bc4 Qh4+ 4. Kf1 b5 5. Bxb5 Nf6 6. Nf3 Qh6 7. d3 Nh5
8. Nh4 Qg5 9. Nf5 c6 10. g4 Nf6 11. Rg1 cxb5 12. h4 Qg6 13. h5 Qg5 14. Qf3 Ng8
15. Bxf4 Qf6 16. Nc3 Bc5 17. Nd5 Qxb2 18. Bd6 Bxg1 19. e5 Qxa1+ 20. Ke2 Na6
21. Nxg7+ Kd8 22. Qf6+ Nxf6 23. Be7# 1-0
`,
    narrative:
      `Played during a tournament break in London, this casual game between two of the era's strongest players became the most celebrated combination in chess history. Anderssen offers a bishop, both rooks, and finally his queen — material that would mean swift defeat in any sober game — and converts the diving sacrifices into a checkmate delivered by three light pieces against a king with most of its army still on the board.

The position after 17. Nd5 is a tableau the chess world has stared at for 175 years: Black's queen has just helped itself to b2, having earlier swallowed time and a bishop; White has a knight pointing at f6 and a rook on g1 staring down g7. The avalanche of sacrifices that follows — 18. Bd6!! offering a rook with check, 21. Nxg7+ undermining the back rank, 22. Qf6+!! the queen given up to clear the e-file — was the romantic era's loudest statement about beauty over material.

Kieseritzky himself was the first to call it "immortal," telegraphing the game to a Paris chess café the same evening. The name stuck. Steinitz later catalogued it as the prototype of attacking play; today it still appears in every introductory text on the value of initiative.`,
    outcome:
      `Anderssen would go on to win the tournament and be recognized as the world's strongest player of the 1850s. The Immortal Game is the reason coaches teach beginners that material is only a means to an end — checkmate is the only currency that matters.`,
    keyMoments: [
      { ply: 33, label: '17. Nd5 — the bishop is offered to free the e-file' },
      { ply: 35, label: '18. Bd6!! — the rook sacrifice begins' },
      { ply: 41, label: '21. Nxg7+ — undermining g7 for the mating net' },
      { ply: 43, label: '22. Qf6+!! — the queen is given up' },
      { ply: 45, label: '23. Be7# — mate with three minor pieces' },
    ],
  },
  {
    id: 'evergreen',
    title: 'The Evergreen Game',
    players: { white: 'Adolf Anderssen', black: 'Jean Dufresne' },
    event: 'Casual game',
    site: 'Berlin',
    date: '1852',
    result: '1-0',
    era: 'romantic',
    tags: ['Evergreen', 'Sacrifice', 'Brilliancy', 'Evans Gambit'],
    pgn: `[Event "Casual game"]
[Site "Berlin"]
[Date "1852"]
[White "Adolf Anderssen"]
[Black "Jean Dufresne"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. b4 Bxb4 5. c3 Ba5 6. d4 exd4 7. O-O d3
8. Qb3 Qf6 9. e5 Qg6 10. Re1 Nge7 11. Ba3 b5 12. Qxb5 Rb8 13. Qa4 Bb6
14. Nbd2 Bb7 15. Ne4 Qf5 16. Bxd3 Qh5 17. Nf6+ gxf6 18. exf6 Rg8 19. Rad1
Qxf3 20. Rxe7+ Nxe7 21. Qxd7+ Kxd7 22. Bf5+ Ke8 23. Bd7+ Kf8 24. Bxe7# 1-0
`,
    narrative:
      `If the Immortal is the loudest combination in chess, the Evergreen is the most elegant. Steinitz, never one for praise, called it "the evergreen in the laurel crown of the immortal master." The line still draws students because every white piece participates: the knight on f6 trades into shadow, both rooks invade together, and after 19. Rad1 every black officer is on the wrong side of the brewing storm.

Black's 19...Qxf3 looks at first like a fatal blunder — surely White recaptures? Anderssen instead plays 20. Rxe7+, deflecting the knight, and the queen sacrifice 21. Qxd7+!! is what made the game evergreen: the king is dragged across the board into a final pattern of bishops sweeping the dark squares.

The game is also a textbook for the Evans Gambit (1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.b4) — a pet line of Anderssen, Morphy, Chigorin, and later Kasparov. The whole opening yields itself in service of one combination.`,
    outcome:
      `Anderssen kept his reputation as the strongest player of the romantic era through this game and the Immortal. The Evergreen remains in every anthology of best games of all time and is required reading for students of attack.`,
    keyMoments: [
      { ply: 33, label: '17. Nf6+ — knight sacrifice opens the king' },
      { ply: 37, label: '19. Rad1 — both rooks in position' },
      { ply: 39, label: '20. Rxe7+ — deflecting the defender' },
      { ply: 41, label: '21. Qxd7+!! — the queen is offered' },
      { ply: 47, label: '24. Bxe7# — bishops finish the picture' },
    ],
  },
  {
    id: 'opera-game',
    title: 'The Opera Game',
    players: { white: 'Paul Morphy', black: 'Duke Karl / Count Isouard' },
    event: 'Casual game',
    site: 'Paris Opera House',
    date: '1858',
    result: '1-0',
    era: 'romantic',
    tags: ['Sacrifice', 'Development', 'Smothered Mate', 'Philidor Defense'],
    pgn: `[Event "Casual game"]
[Site "Paris"]
[Date "1858"]
[White "Paul Morphy"]
[Black "Duke Karl / Count Isouard"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7
8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7
14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0
`,
    narrative:
      `Paul Morphy was 21 years old, in Paris on a European tour, and on the evening of November 2, 1858, was attending a performance of The Barber of Seville at the Italian Opera House. He played this game in the Duke of Brunswick's private box, between glances at the stage, against the Duke and Count Isouard consulting.

Every move is a lesson in opening principles. By move 10 White has all three pieces developed and is castled; Black is still scrambling defenders to the queenside. The sacrifice 10. Nxb5! removes a key defender of the back rank; 13. Rxd7 deflects the knight; the queen sacrifice 16. Qb8+!! has been on every coach's whiteboard for 167 years. The game ends 17. Rd8# — a smothered-style mate with rook and bishop where Black's own pieces have been turned into a wall.

What makes the game timeless is its honesty about chess. There is no swindle, no trap, no obscure preparation. White wins because White is developed and castled and Black is not. The mate is the natural consequence of those two simple facts.`,
    outcome:
      `Morphy returned to the United States as the world's strongest player despite never playing for a title. The Opera Game became the canonical example used to teach the principles of rapid development and central control — there is no chess curriculum on earth that omits it.`,
    keyMoments: [
      { ply: 19, label: '10. Nxb5! — the first sacrifice for development' },
      { ply: 25, label: '13. Rxd7 — deflecting the defender' },
      { ply: 31, label: '16. Qb8+!! — the queen is offered' },
      { ply: 33, label: '17. Rd8# — smothered mate' },
    ],
  },
  {
    id: 'game-of-the-century',
    title: 'The Game of the Century',
    players: { white: 'Donald Byrne', black: 'Bobby Fischer' },
    event: 'Third Rosenwald Trophy',
    site: 'New York',
    date: '1956.10.17',
    result: '0-1',
    era: 'modern',
    tags: ['Brilliancy', 'Queen Sacrifice', 'Fischer', "Grünfeld Defense"],
    pgn: `[Event "Third Rosenwald Trophy"]
[Site "New York"]
[Date "1956.10.17"]
[Round "8"]
[White "Donald Byrne"]
[Black "Bobby Fischer"]
[Result "0-1"]

1. Nf3 Nf6 2. c4 g6 3. Nc3 Bg7 4. d4 O-O 5. Bf4 d5 6. Qb3 dxc4 7. Qxc4 c6
8. e4 Nbd7 9. Rd1 Nb6 10. Qc5 Bg4 11. Bg5 Na4 12. Qa3 Nxc3 13. bxc3 Nxe4
14. Bxe7 Qb6 15. Bc4 Nxc3 16. Bc5 Rfe8+ 17. Kf1 Be6 18. Bxb6 Bxc4+ 19. Kg1
Ne2+ 20. Kf1 Nxd4+ 21. Kg1 Ne2+ 22. Kf1 Nc3+ 23. Kg1 axb6 24. Qb4 Ra4
25. Qxb6 Nxd1 26. h3 Rxa2 27. Kh2 Nxf2 28. Re1 Rxe1 29. Qd8+ Bf8 30. Nxe1
Bd5 31. Nf3 Ne4 32. Qb8 b5 33. h4 h5 34. Ne5 Kg7 35. Kg1 Bc5+ 36. Kf1 Ng3+
37. Ke1 Bb4+ 38. Kd1 Bb3+ 39. Kc1 Ne2+ 40. Kb1 Nc3+ 41. Kc1 Rc2# 0-1
`,
    narrative:
      `Bobby Fischer was thirteen years old. Donald Byrne was twenty-six, a US Master, and would the next year miss the US Championship only because of illness. They sat down at the Marshall Chess Club in October 1956, and Fischer played one of the most studied games in chess history.

The Grünfeld unfolds normally for ten moves. Then, in a position where Byrne had what looked like a comfortable initiative, Fischer played 11...Na4!! — offering his knight to crack the queenside. Byrne accepts the lesser-evil 12. Qa3, and Fischer immediately sacrifices the knight anyway with 12...Nxc3. Five moves later, after 17. Kf1 Be6!!, the queen-sacrifice that gave the game its name appears on the board: White must either take the queen and walk into a forced loss, or refuse and lose material immediately.

Byrne plays 18. Bxb6 — accepting the queen — and is then driven through a long forced sequence where his king runs across the board until 41...Rc2#. The combination is sixteen moves deep from the queen sacrifice; the fact that a thirteen-year-old saw the entire line is what Chess Review meant when, the next day, they called it "the Game of the Century."`,
    outcome:
      `The game launched Fischer's career. Within seven years he was US Champion, within fifteen the World Champion. His queen sacrifice for positional dominance is one of the half-dozen most-replayed games in the world.`,
    keyMoments: [
      { ply: 21, label: '11...Na4!! — the offer that started it all' },
      { ply: 33, label: '17...Be6!! — the queen sacrifice appears' },
      { ply: 35, label: '18. Bxb6 — Byrne accepts' },
      { ply: 47, label: "24. Qb4 Ra4 — Fischer's pieces swarm" },
      { ply: 81, label: '41...Rc2# — mate' },
    ],
  },
  {
    id: 'fischer-spassky-g6',
    title: 'Fischer vs Spassky — Game 6, 1972 World Championship',
    players: { white: 'Bobby Fischer', black: 'Boris Spassky', whiteElo: 2785, blackElo: 2660 },
    event: 'World Championship Match',
    site: 'Reykjavík',
    date: '1972.07.23',
    round: '6',
    result: '1-0',
    era: 'modern',
    tags: ['World Championship', "Queen's Gambit", 'Positional masterpiece'],
    pgn: `[Event "World Championship Match"]
[Site "Reykjavik"]
[Date "1972.07.23"]
[Round "6"]
[White "Bobby Fischer"]
[Black "Boris Spassky"]
[Result "1-0"]

1. c4 e6 2. Nf3 d5 3. d4 Nf6 4. Nc3 Be7 5. Bg5 O-O 6. e3 h6 7. Bh4 b6
8. cxd5 Nxd5 9. Bxe7 Qxe7 10. Nxd5 exd5 11. Rc1 Be6 12. Qa4 c5 13. Qa3 Rc8
14. Bb5 a6 15. dxc5 bxc5 16. O-O Ra7 17. Be2 Nd7 18. Nd4 Qf8 19. Nxe6 fxe6
20. e4 d4 21. f4 Qe7 22. e5 Rb8 23. Bc4 Kh8 24. Qh3 Nf8 25. b3 a5 26. f5 exf5
27. Rxf5 Nh7 28. Rcf1 Qd8 29. Qg3 Re7 30. h4 Rbb7 31. e6 Rbc7 32. Qe5 Qe8
33. a4 Qd8 34. R1f2 Qe8 35. R2f3 Qd8 36. Bd3 Qe8 37. Qe4 Nf6 38. Rxf6 gxf6
39. Rxf6 Kg8 40. Bc4 Kh8 41. Qf4 1-0
`,
    narrative:
      `Going into Reykjavík, Bobby Fischer had not played a competitive game in nearly three years. He arrived in Iceland late, forfeited game two over a complaint about cameras, and lost game one outright. Down two to nothing in a match where draws scored half, the situation was openly described as hopeless.

In game six, Fischer surprised the chess world by opening 1. c4 — the English Opening — for the first time in his career. He had never used it competitively. From a Queen's Gambit Tartakower setup, he played a positional masterpiece: the bishop pair worked patiently against Spassky's hanging pawns, 14. Bb5! pinned the long-term structural weakness, 26. f5! finally broke through, and 37. Qe4! delivered the decisive blow. Spassky resigned move 41 after 41. Qf4 — and then stood up, walked over to Fischer, and applauded along with the audience.

The image of the reigning World Champion clapping for his challenger is one of the most-cited moments of sportsmanship in chess history. For Fischer, it was the first game he had ever won from Spassky in a serious encounter.`,
    outcome:
      `Fischer went on to win the match 12½–8½, ending 24 years of unbroken Soviet dominance of the world title. Game 6 was the psychological turning point; Spassky lost the title and never again challenged for it.`,
    keyMoments: [
      { ply: 27, label: '14. Bb5! — pinning the future weakness' },
      { ply: 51, label: '26. f5! — the breakthrough' },
      { ply: 73, label: '37. Qe4! — winning move' },
      { ply: 81, label: '41. Qf4 — Spassky resigns and applauds' },
    ],
  },
  {
    id: 'kasparovs-immortal',
    title: "Kasparov's Immortal — vs Topalov, Wijk aan Zee 1999",
    players: { white: 'Garry Kasparov', black: 'Veselin Topalov', whiteElo: 2812, blackElo: 2700 },
    event: 'Hoogovens Wijk aan Zee',
    site: 'Wijk aan Zee',
    date: '1999.01.20',
    round: '4',
    result: '1-0',
    era: 'contemporary',
    tags: ['Brilliancy', 'King Hunt', 'Pirc Defense', 'Kasparov'],
    pgn: `[Event "Hoogovens"]
[Site "Wijk aan Zee NED"]
[Date "1999.01.20"]
[Round "4"]
[White "Garry Kasparov"]
[Black "Veselin Topalov"]
[Result "1-0"]

1. e4 d6 2. d4 Nf6 3. Nc3 g6 4. Be3 Bg7 5. Qd2 c6 6. f3 b5 7. Nge2 Nbd7
8. Bh6 Bxh6 9. Qxh6 Bb7 10. a3 e5 11. O-O-O Qe7 12. Kb1 a6 13. Nc1 O-O-O
14. Nb3 exd4 15. Rxd4 c5 16. Rd1 Nb6 17. g3 Kb8 18. Na5 Ba8 19. Bh3 d5
20. Qf4+ Ka7 21. Rhe1 d4 22. Nd5 Nbxd5 23. exd5 Qd6 24. Rxd4 cxd4 25. Re7+ Kb6
26. Qxd4+ Kxa5 27. b4+ Ka4 28. Qc3 Qxd5 29. Ra7 Bb7 30. Rxb7 Qc4 31. Qxf6 Kxa3
32. Qxa6+ Kxb4 33. c3+ Kxc3 34. Qa1+ Kd2 35. Qb2+ Kd1 36. Bf1 Rd2 37. Rd7 Rxd7
38. Bxc4 bxc4 39. Qxh8 Rd3 40. Qa8 c3 41. Qa4+ Ke1 42. f4 f5 43. Kc1 Rd2
44. Qa7 1-0
`,
    narrative:
      `Kasparov was world champion, in form, and on move 24 of round four at Wijk aan Zee played 24. Rxd4!! — a rook sacrifice followed immediately by another (25. Re7+) launching the king hunt that defined modern attacking chess. Topalov's king is drawn out of the Q-side fortress: from b8 to a7 to b6 to a5 to a4 to a3 — and finally, after 33. c3+, to c3 itself, surrounded by white pieces with no shelter on any rank or file.

The technical demand of the combination is unusual: even after the second rook sacrifice, the win requires a sequence of quiet preparation moves (36. Bf1!) interleaved with the king-chasing checks. Kasparov played the entire line in classical time control with calm assurance. The Norwegian grandmaster Simen Agdestein called it "the greatest game of chess ever played in a tournament" the next day; few rebutted him.

Kasparov himself remembered it in his memoirs as a special moment: "I had a feeling that everything I had learned about chess was justified in this single game."`,
    outcome:
      `Kasparov won the Wijk aan Zee tournament that year. The game is universally cited as the apex of his attacking play and is often called the greatest game of the 20th century. Topalov, despite the loss, went on to be the FIDE World Champion in 2005.`,
    keyMoments: [
      { ply: 47, label: '24. Rxd4!! — the first rook sacrifice' },
      { ply: 49, label: '25. Re7+ — the king hunt begins' },
      { ply: 63, label: '32. Qxa6+ — second wave' },
      { ply: 71, label: '36. Bf1! — the quiet move' },
      { ply: 87, label: '44. Qa7 — resigns' },
    ],
  },
];

export function findGame(id: string): FamousGame | undefined {
  return GAMES.find((g) => g.id === id);
}

/**
 * Dev-time validator. Re-walks every PGN through chess.js to confirm it
 * parses cleanly, and bounds-checks every keyMoment ply against the
 * resulting move count. Console.warns on any failure. Stripped from
 * production via the import.meta.env.DEV gate.
 */
function validateGames(games: FamousGame[]): void {
  for (const g of games) {
    let moveCount = 0;
    try {
      const c = new Chess();
      c.loadPgn(g.pgn, { strict: false });
      moveCount = c.history().length;
    } catch (e) {
      console.warn(`[games] ${g.id}: PGN failed to parse — ${(e as Error).message}`);
      continue;
    }
    for (const km of g.keyMoments) {
      if (km.ply < 0 || km.ply > moveCount) {
        console.warn(
          `[games] ${g.id}: keyMoment ply ${km.ply} out of range 0..${moveCount} (label: "${km.label}")`,
        );
      }
    }
  }
}

if (import.meta.env.DEV) {
  validateGames(GAMES);
}

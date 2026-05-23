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
  /** Per-move annotations. Key is 0-indexed move position (matches MoveNote's
   *  `ply - 1` lookup pattern used for openings). Sparse — only the moves
   *  worth talking about. */
  moveNotes?: Record<number, string>;
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
    moveNotes: {
      32: "Anderssen offers his bishop on c5 — but the rook on a1 is also hanging to ...Qxa1+. The cascade begins.",
      34: "Bd6!! — the second rook is offered. Black greedily accepts: 18...Bxg1.",
      40: "Nxg7+ — undermining the back rank. The king must come to d8.",
      42: "Qf6+!! — the queen sacrifices herself to clear the e-file for the bishops.",
      44: "Be7# — checkmate by three minor pieces against a king whose queen and rooks are still on the board.",
    },
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
    moveNotes: {
      32: "Nf6+ — the knight is offered to weaken the king's pawn cover.",
      36: "Rad1 — every white piece is in position.",
      38: "Rxe7+ — deflecting Black's only defender.",
      40: "Qxd7+!! — the famous queen sacrifice. After 21...Kxd7, the bishops sweep the dark squares.",
      46: "Bxe7# — the position the game is named for.",
    },
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
    moveNotes: {
      18: "Nxb5! — the knight is given up to expose the queenside.",
      24: "Rxd7 — the rook is offered to deflect the defender.",
      30: "Qb8+!! — the queen sacrifice that has been on every coach's whiteboard for 167 years.",
      32: "Rd8# — smothered mate, with Black's own pieces sealing the king in.",
    },
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
      { ply: 22, label: '11...Na4!! — the offer that started it all' },
      { ply: 34, label: '17...Be6!! — the queen sacrifice appears' },
      { ply: 35, label: '18. Bxb6 — Byrne accepts' },
      { ply: 47, label: "24. Qb4 Ra4 — Fischer's pieces swarm" },
      { ply: 82, label: '41...Rc2# — mate' },
    ],
    moveNotes: {
      21: "Na4!! — Fischer offers the knight to crack the queenside open.",
      33: "Be6!! — the queen sacrifice. White must accept or lose more material.",
      34: "Bxb6 — Byrne accepts the queen, and the long forced sequence begins.",
      46: "Qb4 Ra4 — Fischer's pieces swarm Byrne's king.",
      81: "Rc2# — mate, sixteen moves after the queen was offered. Fischer was 13.",
    },
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
    moveNotes: {
      26: "Bb5! — Fischer pins what will become Black's long-term weakness.",
      50: "f5! — the breakthrough Fischer has been preparing since move 14.",
      72: "Qe4! — the winning move. Black has no defense to Rxf6.",
      80: "Qf4 — and Spassky resigns. He stood up and applauded Fischer along with the audience.",
    },
  },
  {
    id: 'karpov-kasparov-1985-g16',
    title: 'Karpov vs Kasparov — Game 16, 1985 World Championship',
    players: { white: 'Anatoly Karpov', black: 'Garry Kasparov', whiteElo: 2720, blackElo: 2700 },
    event: 'World Championship Match',
    site: 'Moscow',
    date: '1985.10.15',
    round: '16',
    result: '0-1',
    era: 'contemporary',
    tags: ['World Championship', 'Sicilian Najdorf', 'Octopus knight', 'Kasparov'],
    pgn: `[Event "World Championship Match"]
[Site "Moscow"]
[Date "1985.10.15"]
[Round "16"]
[White "Anatoly Karpov"]
[Black "Garry Kasparov"]
[Result "0-1"]

1. e4 c5 2. Nf3 e6 3. d4 cxd4 4. Nxd4 Nc6 5. Nb5 d6 6. c4 Nf6 7. N1c3 a6
8. Na3 d5 9. cxd5 exd5 10. exd5 Nb4 11. Be2 Bc5 12. O-O O-O 13. Bf3 Bf5
14. Bg5 Re8 15. Qd2 b5 16. Rad1 Nd3 17. Nab1 h6 18. Bh4 b4 19. Na4 Bd6
20. Bg3 Rc8 21. b3 g5 22. Bxd6 Qxd6 23. g3 Nd7 24. Bg2 Qf6 25. a3 a5
26. axb4 axb4 27. Qa2 Bg6 28. d6 g4 29. Qd2 Kg7 30. f3 Qxd6 31. fxg4 Qd4+
32. Kh1 Nf6 33. Rf4 Ne4 34. Qxd3 Nf2+ 35. Rxf2 Bxd3 36. Rfd2 Qe3 37. Rxd3 Rc1
38. Nb2 Qf2 39. Nd2 Rxd1+ 40. Nxd1 Re1+ 0-1
`,
    narrative:
      `Going into game sixteen of the 1985 World Championship, Garry Kasparov trailed Anatoly Karpov by a point and had to make his Najdorf preparation count. What he produced — a knight planted on d3 from move sixteen onward, refusing every offer to be exchanged or chased — became one of the defining images of modern chess.

The opening is a sharp Taimanov-Najdorf line, but the position after 16...Nd3 is not really an opening anymore: it's a structural sacrifice of mobility for permanent piece activity. The black knight on d3 cannot be touched. White's queenside pieces (Nab1, Bg3) huddle around it; Karpov spends the next dozen moves trying to dislodge it and failing. By move 24 Kasparov has every minor piece on a great square and a passed d-pawn coming. Karpov, normally a positional master, has no plan.

The denouement is brisk. 33...Ne4! introduces a second piece into the attack; 34. Qxd3 surrenders the queen for the bishop — Karpov correctly judging that defending two heavy pieces against a coordinated minor-piece assault was hopeless. Nine moves later Kasparov delivered the simple 40...Re1+, and Karpov resigned the game.`,
    outcome:
      `Kasparov drew level in the match and, on November 9, 1985, defeated Karpov in game twenty-four to become — at twenty-two — the youngest World Chess Champion in history, ending Karpov's ten-year reign. The "octopus knight" on d3 has appeared in every monograph on the Najdorf since, and is the canonical example used to teach that piece activity outweighs material when no exchange is possible.`,
    keyMoments: [
      { ply: 32, label: '16...Nd3 — the knight lands on d3' },
      { ply: 33, label: '17. Nab1 — White cedes mobility to defend' },
      { ply: 66, label: '33...Ne4! — second piece joins the attack' },
      { ply: 67, label: '34. Qxd3 — Karpov gives up the queen' },
      { ply: 80, label: '40...Re1+ — and Karpov resigns' },
    ],
    moveNotes: {
      31: "Nd3 — the knight lands on the famous square and will not be moved for the rest of the game. Every white piece must work around it.",
      32: "Nab1 — Karpov retreats to defend, ceding the entire queenside to Kasparov's pieces.",
      65: "Ne4! — the second knight joins the attack. White's coordination collapses.",
      66: "Qxd3 — Karpov gives up his queen for the bishop, judging that defending two pieces against a coordinated minor assault was hopeless.",
      79: "Re1+ — and Karpov resigns. Eight games later, Kasparov is World Champion at 22.",
    },
  },
  {
    id: 'kasparov-deep-blue-1997-g6',
    title: 'Kasparov vs Deep Blue — Game 6, 1997 Match',
    players: { white: 'Deep Blue', black: 'Garry Kasparov', blackElo: 2785 },
    event: 'IBM Man vs Machine, Game 6',
    site: 'New York',
    date: '1997.05.11',
    round: '6',
    result: '1-0',
    era: 'engine',
    tags: ['Man vs Machine', 'Caro-Kann', 'Knight sacrifice', 'Historic'],
    pgn: `[Event "IBM Man vs Machine"]
[Site "New York"]
[Date "1997.05.11"]
[Round "6"]
[White "Deep Blue"]
[Black "Garry Kasparov"]
[Result "1-0"]

1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Nd7 5. Ng5 Ngf6 6. Bd3 e6 7. N1f3 h6
8. Nxe6 Qe7 9. O-O fxe6 10. Bg6+ Kd8 11. Bf4 b5 12. a4 Bb7 13. Re1 Nd5
14. Bg3 Kc8 15. axb5 cxb5 16. Qd3 Bc6 17. Bf5 exf5 18. Rxe7 Bxe7 19. c4 1-0
`,
    narrative:
      `On May 11, 1997, in the thirty-fifth-floor TV studio of the Equitable Building in midtown Manhattan, Garry Kasparov sat down to play the sixth and deciding game of his rematch with IBM's Deep Blue. The match was tied 2½–2½. Game six lasted nineteen moves and changed the public understanding of computer chess overnight.

Kasparov chose the Caro-Kann, an opening he had not used in serious play for years — and, fatefully, allowed the well-known 7...h6 move-order trap. Deep Blue immediately played 8. Nxe6!, a known but unusual piece sacrifice for two pawns and a permanent disruption of the black king. Kasparov's twentieth-century chess instincts told him the sacrifice was unsound; his preparation told him it had been refuted; the computer's preparation told it otherwise. By move 19 Kasparov resigned a position in which he was hopelessly tied down and would lose more material.

The press conference that followed was historic. Kasparov accused IBM of human intervention, demanded the engine's logs (which IBM declined to release), and called the loss "psychologically broken." IBM dismantled Deep Blue and never publicly tested it again. The match score was 3½–2½ to the machine — the first time a reigning World Champion had lost a match to a computer under classical time controls.`,
    outcome:
      `Deep Blue's victory is now considered the symbolic moment when computer chess passed the human apex. IBM retired the machine; Kasparov spent years writing about the experience, eventually publishing Deep Thinking in 2017. Twenty years on, even smartphone-strength engines routinely outplay grandmasters. The 1997 rematch is the game-six PGN every history of artificial intelligence cites.`,
    keyMoments: [
      { ply: 14, label: "7...h6 — Kasparov walks into a known trap" },
      { ply: 15, label: '8. Nxe6! — the piece sacrifice' },
      { ply: 19, label: '10. Bg6+ — the black king is stranded on d8' },
      { ply: 35, label: '18. Rxe7 — the final blow' },
      { ply: 37, label: '19. c4 — Kasparov resigns' },
    ],
    moveNotes: {
      13: "h6 — Kasparov, possibly believing the line was refuted, walks straight into the trap. The sacrifice on e6 is now nearly forced.",
      14: "Nxe6! — Deep Blue spends two pawns to permanently fracture the black king position. Engines of the era could see the long-term coordination problem; Kasparov had hoped the machine wouldn't.",
      18: "Bg6+ — the king is forced to d8 with no way to castle. Black's queen, rooks, and bishop are tangled together.",
      34: "Rxe7 — Deep Blue cashes the attack. Black's structure collapses.",
      36: "c4 — and Kasparov resigns. The match is 3½–2½ to the machine.",
    },
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
    moveNotes: {
      46: "Rxd4!! — the first rook sacrifice. Topalov's d4 pawn falls, but the price is the rook.",
      48: "Re7+ — the king hunt begins. Topalov's king will travel from b8 to d1 before resigning.",
      62: "Qxa6+ — the second wave. Kasparov calculated this entire line at classical time control.",
      70: "Bf1! — the quiet move that ties up the king. Often called the most beautiful single move in the game.",
      86: "Qa7 — and Topalov resigns. The king has been driven across the entire board.",
    },
  },
  {
    id: 'steinitz-bardeleben',
    title: 'Steinitz vs von Bardeleben — Hastings 1895',
    players: { white: 'Wilhelm Steinitz', black: 'Curt von Bardeleben' },
    event: 'Hastings 1895',
    site: 'Hastings',
    date: '1895.08.17',
    round: '8',
    result: '1-0',
    era: 'classical',
    tags: ['Brilliancy', 'Pin', 'Italian Game', 'Hastings 1895'],
    pgn: `[Event "Hastings"]
[Site "Hastings"]
[Date "1895.08.17"]
[Round "8"]
[White "Wilhelm Steinitz"]
[Black "Curt von Bardeleben"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4 exd4 6. cxd4 Bb4+ 7. Nc3 d5
8. exd5 Nxd5 9. O-O Be6 10. Bg5 Be7 11. Bxd5 Bxd5 12. Nxd5 Qxd5 13. Bxe7 Nxe7
14. Re1 f6 15. Qe2 Qd7 16. Rac1 c6 17. d5 cxd5 18. Nd4 Kf7 19. Ne6 Rhc8
20. Qg4 g6 21. Ng5+ Ke8 22. Rxe7+ Kf8 23. Rf7+ Kg8 24. Rg7+ Kh8 25. Rxh7+ 1-0
`,
    narrative:
      `Round 8 of Hastings 1895 — the strongest tournament of the 19th century — was Wilhelm Steinitz's chance to demonstrate that the deposed champion still had teeth. He sacrificed in the open, lured the Black king to f8, and built up an attack that could not be parried with normal moves.

The position after 22. Rxe7+ Kf8 is one of the most-pictured in chess. White's rook is pinned, both Black rooks and the queen are doing nothing, and yet there is no defense. 23. Rf7+ Kg8 24. Rg7+ Kh8 25. Rxh7+!! — the rook has been en prise for three consecutive moves. Black plays 25...Kxh7 and runs into 26. Qh4+, with mate in ten from the position.

But Black didn't play it. Curt von Bardeleben stood up, left the playing hall, and never returned. Steinitz, asked what would have happened, dictated the forced mate to the audience: 25...Kxh7 26.Qh4+ Kg7 27.Qh7+ Kf8 28.Qh8+ Ke7 29.Qg7+ Ke8 30.Qg8+ Ke7 31.Qf7+ Kd8 32.Qf8+ Qe8 33.Nf7+ Kd7 34.Qd6#. The brilliancy prize was awarded.`,
    outcome:
      `Steinitz, by then 59, finished fifth in the tournament behind Pillsbury, Chigorin, Lasker, and Tarrasch. The combination, however, became a textbook entry — the canonical example of a "pin so deep the pinned piece can be moved with check three times in a row."`,
    keyMoments: [
      { ply: 41, label: '21. Ng5+ — the king is forced to e8' },
      { ply: 43, label: '22. Rxe7+ — the rook is pinned but untouchable' },
      { ply: 45, label: '23. Rf7+ — and again' },
      { ply: 47, label: '24. Rg7+ — and again' },
      { ply: 49, label: '25. Rxh7+!! — von Bardeleben left the hall' },
    ],
    moveNotes: {
      40: "Ng5+ — Black's king is forced to e8 with no safe squares.",
      42: "Rxe7+ — the rook is en prise but the pin makes it untouchable: ...Kxe7 walks into Re1+ winning the queen.",
      44: "Rf7+ — Steinitz keeps the king on the move.",
      46: "Rg7+ — the rook is *still* en prise, three moves in a row.",
      48: "Rxh7+!! — now this rook is offered too. Black is mated in 10 from any reply. Von Bardeleben left the playing hall rather than play it out.",
    },
  },
  {
    id: 'capa-tartakower',
    title: 'Capablanca vs Tartakower — New York 1924',
    players: { white: 'José Raúl Capablanca', black: 'Savielly Tartakower' },
    event: 'New York 1924',
    site: 'New York',
    date: '1924.03.23',
    round: '16',
    result: '1-0',
    era: 'classical',
    tags: ['Endgame', 'Rook endgame', 'King activation', 'New York 1924'],
    pgn: `[Event "New York"]
[Site "New York"]
[Date "1924.03.23"]
[Round "16"]
[White "Jose Raul Capablanca"]
[Black "Savielly Tartakower"]
[Result "1-0"]

1. d4 f5 2. Nf3 e6 3. c4 Nf6 4. Bg5 Be7 5. Nc3 O-O 6. e3 b6 7. Bd3 Bb7 8. O-O
Qe8 9. Qe2 Ne4 10. Bxe7 Nxc3 11. bxc3 Qxe7 12. a4 Bxf3 13. Qxf3 Nc6 14. Rfb1
Rae8 15. Qh3 Rf6 16. f4 Na5 17. Qf3 d6 18. Re1 Qd7 19. e4 fxe4 20. Qxe4 g6
21. g3 Kf8 22. Kg2 Rf7 23. h4 d5 24. cxd5 exd5 25. Qxe8+ Qxe8 26. Rxe8+ Kxe8
27. h5 Rf6 28. hxg6 hxg6 29. Rh1 Kf8 30. Rh7 Rc6 31. g4 Nc4 32. g5 Ne3+
33. Kf3 Nf5 34. Bxf5 gxf5 35. Kg3 Rxc3+ 36. Kh4 Rf3 37. g6 Rxf4+ 38. Kg5 Re4
39. Kf6 Kg8 40. Rg7+ Kh8 41. Rxc7 Re8 42. Kxf5 Re4 43. Kf6 Rf4+ 44. Ke5 Rg4
45. g7+ Kg8 46. Rxa7 Rg1 47. Kxd5 Rc1 48. Kd6 Rc2 49. d5 Rc1 50. Rc7 Ra1
51. Kc6 Rxa4 52. d6 1-0
`,
    narrative:
      `New York 1924 was the strongest tournament of the inter-war era — Lasker, Capablanca, Alekhine, Marshall, and Réti at the top boards. In round 16 Capablanca and Tartakower steered into a queen-trade endgame with only a slight imbalance in Capablanca's favor. What followed has been quoted in every endgame textbook since.

The decisive idea appears around move 30. White's king begins marching up the board: Kf3, Kg3, Kh4, Kg5, Kf6 — by move 39 the white king has reached f6, separated from its own pieces and devastating to Black's. The black rook can do nothing but check, and after each check the white king moves *forward*. The pawns roll.

Capablanca's own notes to the game in the tournament book taught generations the principle: in the endgame the king is a fighting piece. Botvinnik later cited it as one of the earliest models of "positional clarity."`,
    outcome:
      `Capablanca finished second in New York 1924, half a point behind Emanuel Lasker. The endgame entered every standard treatment of the subject — including Capablanca's own Chess Fundamentals — and remains the canonical example of an active king in a rook ending.`,
    keyMoments: [
      { ply: 59, label: '30. Rh7 — White penetrates the seventh rank' },
      { ply: 71, label: '36. Kh4 — the king begins to march' },
      { ply: 75, label: '38. Kg5 — king pushes into enemy territory' },
      { ply: 77, label: '39. Kf6 — the king is now winning the game alone' },
      { ply: 89, label: '45. g7+ — the pawns promote, Black resigns soon after' },
    ],
    moveNotes: {
      58: "Rh7 — White's rook penetrates the seventh rank.",
      70: "Kh4 — Capablanca's king begins the march. With queens off, the king is the strongest active piece.",
      74: "Kg5 — the king pushes further into Black's territory.",
      76: "Kf6 — the king is now winning the game by itself. Black's king is cut off.",
      88: "g7+ — and the pawn promotes, while the king mops up.",
    },
  },
  {
    id: 'alphazero-stockfish',
    title: 'AlphaZero vs Stockfish 8 — Game 10, December 2017',
    players: { white: 'AlphaZero', black: 'Stockfish 8' },
    event: 'DeepMind demonstration',
    site: 'London (offline)',
    date: '2017.12.04',
    round: '10',
    result: '1-0',
    era: 'engine',
    tags: ['AI', 'Engine match', 'Positional bind', 'Catalan'],
    pgn: `[Event "DeepMind demonstration"]
[Site "London"]
[Date "2017.12.04"]
[Round "10"]
[White "AlphaZero"]
[Black "Stockfish 8"]
[Result "1-0"]

1. Nf3 Nf6 2. c4 b6 3. d4 e6 4. g3 Ba6 5. Qc2 Bb7 6. Bg2 c5 7. d5 exd5
8. cxd5 Nxd5 9. O-O Be7 10. Rd1 Nc6 11. Qf5 Nf6 12. e4 g6 13. Qf4 O-O 14. e5
Nh5 15. Qg4 Re8 16. Nc3 Qb8 17. Nd5 Bf8 18. Bf4 Qc8 19. h3 Ne7 20. Ne3 Bc6
21. Rd6 Ng7 22. Rf6 Qb7 23. Bh6 Nd5 24. Nxd5 Bxd5 25. Rd1 Ne6 26. Bxf8 Rxf8
27. Qh4 Bc6 28. Qh6 Rae8 29. Rd6 Bxf3 30. Bxf3 Qa6 31. h4 Qa5 32. Rd1 c4
33. Rd5 Qe1+ 34. Kg2 c3 35. bxc3 Qxc3 36. h5 Re7 37. Bd1 Qe1 38. Bb3 Rd8
39. Rf3 Qe4 40. Qd2 Qg4 41. Bd1 Qe4 42. h6 Nc7 43. Rd6 Ne6 44. Bb3 Qxe5
45. Rd5 Qh8 46. Qb4 Nc5 47. Rxc5 bxc5 48. Qh4 Rde8 49. Rf6 Rf8 50. Qf4 a5
51. g4 d5 52. Bxd5 Rd7 53. Bc4 a4 54. g5 a3 55. Qf3 Rc7 56. Qxa3 Qxf6
57. gxf6 Rfc8 58. Qd3 Rf8 59. Qd6 Rfc8 60. a4 1-0
`,
    narrative:
      `In December 2017, DeepMind's AlphaZero — having taught itself chess from the rules alone in nine hours of self-play — was matched against the reigning Top Computer Chess Championship winner, Stockfish 8. Of 100 games at one-minute increments, AlphaZero won 28 and drew 72; it lost none.

Game 10 of the published match is the example most chess players returned to. AlphaZero plays a Catalan, gives up a pawn for development, and then — in moves no human or engine had been seen to make — locks Stockfish's queenside pieces in a paralytic embrace. The critical sequence is moves 21–23: White plants a rook on d6 (21.Rd6), shifts it to f6 (22.Rf6), and brings the bishop to h6 (23.Bh6), all with no immediate threat. Stockfish can't move without losing.

Commentators called the style "alien," "aesthetic," and "human-like" — sometimes in the same paragraph. What it certainly was: a demonstration that the search-and-evaluate approach dominant in computer chess for forty years had been quietly surpassed by neural networks trained without any human chess knowledge.`,
    outcome:
      `AlphaZero never played a public tournament. Its games were published as a research paper and a small book; the engine itself was retired. Its conceptual successor, Leela Chess Zero, became open-source and competitive at the top of computer chess. The match changed how engine chess is described — and influenced opening preparation, prophylaxis, and pawn-structure ideas across the elite human game.`,
    keyMoments: [
      { ply: 41, label: '21. Rd6 — the rook is plopped where it "should" be lost' },
      { ply: 43, label: '22. Rf6 — and shifted with no immediate threat' },
      { ply: 45, label: '23. Bh6 — the bind is complete' },
      { ply: 51, label: '26. Bxf8 — the trade pays off' },
      { ply: 119, label: '60. a4 — patience wins; Stockfish resigns' },
    ],
    moveNotes: {
      40: "Rd6 — the rook is plopped on a square where, by all standard evaluation, it should be lost. AlphaZero saw deeper.",
      42: "Rf6 — and the rook is moved to f6 with no immediate threat. Stockfish's pieces cannot organize.",
      50: "Bxf8 — finally a concrete trade. AlphaZero's bind has paid off.",
      118: "a4 — patient maneuvering wins. AlphaZero never relinquished the initiative.",
    },
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
    // moveNotes keys are 0-indexed (ply - 1), so the valid range is
    // 0..moveCount-1. Anything beyond points to a move that doesn't exist.
    if (g.moveNotes) {
      for (const key of Object.keys(g.moveNotes)) {
        const n = Number(key);
        if (n < 0 || n >= moveCount) {
          console.warn(
            `[games] ${g.id}: moveNote at index ${n} out of range 0..${moveCount - 1}`,
          );
        }
      }
    }
  }
}

if (import.meta.env.DEV) {
  validateGames(GAMES);
}

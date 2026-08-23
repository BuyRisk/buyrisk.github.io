/**
 * Bias Arcade result store: one localStorage record per game, so the profile
 * radar and the game cards survive reloads. Deliberately tiny — no accounts,
 * no sync, clearable in one click (the site-wide "nothing stored" promise
 * bends here only as far as the visitor's own browser).
 */

export interface GameResult {
  gameId: string;
  /** 0 (immune) – 100 (textbook susceptible). */
  score: number;
  /** One-line personal result, e.g. "4 of 10 inside your 90% ranges". */
  headline: string;
  playedAt: number;
}

export interface GameMeta {
  id: string;
  /** Spoiler-free card title shown BEFORE playing. */
  title: string;
  /** Spoiler-free teaser. */
  teaser: string;
  /** The bias, revealed after play. */
  bias: string;
  /** ~1 minute? for the card. */
  minutes: number;
}

const KEY = "buy-risk-bias-arcade-v1";

export function loadResults(): Record<string, GameResult> {
  if (typeof localStorage === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function saveResult(r: GameResult): Record<string, GameResult> {
  const all = loadResults();
  all[r.gameId] = r;
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* private mode etc. — session-only is fine */
  }
  return all;
}

export function clearResults(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export const GAMES: GameMeta[] = [
  {
    id: "calibration",
    title: "How sure are you?",
    teaser: "Ten questions about market history. You don't need to know the answers — you need to know how much you don't.",
    bias: "Overconfidence",
    minutes: 3,
  },
  {
    id: "anchoring",
    title: "The wheel",
    teaser: "Spin a number, then estimate. The number is meaningless. Or is it?",
    bias: "Anchoring",
    minutes: 2,
  },
  {
    id: "loss",
    title: "Flip or fold",
    teaser: "A series of coin-flip bets. Find the point where you say yes — it measures something about you.",
    bias: "Loss aversion",
    minutes: 2,
  },
  {
    id: "endowment",
    title: "Yours to sell",
    teaser: "Some lottery tickets to price — a couple you own, a couple you don't. Surely that doesn't matter.",
    bias: "The endowment effect",
    minutes: 2,
  },
  {
    id: "disposition",
    title: "Sell something",
    teaser: "You need cash, and something in the portfolio has to go. Six rounds. Choose.",
    bias: "The disposition effect",
    minutes: 3,
  },
  {
    id: "patterns",
    title: "Real or random?",
    teaser: "Some of these charts are the actual US market. Some are coin flips. Tell them apart.",
    bias: "Pattern-seeking (hot hand & gambler's fallacy)",
    minutes: 3,
  },
  {
    id: "herding",
    title: "The crowd",
    teaser: "Answer a few questions — then see what a thousand other players said. Stand firm, or reconsider?",
    bias: "Herding (social proof)",
    minutes: 2,
  },
  {
    id: "framing",
    title: "Two funds",
    teaser: "A few quick investment choices. Read carefully — or don't; most people don't.",
    bias: "Framing",
    minutes: 2,
  },
  {
    id: "sunk",
    title: "The money you already spent",
    teaser: "Four decisions about what to do next. The past will try to vote.",
    bias: "The sunk-cost fallacy",
    minutes: 2,
  },
  {
    id: "outcome",
    title: "Good call?",
    teaser: "Judge four investors' decisions. You'll only get part of the story — like real life.",
    bias: "Outcome bias",
    minutes: 2,
  },
  {
    id: "hindsight",
    title: "You knew it all along",
    teaser: "Four real market episodes. How predictable were they, really? Careful — this one plays dirty.",
    bias: "Hindsight bias",
    minutes: 3,
  },
];

import { useState, type ReactNode } from "react";
import type { GameResult } from "./store";

/**
 * Shared engine for the vignette games (framing, sunk cost, outcome bias).
 * Each game is pairs of logically-linked scenarios, separated in the running
 * order so the link isn't obvious. Options are ordered so the SAME index is
 * the logically-consistent answer across a pair — an index mismatch within a
 * pair is one count of the bias. Score = inconsistent pairs / pairs.
 */

export interface Vignette {
  id: string;
  pair: string;
  text: string;
  options: [string, string];
}

export interface VignetteConfig {
  gameId: string;
  items: Vignette[]; // pair members must NOT be adjacent
  headline: (inconsistent: number, pairs: number) => string;
  reveal: (inconsistent: number, pairs: number, answers: Record<string, number>) => ReactNode;
}

export default function VignetteGame({ config, onDone }: { config: VignetteConfig; onDone: (r: GameResult) => void }) {
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [finished, setFinished] = useState(false);

  const items = config.items;
  const pairs = new Set(items.map((v) => v.pair)).size;

  const choose = (idx: number) => {
    const next = { ...answers, [items[i].id]: idx };
    setAnswers(next);
    if (i + 1 < items.length) {
      setI(i + 1);
    } else {
      setFinished(true);
      let inconsistent = 0;
      for (const pair of new Set(items.map((v) => v.pair))) {
        const members = items.filter((v) => v.pair === pair);
        if (next[members[0].id] !== next[members[1].id]) inconsistent++;
      }
      onDone({
        gameId: config.gameId,
        score: Math.round((inconsistent / pairs) * 100),
        headline: config.headline(inconsistent, pairs),
        playedAt: Date.now(),
      });
    }
  };

  if (finished) {
    let inconsistent = 0;
    for (const pair of new Set(items.map((v) => v.pair))) {
      const members = items.filter((v) => v.pair === pair);
      if (answers[members[0].id] !== answers[members[1].id]) inconsistent++;
    }
    return <div className="ba-reveal">{config.reveal(inconsistent, pairs, answers)}</div>;
  }

  const v = items[i];
  return (
    <div className="ba-play">
      <p className="ba-progress">Scenario {i + 1} of {items.length}</p>
      <p className="ba-question">{v.text}</p>
      <div className="ba-choicecol">
        <button type="button" className="wl-btn" onClick={() => choose(0)}>{v.options[0]}</button>
        <button type="button" className="wl-btn" onClick={() => choose(1)}>{v.options[1]}</button>
      </div>
    </div>
  );
}

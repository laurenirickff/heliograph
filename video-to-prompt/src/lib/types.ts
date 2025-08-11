export type ActionType =
  | "navigate"
  | "click"
  | "type"
  | "wait"
  | "verify"
  | "select"
  | "conditional";

export interface WaitCondition {
  description?: string;
  visualCue?: string;
}

export interface TargetInfo {
  description: string;
  visualContext?: string;
  possibleSelectors?: string[];
}

export interface Action {
  action: ActionType;
  target?: TargetInfo;
  value?: string;
  narrationContext?: string;
  businessLogic?: string;
  waitCondition?: WaitCondition;
  // In lenient mode, unknown keys captured during normalization are preserved here
  extras?: Record<string, unknown>;
}

export type NormalizeMode = "strict" | "lenient" | "none";


// --------------------
// Generation/Decider/IRV types
// --------------------

export type GeneratorOutput = {
  index: number; // 0..N-1
  text: string; // free-form content
};

export type DeciderPerCandidate = {
  index: number;
  strengths?: string[];
  issues?: string[];
};

// Simplified decider vote: rank ONLY acceptable candidates. No thumbs up field.
export type DeciderVote = {
  ranking: number[]; // strict order of acceptable indices only
  perCandidate?: DeciderPerCandidate[];
};

export type AggregateDecision = {
  hasAnyAcceptable: boolean;
  acceptableCounts: number[]; // length N; counts of deciders who ranked each candidate
  winnerIndex: number | null; // final selection or null if no consensus
  wasTieBroken: boolean;
  rationale: string[]; // brief machine-readable bullets
};

export type AnalyzeSuccess = {
  prompt: string; // chosen free-form text
  meta: {
    chosenIndex: number;
    acceptableCounts: number[]; // per candidate
    deciderRankingSnapshots: number[][]; // each decider’s ranking array (canonical indices)
    wasTieBroken: boolean;
  };
};

export type AnalyzeFallback = {
  prompt: string; // concatenated outputs with dividers for download/UI display
  meta: {
    acceptableCounts: number[];
    deciderRankingSnapshots: number[][];
    reason: string; // short note (e.g., "No consensus")
  };
};


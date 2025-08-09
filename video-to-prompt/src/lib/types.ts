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



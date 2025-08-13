// Lightweight pricing and estimation helpers.
// Rates are approximate and should be adjusted as needed.

export type PricingSpec = {
  inputPerKTokensUSD: number; // $ per 1K input tokens
  outputPerKTokensUSD: number; // $ per 1K output tokens
  videoPerMinuteUSD: number; // $ per processed video minute
};

export const MODEL_PRICING: Record<string, PricingSpec> = {
  "gemini-2.5-flash": {
    inputPerKTokensUSD: 0.0006,
    outputPerKTokensUSD: 0.0009,
    videoPerMinuteUSD: 0.006,
  },
  "gemini-2.5-flash-lite": {
    inputPerKTokensUSD: 0.00035,
    outputPerKTokensUSD: 0.00053,
    videoPerMinuteUSD: 0.003,
  },
  "gemini-2.5-pro": {
    inputPerKTokensUSD: 0.0035,
    outputPerKTokensUSD: 0.0053,
    videoPerMinuteUSD: 0.02,
  },
  "gemini-1.5-pro": {
    inputPerKTokensUSD: 0.0035,
    outputPerKTokensUSD: 0.0053,
    videoPerMinuteUSD: 0.02,
  },
};

export type EstimateBreakdown = {
  generatorsUSD: number;
  evaluatorsUSD: number;
  totalUSD: number;
  details: {
    generator: { perCall: { videoUSD: number; inUSD: number; outUSD: number; totalUSD: number }; totalUSD: number };
    evaluator: { perCall: { inUSD: number; outUSD: number; totalUSD: number }; totalUSD: number };
    tokens: {
      promptTokens: number;
      avgGeneratorOutTokens: number;
      evaluatorInTokensPerCall: number;
      evaluatorOutTokensPerCall: number;
    };
    videoMinutes: number;
  };
};

function tokensFromChars(charCount: number): number {
  // Rough heuristic: ~4 chars per token for English text
  return Math.max(0, Math.ceil(charCount / 4));
}

export function estimatePipelineCost(params: {
  videoDurationSec: number;
  generators: number;
  evaluators: number;
  generatorModel: string;
  evaluatorModel: string;
  promptText: string;
  evaluatorPromptBaseChars?: number; // length of evaluator system prompt in chars
  avgGeneratorOutTokens?: number; // average output tokens per generator
  avgEvaluatorOutTokens?: number; // average output tokens per evaluator response
}): EstimateBreakdown | null {
  const genSpec = MODEL_PRICING[params.generatorModel];
  const evalSpec = MODEL_PRICING[params.evaluatorModel];
  if (!genSpec || !evalSpec) return null;

  const N = Math.max(1, Math.min(10, Math.floor(params.generators)));
  const K = Math.max(1, Math.min(7, Math.floor(params.evaluators)));
  const videoMinutes = Math.max(0, params.videoDurationSec / 60);

  const promptTokens = tokensFromChars(params.promptText.length);
  const evalBaseTokens = tokensFromChars(params.evaluatorPromptBaseChars || 0);
  const avgGenOut = Math.max(1, Math.floor(params.avgGeneratorOutTokens ?? 800));
  const avgEvalOut = Math.max(1, Math.floor(params.avgEvaluatorOutTokens ?? 200));

  // Generator per-call costs: video + prompt input + output
  const genVideoUSD = videoMinutes * genSpec.videoPerMinuteUSD;
  const genInUSD = (promptTokens / 1000) * genSpec.inputPerKTokensUSD;
  const genOutUSD = (avgGenOut / 1000) * genSpec.outputPerKTokensUSD;
  const genPerCallUSD = genVideoUSD + genInUSD + genOutUSD;
  const genTotalUSD = genPerCallUSD * N;

  // Evaluator per-call input tokens: evaluator prompt base + original prompt + N * avgGenOut
  const evalInTokensPerCall = evalBaseTokens + promptTokens + N * avgGenOut;
  const evalInUSD = (evalInTokensPerCall / 1000) * evalSpec.inputPerKTokensUSD;
  const evalOutUSD = (avgEvalOut / 1000) * evalSpec.outputPerKTokensUSD;
  const evalPerCallUSD = evalInUSD + evalOutUSD;
  const evalTotalUSD = evalPerCallUSD * K;

  const totalUSD = genTotalUSD + evalTotalUSD;

  return {
    generatorsUSD: genTotalUSD,
    evaluatorsUSD: evalTotalUSD,
    totalUSD,
    details: {
      generator: {
        perCall: { videoUSD: genVideoUSD, inUSD: genInUSD, outUSD: genOutUSD, totalUSD: genPerCallUSD },
        totalUSD: genTotalUSD,
      },
      evaluator: {
        perCall: { inUSD: evalInUSD, outUSD: evalOutUSD, totalUSD: evalPerCallUSD },
        totalUSD: evalTotalUSD,
      },
      tokens: {
        promptTokens,
        avgGeneratorOutTokens: avgGenOut,
        evaluatorInTokensPerCall: evalInTokensPerCall,
        evaluatorOutTokensPerCall: avgEvalOut,
      },
      videoMinutes,
    },
  };
}

export function formatUSD(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return `$${rounded.toFixed(2)}`;
}



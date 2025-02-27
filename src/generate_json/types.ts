import { z } from "zod";
import type { TranslationStatsItem } from "../types";

export type GradeItem = {
    id: number;
    key: string;
    original: string;
    translated: string;
    context: string;
    gradingTokens: number;
    gradingAttempts: number;
    lastFailure: string;
    grading: GradingScaleItemOutput;
};

export type GradeItemOutput = {
    key: string;
    original: string;
    translated: string;
    grading: GradingScaleItemOutput;
};

export type ExportGradeItem = {
    gradeItems: GradeItemOutput[];
    gradingStats: GradingStats;
    translationStats: TranslationStatsItem;
};

export type GradeResult = {
    key: string;
    original: string;
    translated: string;
    grading: GradingScaleItemOutput;
};

export type GradeItemInput = {
    // order is important for prompt do not reorder
    id: number; // 1
    original: string; // 2
    translated: string; // 3
    context?: string; // 4
    lastFailure?: string; // 5
};

export type GradingScaleItemOutput = {
    id: number;
    think: string;
    accuracy: number;
    formatting: number;
    fluencyReadability: number;
    consistency: number;
    culturalAdaptation: number;
    valid: boolean;
};

export const GradingScaleItemOutputSchema = z.object({
    // 2
    accuracy: z.number(),

    // 5
    consistency: z.number(),

    // 6
    culturalAdaptation: z.number(),

    // 4
    fluencyReadability: z.number(),

    // 3
    formatting: z.number(),

    // order is important for prompt do not reorder
    id: z.number(),

    // 1
    think: z.string(), // 7
    valid: z.boolean(), // 8
});

export const GradingScaleItemOutputArraySchema = z.object({
    items: z
        .array(GradingScaleItemOutputSchema)
        .describe("GradingScaleItemOutputSchema"), // used for open ai schema name
});

export type GradingStats = {
    accuracyMean: number;
    formattingMean: number;
    fluencyReadabilityMean: number;
    consistencyMean: number;
    culturalAdaptationMean: number;
    totalMean: number;
    standardDeviation: number;
    variance: number;
    Q1: number;
    Q3: number;
    IQR: number;
    median: number;
    confidenceIntervalLow: number;
    confidenceIntervalHigh: number;
    lowestScore: number;
    highestScore: number;
    validPercent: number;
    totalScoreArray: number[];
};

export type GenerateStateJson = {
    fixedTranslationMappings: { [input: string]: string };
    translationToRetryAttempts: { [translation: string]: number };
    generationRetries: number;
};

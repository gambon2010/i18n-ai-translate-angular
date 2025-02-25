import { z } from "zod";

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

export type GradeResult = {
    key: string;
    original: string;
    translated: string;
    grading: GradingScaleItemOutput;
};

export type GradeItemInput = {
    id: number;
    original: string;
    translated: string;
    context?: string;
    lastFailure?: string;
};

export type GradingScaleItemOutput = {
    id: number;
    think: string;
    accuracy: number;
    formatting: number;
    fluencyReadability: number;
    consistency: number;
    culturalAdaptation: number;
};

export const GradingScaleItemOutputSchema = z.object({
    id: z.number(),
    think: z.string(),
    accuracy: z.number(),
    formatting: z.number(),
    fluencyReadability: z.number(),
    consistency: z.number(),
    culturalAdaptation: z.number(),
});

export const GradingScaleItemOutputArraySchema = z.object({
    items: z
        .array(GradingScaleItemOutputSchema)
        .describe("GradingScaleItemOutputSchema"), // used for open ai schema name
});

export type GenerateStateJson = {
    fixedTranslationMappings: { [input: string]: string };
    translationToRetryAttempts: { [translation: string]: number };
    generationRetries: number;
};

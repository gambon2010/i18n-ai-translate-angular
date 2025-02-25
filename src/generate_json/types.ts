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
    accuracy: {
        meaning: number;
        toneStyle: number;
        grammarSyntax: number;
    };
    formatting: {
        punctuationSpacing: number;
        capitalizationFormatting: number;
    };
    fluencyReadability: {
        naturalness: number;
        clarity: number;
    };
    consistency: {
        terminologyWordChoice: number;
    };
    culturalAdaptation: {
        localization: number;
    };
};

export const GradingScaleItemOutputSchema = z.object({
    id: z.number(),
    think: z.string(),
    accuracy: z.object({
        meaning: z.number(),
        toneStyle: z.number(),
        grammarSyntax: z.number(),
    }),
    formatting: z.object({
        punctuationSpacing: z.number(),
        capitalizationFormatting: z.number(),
    }),
    fluencyReadability: z.object({
        naturalness: z.number(),
        clarity: z.number(),
    }),
    consistency: z.object({
        terminologyWordChoice: z.number(),
    }),
    culturalAdaptation: z.object({
        localization: z.number(),
    }),
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

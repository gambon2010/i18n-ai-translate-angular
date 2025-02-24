import { z } from "zod";

export type TranslateItem = {
    id: number;
    key: string;
    original: string;
    translated: string;
    context: string;
    translationTokens: number;
    templateStrings: string[];
    translationAttempts: number;
    lastFailure: string;
};

// translation objects

export type TranslateItemInput = {
    id: number;
    original: string;
    context?: string;
    lastFailure?: string;
};

// Translate without think

export const TranslateItemOutputSchema = z.object({
    id: z.number(),
    translated: z.string(),
});

export const TranslateItemOutputObjectSchema = z.object({
    items: z
        .array(TranslateItemOutputSchema)
        .describe("TranslateItemOutputObjectSchema"), // used for open ai schema name
});

// Translate with think

export const ThinkTranslateItemOutputSchema = z.object({
    id: z.number(),
    think: z.string(),
    // .min(
    //     5,
    //     "Think field should be at least 5 characters long to give a meaningful reflection.",
    // ),
    translated: z.string(),
    // .min(1, "Translated field should not be empty."),
});

export const ThinkTranslateItemOutputObjectSchema = z.object({
    items: z
        .array(ThinkTranslateItemOutputSchema)
        .describe("TranslateItemOutputObjectSchema"), // used for open ai schema name
});

// Discard think

export type TranslateItemOutput = {
    id: number;
    translated: string;
};

export type TranslateItemOutputObject = {
    items: TranslateItemOutput[];
};

// verification objects

export type VerifyItemInput = {
    id: number;
    original: string;
    translated: string;
    context: string;
    lastFailure: string;
};

export const VerifyItemOutputSchema = z.object({
    // the order is important, having 'valid' and 'issue' before 'fixedTranslation' helps the LLM think and provide a better fix
    id: z.number(),
    valid: z.boolean(),
    issue: z.string(),
    fixedTranslation: z.string(),
});

export type VerifyItemOutput = {
    id: number;
    valid: boolean;
    issue: string;
    fixedTranslation: string;
};

export const VerifyItemOutputObjectSchema = z.object({
    items: z.array(VerifyItemOutputSchema).describe("VerifyItemOutputSchema"), // used for open ai schema name
});

export type VerifyItemOutputObject = {
    items: VerifyItemOutput[];
};

export type GenerateStateJson = {
    fixedTranslationMappings: { [input: string]: string };
    translationToRetryAttempts: { [translation: string]: number };
    generationRetries: number;
};

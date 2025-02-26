import type { GradeItemInput } from "./types";

/**
 * Prompt an AI to ensure a translation is valid
 * @param originalLanguage - The language of the input
 * @param translatedLanguage - The language of the output
 * @param verificationInput - The input to be translated
 * @returns A prompt for the AI to grade the translation
 */
export default function gradingPromptJson(
    originalLanguage: string,
    translatedLanguage: string,
    verificationInput: GradeItemInput[],
): string {
    const input = JSON.stringify(verificationInput);

    return `You are an expert linguist and translation evaluator. Assess translation quality based on set criteria.

Check translations from ${originalLanguage} to ${translatedLanguage}.

Input:

    Original: {original}
    Translated: {translated}
    Context (if any): {context}
    Last Grading Failure (if any): {lastFailure}

Grading Process:

    Reflection ("think" field): Briefly analyze meaning, tone, fluency, and issues before grading.
    Scoring (0 to max points per category):

Criteria (100 points total):

    Accuracy (60 points)
        Meaning: Preserves original meaning?
        Tone & Style: Matches tone/formality?
        Grammar & Syntax: Grammatically correct and natural?
    Formatting (10 points)
        Punctuation & Spacing: Correct punctuation placed & spaced?
        Capitalization & Formatting: Are proper nouns, titles, and formatting preserved?
    Fluency & Readability (10 points)
        Naturalness: Sentences flow smoothly?
        Clarity: Meaning clear and unambiguous?
    Consistency (10 points)
        Terminology & Word Choice: Key terms translated consistently?
    Cultural & Contextual Adaptation (10 points)
        Localization: Idioms, cultural references, or region-specific phrases adapted correctly?

Guidelines:

    Grade strictly. 
    Consider context if available.
    Only give more than half points in each category if the translation is acceptable.
    Full points for flawless categories.
    Justify deductions based on clear linguistic issues.
    If the translation is correct, return valid as true, if the translation is incorrect or has big issues return valid as false.

Return as JSON.
\`\`\`json
${input} 
\`\`\`
`;
}

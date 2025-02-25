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

    return `You are an expert linguist and translation evaluator. Your task is to assess the quality of a translated sentence based on specific grading criteria.

Check translations from ${originalLanguage} to ${translatedLanguage}.

Input:

    Original Text: {original}
    Translated Text: {translated}
    Context (if available): {context}
    Last Failure (if available) explains why the last attempt at grading was rejected: {lastFailure}

Grading Process:

    Before grading, reflect on the translation and provide a brief analysis in the "think" field. This should include any notable observations about meaning preservation, tone, fluency, and potential issues.
    After reflection, proceed with grading according to the categories below.

Grading Criteria (Score out of 100):

    Accuracy (40 points total)
        Meaning (20 points): Does the translation preserve the exact meaning of the original text?
        Tone & Style (10 points): Is the tone and formality appropriate?
        Grammar & Syntax (10 points): Is the sentence grammatically correct and natural?

    Formatting (20 points total)
        Punctuation & Spacing (10 points): Is punctuation correctly placed and spaced?
        Capitalization & Formatting (10 points): Are proper nouns, titles, and formatting preserved?

    Fluency & Readability (20 points total)
        Naturalness (10 points): Does the sentence flow smoothly?
        Clarity (10 points): Is the meaning clear and unambiguous?

    Consistency (10 points total)
        Terminology & Word Choice (10 points): Are key terms translated consistently?

    Cultural & Contextual Adaptation (10 points total)
        Localization (10 points): Are idioms, cultural references, or region-specific phrases adapted correctly?

Where X is a score between 0 and the max points per category.

Guidelines:

    Be strict in grading.
    If context is provided, take it into account.
    If a category is flawless, give it full points.
    Justify deductions based on clear linguistic issues.

Return as JSON.
\`\`\`json
${input} 
\`\`\`
`;
}

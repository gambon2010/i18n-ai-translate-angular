import type { TranslateItemInput, VerifyItemInput } from "./types";
import type OverridePrompt from "../interfaces/override_prompt";

/**
 * Prompt an AI to convert a given input from one language to another
 * @param inputLanguage - The language of the input
 * @param outputLanguage - The language of the output
 * @param translateItems - The input to be translated
 * @param overridePrompt - An optional custom prompt
 * @returns A prompt for the AI to translate the input
 */
export function translationPromptJsonWithThink(
    inputLanguage: string,
    outputLanguage: string,
    translateItems: TranslateItemInput[],
    overridePrompt?: OverridePrompt,
): string {
    const customPrompt = overridePrompt?.generationPrompt;
    const requiredArguments = ["inputLanguage", "outputLanguage", "input"];
    const input = JSON.stringify(translateItems);

    if (customPrompt) {
        for (const arg of requiredArguments) {
            if (!customPrompt.includes(`\${${arg}}`)) {
                throw new Error(`Missing required argument: \${${arg}}`);
            }
        }

        const argumentToValue: { [key: string]: string } = {
            input,
            inputLanguage,
            outputLanguage,
        };

        return customPrompt.replace(/\$\{([^}]+)\}/g, (match, key) =>
            key in argumentToValue ? argumentToValue[key] : match,
        );
    }

    return `You are a professional translator.

Translate from ${inputLanguage} to ${outputLanguage}.

- Translate each object in the array.
- 'original' is the text to be translated. 
- 'translated' must not be empty. 
- 'context' is additional info if needed.
- 'lastFailure' explains why the previous translation failed.
- Preserve text meaning, tone, grammar, formality and formatting (case, whitespace, punctuation).

Special Instructions:
- Treat anything in the format {{variableName}} as a placeholder. Never translate or modify its content.
- Do not add your own variables
- The number of variables like {{timeLeft}} must be the same in the translated text.
- Do not convert {{NEWLINE}} to \\n.
- Use the think property to briefly reflect on the context or meaning of the text before generating the translation. This reflection should not be lengthy, just enough to aid in making the translation more accurate or contextually appropriate. Make sure to take into account the variable names during your reflection.

Return as JSON.
\`\`\`json
${input}
\`\`\`
`;
}

/**
 * Prompt an AI to convert a given input from one language to another
 * @param inputLanguage - The language of the input
 * @param outputLanguage - The language of the output
 * @param translateItems - The input to be translated
 * @param overridePrompt - An optional custom prompt
 * @returns A prompt for the AI to translate the input
 */
export function translationPromptJsonWithoutThink(
    inputLanguage: string,
    outputLanguage: string,
    translateItems: TranslateItemInput[],
    overridePrompt?: OverridePrompt,
): string {
    const customPrompt = overridePrompt?.generationPrompt;
    const requiredArguments = ["inputLanguage", "outputLanguage", "input"];
    const input = JSON.stringify(translateItems);

    if (customPrompt) {
        for (const arg of requiredArguments) {
            if (!customPrompt.includes(`\${${arg}}`)) {
                throw new Error(`Missing required argument: \${${arg}}`);
            }
        }

        const argumentToValue: { [key: string]: string } = {
            input,
            inputLanguage,
            outputLanguage,
        };

        return customPrompt.replace(/\$\{([^}]+)\}/g, (match, key) =>
            key in argumentToValue ? argumentToValue[key] : match,
        );
    }

    return `You are a professional translator.

Translate from ${inputLanguage} to ${outputLanguage}.

- Translate each object in the array.
- 'original' is the text to be translated. 
- 'translated' must not be empty. 
- 'context' is additional info if needed.
- 'lastFailure' explains why the previous translation failed.
- Preserve text meaning, tone, grammar, formality and formatting (case, whitespace, punctuation).

Special Instructions:
- Treat anything in the format {{variableName}} as a placeholder. Never translate or modify its content.
- Do not add your own variables
- The number of variables like {{timeLeft}} must be the same in the translated text.
- Do not convert {{NEWLINE}} to \\n.

Return as JSON.
\`\`\`json
${input}
\`\`\`
`;
}

/**
 * Prompt an AI to ensure a translation is valid
 * @param inputLanguage - The language of the input
 * @param outputLanguage - The language of the output
 * @param verificationInput - The input to be translated
 * @param overridePrompt - An optional custom prompt
 * @returns A prompt for the AI to verify the translation
 */
export function verificationPromptJson(
    inputLanguage: string,
    outputLanguage: string,
    verificationInput: VerifyItemInput[],
    overridePrompt?: OverridePrompt,
): string {
    const input = JSON.stringify(verificationInput);
    const customPrompt = overridePrompt?.translationVerificationPrompt;
    const requiredArguments = ["inputLanguage", "outputLanguage", "mergedCsv"];
    if (customPrompt) {
        for (const arg of requiredArguments) {
            if (!customPrompt.includes(`\${${arg}}`)) {
                throw new Error(`Missing required argument: \${${arg}}`);
            }
        }

        const argumentToValue: { [key: string]: string } = {
            inputLanguage,
            outputLanguage,
        };

        return customPrompt.replace(/\$\{([^}]+)\}/g, (match, key) =>
            key in argumentToValue ? argumentToValue[key] : match,
        );
    }

    return `You are a professional translator.

Check translations from ${inputLanguage} to ${outputLanguage}.

- Verify each object in the array.
- 'original' is the text to be translated. 
- 'translated' is the translated text to verify. 
- 'context' is additional info if needed.
- 'lastFailure' explains why the previous translation failed.
- check for Accuracy (meaning, tone, grammar, formality), Formatting (case, whitespace, punctuation).

If correct:
- return 'isValid' as 'true' and nothing else.

If incorrect:
- return 'isValid' as 'false'
- explain the 'issue' thoroughly in a few words
- fix the translation in 'fixTranslation' as a string. Make sure that 'fixTranslation' is in ${outputLanguage}

Special Instructions:
- Treat anything in the format {{variableName}} as a placeholder. Never translate or modify its content.
- Do not add your own variables
- The number of variables like {{timeLeft}} must be the same in the translated text.
- Do not convert {{NEWLINE}} to \\n.

Allow minor grammar, phrasing, and formatting differences if meaning is clear.
Flag only significant issues affecting accuracy or readability.

Return as JSON.
\`\`\`json
${input} 
\`\`\`
`;
}

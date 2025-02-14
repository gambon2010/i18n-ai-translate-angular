import type { TranslateItemInput, VerifyItemInput } from "./types_json";
import type OverridePrompt from "../interfaces/override_prompt";

/**
 * Prompt an AI to convert a given input from one language to another
 * @param inputLanguage - The language of the input
 * @param outputLanguage - The language of the output
 * @param translateItems - The input to be translated
 * @param overridePrompt - An optional custom prompt
 * @returns A prompt for the AI to translate the input
 */
export function translationPromptJson(
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
- Preserve text formatting, case sensitivity, and whitespace.

Special Instructions:
- Do not translate or alter variables like {{timeLeft}}, Ignore this if 'original' lacks variables.
- Do not convert {{NEWLINE}} to \\n.

Return the translation as JSON.
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
- 'translated' is the translated text. 
- 'context' is additional info if needed.
- check for Accuracy (meaning, tone, grammar), Formatting (case, whitespace, punctuation).

If correct, return 'valid' as 'true' and leave 'fixedTranslation' empty.
If incorrect, return 'valid' as 'false' and put the fixed translation in 'fixedTranslation'.

Special Instructions:
- Do not translate or alter variables like {{timeLeft}}, Ignore this if 'original' lacks variables.
- Do not convert {{NEWLINE}} to \\n.

Return the verified as JSON.
\`\`\`json
${input} 
\`\`\`
`;
}

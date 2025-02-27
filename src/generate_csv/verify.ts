import { isACK, isNAK, printError, retryJob } from "../utils";
import {
    stylingVerificationPrompt,
    translationVerificationPrompt,
} from "./prompts";
import type ChatInterface from "../chat_interface/chat_interface";
import type OverridePrompt from "../interfaces/override_prompt";
import { TranslationStatsItem } from "src/types";

/**
 * Confirm whether a given translation is valid
 * @param chat - the chat session
 * @param inputLanguage - the language of the input
 * @param outputLanguage - the language of the output
 * @param input - the input text
 * @param outputToVerify - the output text to verify
 * @param translationStatsItem - translationStatsItem
 * @param overridePrompt - An optional custom prompt
 */
export async function verifyTranslation(
    chat: ChatInterface,
    inputLanguage: string,
    outputLanguage: string,
    input: string,
    outputToVerify: string,
    translationStatsItem: TranslationStatsItem,
    overridePrompt?: OverridePrompt,
): Promise<string> {
    const translationVerificationPromptText = translationVerificationPrompt(
        inputLanguage,
        outputLanguage,
        input,
        outputToVerify,
        overridePrompt,
    );

    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return verify(
        chat,
        translationVerificationPromptText,
        translationStatsItem,
    );
}

/**
 * Confirm whether a translation maintains the original styling
 * @param chat - the chat session
 * @param inputLanguage - the language of the input
 * @param outputLanguage - the language of the output
 * @param input - the input text
 * @param outputToVerify - the output text to verify
 * @param translationStatsItem - translationStatsItem
 * @param overridePrompt - An optional custom prompt
 */
export async function verifyStyling(
    chat: ChatInterface,
    inputLanguage: string,
    outputLanguage: string,
    input: string,
    outputToVerify: string,
    translationStatsItem: TranslationStatsItem,
    overridePrompt?: OverridePrompt,
): Promise<string> {
    const stylingVerificationPromptText = stylingVerificationPrompt(
        inputLanguage,
        outputLanguage,
        input,
        outputToVerify,
        overridePrompt,
    );

    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return verify(chat, stylingVerificationPromptText, translationStatsItem);
}

const verify = async (
    chat: ChatInterface,
    verificationPromptText: string,
    translationStatsItem: TranslationStatsItem,
): Promise<string> => {
    let verification = "";
    try {
        verification = await retryJob(
            async (): Promise<string> => {
                const text = await chat.sendMessage(
                    verificationPromptText,
                    translationStatsItem,
                );

                if (text === "") {
                    return Promise.reject(
                        new Error("Failed to generate content"),
                    );
                }

                if (!isNAK(text) && !isACK(text)) {
                    return Promise.reject(
                        new Error(`Invalid response: ${text}`),
                    );
                }

                return text;
            },
            [],
            5,
            true,
            0,
            false,
        );
    } catch (e) {
        printError(`Failed to verify: ${e}`);
    }

    return verification;
};

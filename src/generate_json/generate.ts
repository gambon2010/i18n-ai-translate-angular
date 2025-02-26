import { RETRY_ATTEMPTS } from "../constants";
import {
    ThinkTranslateItemOutputObjectSchema,
    TranslateItemOutputObjectSchema,
    VerifyItemOutputObjectSchema,
} from "./types";
import { Tiktoken } from "tiktoken";
import {
    getMissingVariables,
    getTemplatedStringRegex,
    printError,
    printExecutionTime,
    printProgress,
    retryJob,
} from "../utils";
import {
    translationPromptJsonWithThink,
    translationPromptJsonWithoutThink,
    verificationPromptJson,
} from "./prompts";
import cl100k_base from "tiktoken/encoders/cl100k_base.json";
import type {
    GenerateStateJson,
    TranslateItem,
    TranslateItemInput,
    TranslateItemOutput,
    VerifyItemInput,
    VerifyItemOutput,
} from "./types";
import type { TranslationStats, TranslationStatsItem } from "../types";
import type { ZodType, ZodTypeDef } from "zod";
import type Chats from "../interfaces/chats";
import type GenerateTranslationOptionsJson from "../interfaces/generate_translation_options_json";
import type TranslateOptions from "../interfaces/translate_options";

export default class GenerateTranslationJson {
    tikToken: Tiktoken;
    templatedStringRegex: RegExp;

    constructor(options: TranslateOptions) {
        this.tikToken = new Tiktoken(
            cl100k_base.bpe_ranks,
            cl100k_base.special_tokens,
            cl100k_base.pat_str,
        );

        this.templatedStringRegex = getTemplatedStringRegex(
            options.templatedStringPrefix as string,
            options.templatedStringPrefix as string,
        );
    }

    /**
     * Complete the initial translation of the input text.
     * @param flatInput - The flatinput object containing the json to translate
     * @param options - The options to generate the translation
     * @param chats - The options to generate the translation
     * @param translationStats - The translation statictics
     */
    public async translateJson(
        flatInput: { [key: string]: string },
        options: TranslateOptions,
        chats: Chats,
        translationStats: TranslationStats,
    ): Promise<{ [key: string]: string }> {
        const translateItemArray = this.generateTranslateItemArray(flatInput);

        const generatedTranslation = await this.generateTranslationJson(
            translateItemArray,
            options,
            chats,
            translationStats.translate,
        );

        if (!options.skipTranslationVerification) {
            const generatedVerification = await this.generateVerificationJson(
                generatedTranslation,
                options,
                chats,
                translationStats.verify,
            );

            for (const verificationItem of generatedTranslation) {
                verificationItem.translationAttempts = 0;
                verificationItem.translationTokens =
                    this.getVerifyItemToken(verificationItem);
                verificationItem.lastFailure = "";
            }

            return this.convertTranslateItemToIndex(generatedVerification);
        }

        return this.convertTranslateItemToIndex(generatedTranslation);
    }

    private generateTranslateItemsInput(
        translateItems: TranslateItem[],
    ): TranslateItemInput[] {
        return translateItems.map(
            (translateItem) =>
                ({
                    id: translateItem.id,
                    original: translateItem.original,
                    // Only adds 'context' to the object if it's not empty. Makes the prompt shorter and uses less tokens
                    ...(translateItem.context !== ""
                        ? { context: translateItem.context }
                        : {}),
                    ...(translateItem.lastFailure !== ""
                        ? { failure: translateItem.lastFailure }
                        : {}),
                }) as TranslateItemInput,
        );
    }

    private generateVerifyItemsInput(
        verifyItems: TranslateItem[],
    ): VerifyItemInput[] {
        return verifyItems.map(
            (verifyItem) =>
                ({
                    id: verifyItem.id,
                    original: verifyItem.original,
                    translated: verifyItem.translated,
                    ...(verifyItem.context !== ""
                        ? { context: verifyItem.context }
                        : {}),
                    ...(verifyItem.lastFailure !== ""
                        ? { failure: verifyItem.lastFailure }
                        : {}),
                }) as VerifyItemInput,
        );
    }

    private generateTranslateItem(
        id: number,
        key: string,
        original: string,
    ): TranslateItem {
        const translateItem = {
            context: "",
            id,
            key,
            lastFailure: "",
            original,
            templateStrings: [],
            translated: "",
            translationAttempts: 0,
            translationTokens: 0,
        } as TranslateItem;

        // Maps the 'placeholders' in the translated object to make sure that none are missing
        const match = original.match(this.templatedStringRegex);
        if (match) {
            translateItem.templateStrings = match;
        }

        // Tokens here are used to estimate accurately the execution time
        translateItem.translationTokens =
            this.getTranslateItemToken(translateItem);

        return translateItem;
    }

    private getBatchTranslateItemArray(
        translateItemArray: TranslateItem[],
        options: TranslateOptions,
        promptTokens: number,
        tokenSplit: number,
        itemTokenFunction: (translatedItem: TranslateItem) => number,
    ): TranslateItem[] {
        // Remove the tokens used by the prompt and divide the remaining tokens divided by 2 (half for the input/output) with a 10% margin of error
        const maxInputTokens =
            ((Number(options.batchMaxTokens) - promptTokens) * 0.9) /
            tokenSplit;

        let currentTokens = 0;

        const batchTranslateItemArray: TranslateItem[] = [];

        for (const translateItem of translateItemArray) {
            // If a failure message is added the tokens for an item change
            currentTokens +=
                translateItem.lastFailure !== ""
                    ? itemTokenFunction(translateItem)
                    : translateItem.translationTokens;

            if (
                batchTranslateItemArray.length !== 0 &&
                (currentTokens >= maxInputTokens ||
                    batchTranslateItemArray.length >= Number(options.batchSize))
            ) {
                break;
            }

            batchTranslateItemArray.push(translateItem);

            if (translateItem.translationAttempts > 5) {
                // Add a minimum of one items if the item has been tried many times
                // Too many items can cause translations to fail
                break;
            }
        }

        return batchTranslateItemArray;
    }

    private generateTranslateItemArray(flatInput: any): TranslateItem[] {
        return Object.keys(flatInput).reduce((acc, key) => {
            if (Object.prototype.hasOwnProperty.call(flatInput, key)) {
                acc.push(
                    this.generateTranslateItem(
                        Object.keys(flatInput).indexOf(key) + 1,
                        key,
                        flatInput[key],
                    ),
                );
            }

            return acc;
        }, [] as TranslateItem[]);
    }

    private getTranslateItemToken(translatedItem: TranslateItem): number {
        return this.tikToken.encode(
            JSON.stringify(
                this.generateTranslateItemsInput([translatedItem])[0],
            ),
        ).length;
    }

    private getVerifyItemToken(translatedItem: TranslateItem): number {
        return this.tikToken.encode(
            JSON.stringify(this.generateVerifyItemsInput([translatedItem])[0]),
        ).length;
    }

    private async generateTranslationJson(
        translateItemArray: TranslateItem[],
        options: TranslateOptions,
        chats: Chats,
        translationStats: TranslationStatsItem,
    ): Promise<TranslateItem[]> {
        translationStats.batchStartTime = Date.now();

        const generatedTranslation: TranslateItem[] = [];

        translationStats.totalItems = translateItemArray.length;
        translationStats.totalTokens = translateItemArray.reduce(
            (sum, translateItem) => sum + translateItem.translationTokens,
            0,
        );

        const promptSize = this.tikToken.encode(
            options.disableThink
                ? translationPromptJsonWithoutThink(
                      options.inputLanguage,
                      options.outputLanguage,
                      [],
                      options.overridePrompt,
                  )
                : translationPromptJsonWithThink(
                      options.inputLanguage,
                      options.outputLanguage,
                      [],
                      options.overridePrompt,
                  ),
        ).length;

        // translate items are removed from 'translateItemArray' when one is generated
        // this is done to avoid 'losing' items if the model doesn't return one
        while (translateItemArray.length > 0) {
            const batchTranslateItemArray = this.getBatchTranslateItemArray(
                translateItemArray,
                options,
                promptSize,
                options.disableThink ? 2 : 3,
                this.getTranslateItemToken.bind(this),
            );

            for (const batchTranslateItem of batchTranslateItemArray) {
                batchTranslateItem.translationAttempts++;
                if (batchTranslateItem.translationAttempts > RETRY_ATTEMPTS) {
                    return Promise.reject(
                        new Error(
                            `Item failed to translate too many times: ${JSON.stringify(batchTranslateItem)}. If this persists try a different model`,
                        ),
                    );
                }
            }

            translationStats.enqueuedItems += batchTranslateItemArray.length;

            // eslint-disable-next-line no-await-in-loop
            const result = await this.runTranslationJob({
                chats,
                disableThink: options.disableThink as boolean,
                ensureChangedTranslation:
                    options.ensureChangedTranslation as boolean,
                inputLanguage: `[${options.inputLanguage}]`,
                outputLanguage: `[${options.outputLanguage}]`,
                overridePrompt: options.overridePrompt,
                skipStylingVerification:
                    options.skipStylingVerification as boolean,
                skipTranslationVerification:
                    options.skipTranslationVerification as boolean,
                templatedStringPrefix: options.templatedStringPrefix as string,
                templatedStringSuffix: options.templatedStringSuffix as string,
                translateItems: batchTranslateItemArray,
                verboseLogging: options.verbose as boolean,
            });

            if (!result) {
                return Promise.reject(new Error("Translation job failed"));
            }

            for (const translatedItem of result) {
                // Check if the translated item exists in the untranslated item array
                const index = translateItemArray.findIndex(
                    (item) => item.id === translatedItem.id,
                );

                if (index !== -1) {
                    // If it does remove it from the 'translateItemArray' used to queue items for translation
                    translateItemArray.splice(index, 1);
                    generatedTranslation.push(translatedItem);
                    translationStats.processedTokens +=
                        translatedItem.translationTokens;
                }

                translationStats.processedItems++;
            }

            if (options.verbose) {
                printProgress(
                    options.skipTranslationVerification
                        ? "Translating"
                        : "Step 1/2 - Translating",
                    translationStats.batchStartTime,
                    translationStats.totalTokens,
                    translationStats.processedTokens,
                );
            }
        }

        if (options.verbose) {
            printExecutionTime(
                translationStats.batchStartTime,
                "Translation execution time: ",
            );
        }

        return generatedTranslation;
    }

    private async generateVerificationJson(
        verifyItemArray: TranslateItem[],
        options: TranslateOptions,
        chats: Chats,
        translationStats: TranslationStatsItem,
    ): Promise<TranslateItem[]> {
        const generatedVerification: TranslateItem[] = [];

        translationStats.batchStartTime = Date.now();

        translationStats.totalItems = verifyItemArray.length;

        translationStats.totalTokens = verifyItemArray.reduce(
            (sum, verifyItem) => sum + verifyItem.translationTokens,
            0,
        );

        const promptTokens = this.tikToken.encode(
            verificationPromptJson(
                options.inputLanguage,
                options.outputLanguage,
                [],
                options.overridePrompt,
            ),
        ).length;

        while (verifyItemArray.length > 0) {
            const batchVerifyItemArray = this.getBatchTranslateItemArray(
                verifyItemArray,
                options,
                promptTokens,
                3,
                this.getVerifyItemToken.bind(this),
            );

            for (const batchVerifyItem of batchVerifyItemArray) {
                batchVerifyItem.translationAttempts++;
                if (batchVerifyItem.translationAttempts > RETRY_ATTEMPTS) {
                    return Promise.reject(
                        new Error(
                            `Item failed to verify too many times: ${JSON.stringify(batchVerifyItem)}. If this persists try a different model`,
                        ),
                    );
                }
            }

            translationStats.enqueuedItems += batchVerifyItemArray.length;

            // eslint-disable-next-line no-await-in-loop
            const result = await this.runVerificationJob({
                chats,
                disableThink: options.disableThink as boolean,
                ensureChangedTranslation:
                    options.ensureChangedTranslation as boolean,
                inputLanguage: `[${options.inputLanguage}]`,
                outputLanguage: `[${options.outputLanguage}]`,
                overridePrompt: options.overridePrompt,
                skipStylingVerification:
                    options.skipStylingVerification as boolean,
                skipTranslationVerification:
                    options.skipTranslationVerification as boolean,
                templatedStringPrefix: options.templatedStringPrefix as string,
                templatedStringSuffix: options.templatedStringSuffix as string,
                translateItems: batchVerifyItemArray,
                verboseLogging: options.verbose as boolean,
            });

            if (!result) {
                return Promise.reject(new Error("Verification job failed"));
            }

            for (const verifiedItem of result) {
                const index = verifyItemArray.findIndex(
                    (item) => item.id === verifiedItem.id,
                );

                if (index !== -1) {
                    verifyItemArray.splice(index, 1);
                    generatedVerification.push(verifiedItem);
                    translationStats.processedTokens +=
                        verifiedItem.translationTokens;
                }

                translationStats.processedItems++;
            }

            if (options.verbose) {
                printProgress(
                    "Step 2/2 - Verifying",
                    translationStats.batchStartTime,
                    translationStats.totalTokens,
                    translationStats.processedTokens,
                );
            }
        }

        if (options.verbose) {
            printExecutionTime(
                translationStats.batchStartTime,
                "Verification execution time: ",
            );
        }

        return generatedVerification;
    }

    private convertTranslateItemToIndex(
        generatedTranslation: TranslateItem[],
    ): {
        [key: string]: string;
    } {
        return generatedTranslation.reduce(
            (acc, translation) => {
                acc[translation.key] = translation.translated;
                return acc;
            },
            {} as { [key: string]: string },
        );
    }

    private parseTranslationToJson(outputText: string): TranslateItemOutput[] {
        try {
            return TranslateItemOutputObjectSchema.parse(JSON.parse(outputText))
                .items;
        } catch (error) {
            printError(
                `Error parsing JSON: '${error}', output: '${outputText}'\n`,
            );
            return [];
        }
    }

    private parseVerificationToJson(outputText: string): VerifyItemOutput[] {
        try {
            return VerifyItemOutputObjectSchema.parse(JSON.parse(outputText))
                .items;
        } catch (error) {
            printError(
                `Error parsing JSON: '${error}', output: '${outputText}'\n`,
            );
            return [];
        }
    }

    private isValidTranslateItem(
        item: TranslateItemOutput,
    ): item is TranslateItemOutput {
        return (
            typeof item.id === "number" &&
            typeof item.translated === "string" &&
            item.id > 0
        );
    }

    private isValidVerificationItem(
        item: VerifyItemOutput,
    ): item is VerifyItemOutput {
        if (!(typeof item.id === "number")) return false;
        if (!(typeof item.isValid === "boolean")) return false;
        if (item.id <= 0) return false;
        // 'fixedTranslation' should be a translation if valid is false
        if (
            item.isValid === false &&
            !(typeof item.fixedTranslation === "string")
        )
            return false;

        return true;
    }

    private createTranslateItemsWithTranslation(
        untranslatedItems: TranslateItem[],
        translatedItems: TranslateItemOutput[],
    ): TranslateItem[] {
        const output: TranslateItem[] = [];

        for (const untranslatedItem of untranslatedItems) {
            const translatedItem = translatedItems.find(
                (checkTranslatedItem) =>
                    untranslatedItem.id === checkTranslatedItem.id,
            );

            if (translatedItem) {
                untranslatedItem.translated = translatedItem.translated;

                if (translatedItem.translated === "") {
                    untranslatedItem.lastFailure =
                        "The translated value cannot be an empty string";
                    continue;
                }

                const templateStrings =
                    translatedItem.translated.match(
                        this.templatedStringRegex,
                    ) ?? [];

                const missingVariables = getMissingVariables(
                    untranslatedItem.templateStrings,
                    templateStrings,
                );

                if (missingVariables.length !== 0) {
                    // Item is updated with a failure message. This message gives the LLM a context to help it fix the translation.
                    // Without this the same error is made over and over again, with the message the new translation is generally accepted.
                    untranslatedItem.lastFailure = `Ensure all variables are included. The following variables are missing from the previous translation and must be added: '${JSON.stringify(missingVariables)}'`;
                    continue;
                }

                output.push({
                    ...untranslatedItem,
                    failure: "",
                } as TranslateItem);
            }
        }

        return output;
    }

    private createVerifyItemsWithTranslation(
        translatedItemArray: TranslateItem[],
        verifiedItemArray: VerifyItemOutput[],
    ): TranslateItem[] {
        const output: TranslateItem[] = [];

        for (const translatedItem of translatedItemArray) {
            const verifiedItem = verifiedItemArray.find(
                (checkVerifiedItem) =>
                    translatedItem.id === checkVerifiedItem.id,
            );

            if (verifiedItem) {
                if (verifiedItem.isValid) {
                    output.push({
                        ...translatedItem,
                        failure: "",
                    } as TranslateItem);
                } else {
                    translatedItem.translated =
                        verifiedItem.fixedTranslation as string;

                    if (verifiedItem.fixedTranslation === "") {
                        translatedItem.lastFailure =
                            "The translated value cannot be an empty string";
                        continue;
                    }

                    const templateStrings =
                        verifiedItem.fixedTranslation.match(
                            this.templatedStringRegex,
                        ) ?? [];

                    const missingVariables = getMissingVariables(
                        translatedItem.templateStrings,
                        templateStrings,
                    );

                    if (missingVariables.length !== 0) {
                        translatedItem.lastFailure = `Must add variables, missing from last translation: '${JSON.stringify(missingVariables)}'`;
                        continue;
                    }

                    // 'translatedItem' is updated and queued again to check if the new fixed translation is valid
                    translatedItem.lastFailure = `Previous issue that should be corrected: '${verifiedItem.issue}'`;
                }
            }
        }

        return output;
    }

    private async runTranslationJob(
        options: GenerateTranslationOptionsJson,
    ): Promise<TranslateItem[]> {
        const generateState: GenerateStateJson = {
            fixedTranslationMappings: {},
            generationRetries: 0,
            translationToRetryAttempts: {},
        };

        const generationPromptText = options.disableThink
            ? translationPromptJsonWithoutThink(
                  options.inputLanguage,
                  options.outputLanguage,
                  this.generateTranslateItemsInput(options.translateItems),
                  options.overridePrompt,
              )
            : translationPromptJsonWithThink(
                  options.inputLanguage,
                  options.outputLanguage,
                  this.generateTranslateItemsInput(options.translateItems),
                  options.overridePrompt,
              );

        let translated = "";
        try {
            translated = await retryJob(
                // eslint-disable-next-line @typescript-eslint/no-use-before-define
                this.generateJob.bind(this),
                [
                    generationPromptText,
                    options,
                    generateState,
                    options.disableThink
                        ? TranslateItemOutputObjectSchema
                        : ThinkTranslateItemOutputObjectSchema,
                ],
                RETRY_ATTEMPTS,
                true,
                0,
                false,
            );
        } catch (e) {
            printError(`Failed to translate: ${e}\n`);
        }

        const parsedOutput = this.parseTranslationToJson(translated);
        const validTranslationObjects = parsedOutput.filter(
            this.isValidTranslateItem,
        );

        return this.createTranslateItemsWithTranslation(
            options.translateItems,
            validTranslationObjects,
        );
    }

    private async runVerificationJob(
        options: GenerateTranslationOptionsJson,
    ): Promise<TranslateItem[]> {
        const generateState: GenerateStateJson = {
            fixedTranslationMappings: {},
            generationRetries: 0,
            translationToRetryAttempts: {},
        };

        const generationPromptText = verificationPromptJson(
            options.inputLanguage,
            options.outputLanguage,
            this.generateVerifyItemsInput(options.translateItems),
            options.overridePrompt,
        );

        let verified = "";
        try {
            verified = await retryJob(
                // eslint-disable-next-line @typescript-eslint/no-use-before-define
                this.generateJob,
                [
                    generationPromptText,
                    options,
                    generateState,
                    VerifyItemOutputObjectSchema,
                ],
                RETRY_ATTEMPTS,
                true,
                0,
                false,
            );
        } catch (e) {
            printError(`Failed to translate: ${e}\n`);
        }

        const parsedOutput = this.parseVerificationToJson(verified);
        const validTranslationObjects = parsedOutput.filter(
            this.isValidVerificationItem,
        );

        return this.createVerifyItemsWithTranslation(
            options.translateItems,
            validTranslationObjects,
        );
    }

    private verifyGenerationAndRetry(
        generationPromptText: string,
        options: GenerateTranslationOptionsJson,
        generateState: GenerateStateJson,
    ): Promise<string> {
        generateState.generationRetries++;
        if (generateState.generationRetries > 10) {
            options.chats.generateTranslationChat.resetChatHistory();
            return Promise.reject(
                new Error(
                    "Failed to generate content due to exception. Resetting history.",
                ),
            );
        }

        printError(`Erroring text = ${generationPromptText}\n`);

        options.chats.generateTranslationChat.rollbackLastMessage();
        return Promise.reject(
            new Error("Failed to generate content due to exception."),
        );
    }

    private async generateJob(
        generationPromptText: string,
        options: GenerateTranslationOptionsJson,
        generateState: GenerateStateJson,
        format: ZodType<any, ZodTypeDef, any>,
    ): Promise<string> {
        const text = await options.chats.generateTranslationChat.sendMessage(
            generationPromptText,
            format,
        );

        if (!text) {
            return this.verifyGenerationAndRetry(
                generationPromptText,
                options,
                generateState,
            );
        } else {
            generateState.generationRetries = 0;
        }

        return text;
    }
}

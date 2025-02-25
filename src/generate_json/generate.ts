import {
    type GenerateStateJson,
    type GradeItem,
    type GradeItemInput,
    type GradingScaleItemOutput,
    GradingScaleItemOutputArraySchema,
} from "./types";
import { RETRY_ATTEMPTS } from "../constants";
import { Tiktoken } from "tiktoken";
import {
    printError,
    printExecutionTime,
    printProgress,
    retryJob,
} from "../utils";
import ChatFactory from "../chat_interface/chat_factory";
import RateLimiter from "../rate_limiter";
import cl100k_base from "tiktoken/encoders/cl100k_base.json";
import gradingPromptJson from "./prompts";
import type { TranslationStatsItem } from "../types";
import type { ZodType, ZodTypeDef } from "zod";
import type ChatInterface from "../chat_interface/chat_interface";
import type GenerateGradeOptionsJson from "../interfaces/generate_grade_options_json";
import type GradeOptions from "../interfaces/grade_options";

export default class GenerateTranslationJson {
    tikToken: Tiktoken;
    chats: ChatInterface;

    constructor(options: GradeOptions) {
        this.tikToken = new Tiktoken(
            cl100k_base.bpe_ranks,
            cl100k_base.special_tokens,
            cl100k_base.pat_str,
        );

        const rateLimiter = new RateLimiter(
            options.rateLimitMs,
            options.verbose as boolean,
        );

        this.chats = ChatFactory.newChat(
            options.engine,
            options.model,
            rateLimiter,
            options.apiKey,
            options.host,
        );
    }

    /**
     * Complete the initial translation of the input text.
     * @param flattenedOriginalJson - The flatinput object containing the base file
     * @param flattenedTranslatedJson - The flatinput object containing the translated file
     * @param options - The options to generate the translation
     * @param translationStats - The translation statictics
     */
    public async translateJson(
        flattenedOriginalJson: { [key: string]: string },
        flattenedTranslatedJson: { [key: string]: string },
        options: GradeOptions,
        translationStats: TranslationStatsItem,
    ): Promise<void> {
        const gradeItemArray = this.generateGradeItemArray(
            flattenedOriginalJson,
            flattenedTranslatedJson,
        );

        const generatedTranslation = await this.generateTranslationJson(
            gradeItemArray,
            options,
            translationStats,
        );

        // this.convertTranslateItemToIndex(generatedTranslation);
    }

    private generateGradeItemsInput(gradeItems: GradeItem[]): GradeItemInput[] {
        return gradeItems.map((gradeItem) => ({
            id: gradeItem.id,
            original: gradeItem.original,
            translated: gradeItem.translated,
            // Only adds 'context' to the object if it's not empty. Makes the prompt shorter and uses less tokens
            ...(gradeItem.context !== "" ? { context: gradeItem.context } : {}),
            ...(gradeItem.lastFailure !== ""
                ? { lastFailure: gradeItem.lastFailure }
                : {}),
        }));
    }

    private generateGradeItem(
        id: number,
        key: string,
        original: string,
        translated: string,
    ): GradeItem {
        const translateItem = {
            context: "",
            grading: {} as GradingScaleItemOutput,
            gradingAttempts: 0,
            gradingTokens: 0,
            id,
            key,
            lastFailure: "",
            original,
            templateStrings: [],
            translated,
        } as GradeItem;

        // Tokens here are used to estimate accurately the execution time
        translateItem.gradingTokens = this.getGradeItemToken(translateItem);

        return translateItem;
    }

    private getBatchGradeItemArray(
        gradeItemArray: GradeItem[],
        options: GradeOptions,
        promptTokens: number,
        tokenSplit: number,
        itemTokenFunction: (translatedItem: GradeItem) => number,
    ): GradeItem[] {
        // Remove the tokens used by the prompt and divide the remaining tokens divided by 2 (half for the input/output) with a 10% margin of error
        const maxInputTokens =
            ((Number(options.batchMaxTokens) - promptTokens) * 0.9) /
            tokenSplit;

        let currentTokens = 0;

        const batchTranslateItemArray: GradeItem[] = [];

        for (const gradeItem of gradeItemArray) {
            // If a failure message is added the tokens for an item change
            currentTokens +=
                gradeItem.lastFailure !== ""
                    ? itemTokenFunction(gradeItem)
                    : gradeItem.gradingTokens;

            if (
                batchTranslateItemArray.length !== 0 &&
                (currentTokens >= maxInputTokens ||
                    batchTranslateItemArray.length >= Number(options.batchSize))
            ) {
                break;
            }

            batchTranslateItemArray.push(gradeItem);

            if (gradeItem.gradingAttempts > 5) {
                // Add a minimum of one items if the item has been tried many times
                // Too many items can cause translations to fail
                break;
            }
        }

        return batchTranslateItemArray;
    }

    private generateGradeItemArray(
        flattenedOriginalJson: { [key: string]: string },
        flattenedTranslatedJson: { [key: string]: string },
    ): GradeItem[] {
        return Object.keys(flattenedOriginalJson).reduce((acc, key) => {
            if (
                Object.prototype.hasOwnProperty.call(flattenedOriginalJson, key)
            ) {
                acc.push(
                    this.generateGradeItem(
                        Object.keys(flattenedOriginalJson).indexOf(key) + 1,
                        key,
                        flattenedOriginalJson[key],
                        flattenedTranslatedJson[key],
                    ),
                );
            }

            return acc;
        }, [] as GradeItem[]);
    }

    private getGradeItemToken(gradeItem: GradeItem): number {
        return this.tikToken.encode(
            JSON.stringify(this.generateGradeItemsInput([gradeItem])[0]),
        ).length;
    }

    private async generateTranslationJson(
        gradeItemArray: GradeItem[],
        options: GradeOptions,
        translationStats: TranslationStatsItem,
    ): Promise<GradeItem[]> {
        translationStats.batchStartTime = Date.now();

        const generatedTranslation: GradeItem[] = [];

        translationStats.totalItems = gradeItemArray.length;
        translationStats.totalTokens = gradeItemArray.reduce(
            (sum, gradeItem) => sum + gradeItem.gradingTokens,
            0,
        );

        const promptSize = this.tikToken.encode(
            gradingPromptJson(
                options.originalLanguage,
                options.translatedLanguage,
                [],
            ),
        ).length;

        // translate items are removed from 'translateItemArray' when one is generated
        // this is done to avoid 'losing' items if the model doesn't return one
        while (gradeItemArray.length > 0) {
            const batchTranslateItemArray = this.getBatchGradeItemArray(
                gradeItemArray,
                options,
                promptSize,
                3,
                this.getGradeItemToken,
            );

            for (const batchTranslateItem of batchTranslateItemArray) {
                batchTranslateItem.gradingAttempts++;
                if (batchTranslateItem.gradingAttempts > RETRY_ATTEMPTS) {
                    return Promise.reject(
                        new Error(
                            `Item failed to translate too many times: ${JSON.stringify(batchTranslateItem)}. If this persists try a different model`,
                        ),
                    );
                }
            }

            translationStats.enqueuedItems += batchTranslateItemArray.length;

            // eslint-disable-next-line no-await-in-loop
            const result = await this.runJob({
                gradeItems: batchTranslateItemArray,
                originalLanguage: `[${options.originalLanguage}]`,
                translatedLanguage: `[${options.translatedLanguage}]`,
                verboseLogging: options.verbose as boolean,
            });

            if (!result) {
                return Promise.reject(new Error("Translation job failed"));
            }

            for (const translatedItem of result) {
                // Check if the translated item exists in the untranslated item array
                const index = gradeItemArray.findIndex(
                    (item) => item.id === translatedItem.id,
                );

                if (index !== -1) {
                    // If it does remove it from the 'translateItemArray' used to queue items for translation
                    gradeItemArray.splice(index, 1);
                    generatedTranslation.push(translatedItem);
                    translationStats.processedTokens +=
                        translatedItem.gradingTokens;
                }

                translationStats.processedItems++;
            }

            if (options.verbose) {
                printProgress(
                    "Grading",
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

    private convertTranslateItemToIndex(generatedTranslation: GradeItem[]): {
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

    private parseGradingToJson(outputText: string): GradingScaleItemOutput[] {
        try {
            return GradingScaleItemOutputArraySchema.parse(
                JSON.parse(outputText),
            ).items;
        } catch (error) {
            printError(
                `Error parsing JSON: '${error}', output: '${outputText}'\n`,
            );
            return [];
        }
    }

    private isValidGradeItem(
        item: GradingScaleItemOutput,
    ): item is GradingScaleItemOutput {
        return (
            typeof item.accuracy.meaning === "number" &&
            typeof item.accuracy.toneStyle === "number" &&
            typeof item.accuracy.grammarSyntax === "number" &&
            typeof item.formatting.punctuationSpacing === "number" &&
            typeof item.formatting.capitalizationFormatting === "number" &&
            typeof item.fluencyReadability.naturalness === "number" &&
            typeof item.fluencyReadability.clarity === "number" &&
            typeof item.consistency.terminologyWordChoice === "number" &&
            typeof item.culturalAdaptation.localization === "number" &&
            typeof item.id === "number" &&
            item.id > 0
        );
    }

    private createGradeItemsWithTranslation(
        baseItems: GradeItem[],
        gradedItems: GradingScaleItemOutput[],
    ): GradeItem[] {
        const output: GradeItem[] = [];

        for (const baseItem of baseItems) {
            const gradedItem = gradedItems.find(
                (checkTranslatedItem) => baseItem.id === checkTranslatedItem.id,
            );

            if (gradedItem) {
                baseItem.grading = gradedItem;

                if (
                    gradedItem.accuracy.meaning < 0 ||
                    gradedItem.accuracy.meaning > 4
                ) {
                    baseItem.lastFailure =
                        "The meaning score must be between 0 and 4.";
                    continue;
                }

                if (
                    gradedItem.accuracy.toneStyle < 0 ||
                    gradedItem.accuracy.toneStyle > 2
                ) {
                    baseItem.lastFailure =
                        "The tone style score must be between 0 and 2.";
                    continue;
                }

                if (
                    gradedItem.accuracy.grammarSyntax < 0 ||
                    gradedItem.accuracy.grammarSyntax > 2
                ) {
                    baseItem.lastFailure =
                        "The grammar syntax score must be between 0 and 2.";
                    continue;
                }

                if (
                    gradedItem.formatting.punctuationSpacing < 0 ||
                    gradedItem.formatting.punctuationSpacing > 2
                ) {
                    baseItem.lastFailure =
                        "The punctuation spacing score must be between 0 and 2.";
                    continue;
                }

                if (
                    gradedItem.formatting.capitalizationFormatting < 0 ||
                    gradedItem.formatting.capitalizationFormatting > 2
                ) {
                    baseItem.lastFailure =
                        "The capitalization formatting score must be between 0 and 2.";
                    continue;
                }

                if (
                    gradedItem.fluencyReadability.naturalness < 0 ||
                    gradedItem.fluencyReadability.naturalness > 2
                ) {
                    baseItem.lastFailure =
                        "The naturalness score must be between 0 and 2.";
                    continue;
                }

                if (
                    gradedItem.fluencyReadability.clarity < 0 ||
                    gradedItem.fluencyReadability.clarity > 2
                ) {
                    baseItem.lastFailure =
                        "The clarity score must be between 0 and 2.";
                    continue;
                }

                if (
                    gradedItem.consistency.terminologyWordChoice < 0 ||
                    gradedItem.consistency.terminologyWordChoice > 2
                ) {
                    baseItem.lastFailure =
                        "The terminology word choice score must be between 0 and 2.";
                    continue;
                }

                if (
                    gradedItem.culturalAdaptation.localization < 0 ||
                    gradedItem.culturalAdaptation.localization > 2
                ) {
                    baseItem.lastFailure =
                        "The localization score must be between 0 and 2.";
                    continue;
                }

                output.push({
                    ...baseItem,
                    failure: "",
                } as GradeItem);
            }
        }

        return output;
    }

    private async runJob(
        options: GenerateGradeOptionsJson,
    ): Promise<GradeItem[]> {
        const generateState: GenerateStateJson = {
            fixedTranslationMappings: {},
            generationRetries: 0,
            translationToRetryAttempts: {},
        };

        const generationPromptText = gradingPromptJson(
            options.originalLanguage,
            options.translatedLanguage,
            this.generateGradeItemsInput(options.gradeItems),
        );

        let grades = "";
        try {
            grades = await retryJob(
                this.generateJob.bind(this),
                [
                    generationPromptText,
                    generateState,
                    GradingScaleItemOutputArraySchema,
                ],
                RETRY_ATTEMPTS,
                true,
                0,
                false,
            );
        } catch (e) {
            printError(`Failed to grade: ${e}\n`);
        }

        console.log(grades);

        const parsedOutput = this.parseGradingToJson(grades);
        const validTranslationObjects = parsedOutput.filter(
            this.isValidGradeItem,
        );

        return this.createGradeItemsWithTranslation(
            options.gradeItems,
            validTranslationObjects,
        );
    }

    private verifyGenerationAndRetry(
        generationPromptText: string,
        generateState: GenerateStateJson,
    ): Promise<string> {
        generateState.generationRetries++;
        if (generateState.generationRetries > 10) {
            this.chats.resetChatHistory();
            return Promise.reject(
                new Error(
                    "Failed to generate content due to exception. Resetting history.",
                ),
            );
        }

        printError(`Erroring text = ${generationPromptText}\n`);

        this.chats.rollbackLastMessage();
        return Promise.reject(
            new Error("Failed to generate content due to exception."),
        );
    }

    private async generateJob(
        generationPromptText: string,
        generateState: GenerateStateJson,
        format: ZodType<any, ZodTypeDef, any>,
    ): Promise<string> {
        const text = await this.chats.sendMessage(generationPromptText, format);

        if (!text) {
            return this.verifyGenerationAndRetry(
                generationPromptText,
                generateState,
            );
        } else {
            generateState.generationRetries = 0;
        }

        return text;
    }
}

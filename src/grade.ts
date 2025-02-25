import {
    DEFAULT_BATCH_SIZE,
    DEFAULT_REQUEST_TOKENS,
    FLATTEN_DELIMITER,
} from "./constants";
import { flatten } from "flat";
import {
    getLanguageCodeFromFilename,
    printError,
    printExecutionTime,
    printInfo,
} from "./utils";
import GenerateTranslationJson from "./generate_json/generate";
import fs from "fs";
import type { TranslationStatsItem } from "./types";
import type GradeFileOptions from "./interfaces/grade_file_options";
import type GradeOptions from "./interfaces/grade_options";

function startTranslationStatsItem(): TranslationStatsItem {
    return {
        batchStartTime: 0,
        enqueuedItems: 0,
        processedItems: 0,
        processedTokens: 0,
        totalItems: 0,
        totalTokens: 0,
    } as TranslationStatsItem;
}

function setDefaults(options: GradeOptions): void {
    if (!options.batchMaxTokens)
        options.batchMaxTokens = DEFAULT_REQUEST_TOKENS;
    if (!options.batchSize) options.batchSize = DEFAULT_BATCH_SIZE;
    if (!options.verbose) options.verbose = false;
}

/**
 * Translate the input JSON to the given language
 * @param options - The options for the translation
 */
export default async function grade(options: GradeOptions): Promise<Object> {
    setDefaults(options);

    if (options.verbose) {
        printInfo(
            `Grading from ${options.originalLanguage} to ${options.translatedLanguage}...`,
        );
    }

    const flattenedOriginalJson = flatten(options.originalJSON, {
        delimiter: FLATTEN_DELIMITER,
    }) as {
        [key: string]: string;
    };

    const flattenedTranslatedJson = flatten(options.translatedJSON, {
        delimiter: FLATTEN_DELIMITER,
    }) as {
        [key: string]: string;
    };

    const translationStats = startTranslationStatsItem();

    const generateTranslationJson = new GenerateTranslationJson(options);

    await generateTranslationJson.translateJson(
        flattenedOriginalJson,
        flattenedTranslatedJson,
        options,
        translationStats,
    );

    if (options.verbose) {
        printExecutionTime(
            translationStats.batchStartTime,
            "Total execution time: ",
        );
    }

    return Object;
}

/**
 * Wraps grade to take an base file and translated file
 * @param options - The file grading options
 */
export async function gradeFile(options: GradeFileOptions): Promise<void> {
    let originalJSON = {};
    try {
        const originalFile = fs.readFileSync(options.originalFilePath, "utf-8");
        originalJSON = JSON.parse(originalFile);
    } catch (e) {
        printError(`Invalid input JSON: ${e}`);
        return;
    }

    let translatedJSON = {};
    try {
        const translatedFile = fs.readFileSync(
            options.translatedFilePath,
            "utf-8",
        );

        translatedJSON = JSON.parse(translatedFile);
    } catch (e) {
        printError(`Invalid input JSON: ${e}`);
        return;
    }

    const originalLanguage = getLanguageCodeFromFilename(
        options.originalFilePath,
    );

    const translatedLanguage = getLanguageCodeFromFilename(
        options.translatedFilePath,
    );

    try {
        await grade({
            apiKey: options.apiKey,
            batchMaxTokens: options.batchMaxTokens,
            batchSize: options.batchSize,
            chatParams: options.chatParams,
            engine: options.engine,
            host: options.host,
            model: options.model,
            originalJSON,
            originalLanguage,
            rateLimitMs: options.rateLimitMs,
            translatedJSON,
            translatedLanguage,
            verbose: options.verbose,
        });
    } catch (err) {
        printError(`Failed to grade file: ${err}`);
    }
}

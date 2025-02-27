import {
    DEFAULT_BATCH_SIZE,
    DEFAULT_REQUEST_TOKENS,
    FLATTEN_DELIMITER,
} from "./constants";
import {
    displayFullTranslationProcess,
    printError,
    printExecutionTime,
    printInfo,
    printResults,
} from "./print";
import { flatten } from "flat";
import { getFileName, getGradeStats } from "./utils";
import GenerateTranslationJson from "./generate_json/generate";
import fs from "fs";
import type { ExportGradeItem } from "./generate_json/types";
import type { TranslationStatsItem } from "./types";
import type GradeFileOptions from "./interfaces/grade_file_options";
import type GradeOptions from "./interfaces/grade_options";

function startTranslationStatsItem(): TranslationStatsItem {
    return {
        batchEndTime: 0,
        batchStartTime: 0,
        enqueuedHistoryTokens: 0,
        enqueuedItems: 0,
        enqueuedTokens: 0,
        receivedTokens: 0,
        totalItems: 0,
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

    const response = await generateTranslationJson.translateJson(
        flattenedOriginalJson,
        flattenedTranslatedJson,
        options,
        translationStats,
    );

    const exportGradeItem: ExportGradeItem = {
        gradeItems: response,
        gradingStats: getGradeStats(response),
        translationStats,
    };

    if (response) {
        fs.writeFileSync(
            `graded_${options.translatedFileName}.json`,
            JSON.stringify(exportGradeItem, null, 4),
        );
    }

    if (options.verbose) {
        printExecutionTime(
            translationStats.batchStartTime,
            translationStats.batchEndTime,
            "Total execution time: ",
        );
        displayFullTranslationProcess(translationStats);
        printResults(exportGradeItem.gradingStats);
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
            originalLanguage: options.originalFileLanguage,
            rateLimitMs: options.rateLimitMs,
            translatedFileName: getFileName(options.translatedFilePath),
            translatedJSON,
            translatedLanguage: options.translatedFileLanguage,
            verbose: options.verbose,
        });
    } catch (err) {
        printError(`Failed to grade file: ${err}`);
    }
}

/**
 * Recalculates grading stats
 * @param filePath - The file path
 */
export function calculateGradeStats(filePath: string): void {
    let gradeItemFile = {} as ExportGradeItem;
    try {
        const originalFile = fs.readFileSync(filePath, "utf-8");
        gradeItemFile = JSON.parse(originalFile);
    } catch (e) {
        printError(`Invalid input JSON: ${e}`);
        return;
    }

    gradeItemFile.gradingStats = getGradeStats(gradeItemFile.gradeItems);

    if (gradeItemFile.translationStats) {
        displayFullTranslationProcess(gradeItemFile.translationStats);
    } else {
        console.info("No translation token info");
    }

    printResults(gradeItemFile.gradingStats);

    fs.writeFileSync(filePath, JSON.stringify(gradeItemFile, null, 4));
}

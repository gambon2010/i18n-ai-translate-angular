import ISO6391 from "iso-639-1";
import ansiColors from "ansi-colors";
import fs from "fs";
import path from "path";
import type { GradeItemOutput, GradingStats } from "./generate_json/types";

/**
 * @param delayDuration - time (in ms) to delay
 * @returns a promise that resolves after delayDuration
 */
export function delay(delayDuration: number): Promise<void> {
    // eslint-disable-next-line no-promise-executor-return
    return new Promise((resolve) => setTimeout(resolve, delayDuration));
}

/**
 * @param error - the error message
 */
export function printError(error: string): void {
    console.error(ansiColors.redBright(error));
}

/**
 * @param warn - the warning message
 */
export function printWarn(warn: string): void {
    console.warn(ansiColors.yellowBright(warn));
}

/**
 * @param info - the message
 */
export function printInfo(info: string): void {
    console.info(ansiColors.cyanBright(info));
}

/**
 * @param job - the function to retry
 * @param jobArgs - arguments to pass to job
 * @param maxRetries - retries of job before throwing
 * @param firstTry - whether this is the first try
 * @param delayDuration - time (in ms) before attempting job retry
 * @param sendError - whether to send a warning or error
 * @returns the result of job
 */
export async function retryJob<Type>(
    job: (...args: any) => Promise<Type>,
    jobArgs: Array<any>,
    maxRetries: number,
    firstTry: boolean,
    delayDuration?: number,
    sendError = true,
): Promise<Type> {
    if (!firstTry && delayDuration) {
        await delay(delayDuration);
    }

    return job(...jobArgs).catch((err) => {
        if (sendError) {
            printError(`err = ${err}`);
        } else {
            printWarn(`err = ${err}`);
        }

        if (maxRetries <= 0) {
            throw err;
        }

        return retryJob(job, jobArgs, maxRetries - 1, false, delayDuration);
    });
}

/**
 * @returns all language codes
 */
export function getAllLanguageCodes(): string[] {
    return ISO6391.getAllCodes();
}

/**
 * @param directory - the directory to list all files for
 * @returns all files with their absolute path that exist within the directory, recursively
 */
export function getAllFilesInPath(directory: string): Array<string> {
    const files: Array<string> = [];
    for (const fileOrDir of fs.readdirSync(directory)) {
        const fullPath = path.join(directory, fileOrDir);
        if (fs.lstatSync(fullPath).isDirectory()) {
            files.push(...getAllFilesInPath(fullPath));
        } else {
            files.push(fullPath);
        }
    }

    return files;
}

/**
 * @param sourceFilePath - the source file's path
 * @param key - the key associated with the translation
 * @param inputLanguageCode - the language code of the source language
 * @param outputLanguageCode - the language code of the output language
 * @returns a key to use when translating a key from a directory;
 * swaps the input language code with the output language code
 */
export function getTranslationDirectoryKey(
    sourceFilePath: string,
    key: string,
    inputLanguageCode: string,
    outputLanguageCode?: string,
): string {
    const outputPath = sourceFilePath.replace(
        `/${inputLanguageCode}/`,
        `/${outputLanguageCode ?? inputLanguageCode}/`,
    );

    return `${outputPath}:${key}`;
}

/**
 * @param startTime - the startTime
 * @param prefix - the prefix of the Execution Time
 */
export function printExecutionTime(startTime: number, prefix?: string): void {
    const endTime = Date.now();
    const roundedSeconds = Math.round((endTime - startTime) / 1000);

    printInfo(`${prefix}${roundedSeconds} seconds\n`);
}

/**
 * @param title - the title
 * @param startTime - the startTime
 * @param totalItems - the totalItems
 * @param processedItems - the processedItems
 */
export function printProgress(
    title: string,
    startTime: number,
    totalItems: number,
    processedItems: number,
): void {
    const roundedEstimatedTimeLeftSeconds = Math.round(
        (((Date.now() - startTime) / (processedItems + 1)) *
            (totalItems - processedItems)) /
            1000,
    );

    const percentage = ((processedItems / totalItems) * 100).toFixed(0);

    process.stdout.write(
        `\r${ansiColors.blueBright(title)} | ${ansiColors.greenBright(`Completed ${percentage}%`)} | ${ansiColors.yellowBright(`ETA: ${formatTime(roundedEstimatedTimeLeftSeconds)}             `)}`,
    );
}

function formatTime(seconds: number): string {
    const hh = Math.floor(seconds / 3600);
    const mm = Math.floor((seconds % 3600) / 60);
    const ss = seconds % 60;

    return [hh, mm, ss]
        .map((unit) => String(unit).padStart(2, "0")) // Ensures two-digit formatting
        .join(":");
}

/**
 * @param gradeItems - the gradeItems
 * @returns the mean of the results
 */
export function getGradeStats(gradeItems: GradeItemOutput[]): GradingStats {
    const total = {
        M2: 0,
        accuracy: 0,
        consistency: 0,
        culturalAdaptation: 0,
        fluencyReadability: 0,
        formatting: 0,
        mean: 0,
    };

    const totalScoreArray: number[] = [];

    const itemCount = gradeItems.length;

    let highestScore = 0;
    let lowestScore = 100;

    let validItems = 0;
    let count = 0;
    for (const gradeItem of gradeItems) {
        total.accuracy += gradeItem.grading.accuracy;

        total.formatting += gradeItem.grading.formatting;

        total.fluencyReadability += gradeItem.grading.fluencyReadability;

        total.consistency += gradeItem.grading.consistency;

        total.culturalAdaptation += gradeItem.grading.culturalAdaptation;

        const sum =
            gradeItem.grading.accuracy +
            gradeItem.grading.formatting +
            gradeItem.grading.fluencyReadability +
            gradeItem.grading.consistency +
            gradeItem.grading.culturalAdaptation;

        count++;

        const delta = sum - total.mean;
        total.mean += delta / count;
        const delat2 = sum - total.mean;
        total.M2 += delta * delat2;

        totalScoreArray.push(sum);

        if (sum > highestScore) highestScore = sum;
        if (sum < lowestScore) lowestScore = sum;
        if (gradeItem.grading.valid) validItems++;
    }

    console.log(JSON.stringify(totalScoreArray));

    const variance = count > 1 ? total.M2 / count : 0;

    const confidenceInterval = calculateConfidenceInterval(
        total.mean,
        variance,
        itemCount,
    );

    const quartiles = getQuartiles(totalScoreArray);

    return {
        IQR: quartiles.IQR,
        Q1: quartiles.Q1,
        Q3: quartiles.Q3,
        accuracyMean: total.accuracy / itemCount,
        confidenceIntervalHigh: confidenceInterval.upperBound,
        confidenceIntervalLow: confidenceInterval.lowerBound,
        consistencyMean: total.consistency / itemCount,
        culturalAdaptationMean: total.culturalAdaptation / itemCount,
        fluencyReadabilityMean: total.fluencyReadability / itemCount,
        formattingMean: total.formatting / itemCount,
        highestScore,
        lowestScore,
        median: quartiles.median,
        standardDeviation: Math.sqrt(variance),
        totalMean: total.mean,
        validPercent: (validItems / itemCount) * 100,
        variance,
    };
}

/**
 * @param gradingStats - the GradingStats
 */
export function printResults(gradingStats: GradingStats): void {
    console.log(
        ansiColors.bold(
            "\n================= 📊 Grading Statistics 📊 =================\n",
        ),
    );

    console.log(ansiColors.bold("Category Means:"));
    console.log(
        ansiColors.gray(
            "------------------------------------------------------------",
        ),
    );

    console.log(
        `🔹 Accuracy:             ${ansiColors.cyan(gradingStats.accuracyMean.toFixed(2))}/100`,
    );

    console.log(
        `🔹 Formatting:           ${ansiColors.cyan(gradingStats.formattingMean.toFixed(2))}/100`,
    );

    console.log(
        `🔹 Fluency Readability:  ${ansiColors.cyan(gradingStats.fluencyReadabilityMean.toFixed(2))}/100`,
    );

    console.log(
        `🔹 Consistency:          ${ansiColors.cyan(gradingStats.consistencyMean.toFixed(2))}/100`,
    );

    console.log(
        `🔹 Cultural Adaptation:  ${ansiColors.cyan(gradingStats.culturalAdaptationMean.toFixed(2))}/100`,
    );

    console.log(
        ansiColors.gray(
            "------------------------------------------------------------",
        ),
    );

    console.log(`\n${ansiColors.bold("Overall Statistics:")}`);
    console.log(
        ansiColors.gray(
            "------------------------------------------------------------",
        ),
    );

    console.log(
        `📌 Total Mean:            ${ansiColors.green(gradingStats.totalMean.toFixed(2))}/100`,
    );

    console.log(
        `📌 Variance:              ${ansiColors.magenta(gradingStats.variance.toFixed(2))}`,
    );

    console.log(
        `📌 Standard Deviation:    ${ansiColors.magenta(gradingStats.standardDeviation.toFixed(2))}`,
    );

    console.log(
        ansiColors.gray(
            "------------------------------------------------------------",
        ),
    );

    console.log(`\n${ansiColors.bold("Confidence Interval (95%):")}`);
    console.log(
        ansiColors.gray(
            "------------------------------------------------------------",
        ),
    );

    console.log(
        `✅ Lower Bound:          ${ansiColors.yellow(gradingStats.confidenceIntervalLow.toFixed(2))}/100`,
    );

    console.log(
        `✅ Upper Bound:          ${ansiColors.yellow(gradingStats.confidenceIntervalHigh.toFixed(2))}/100`,
    );

    console.log(
        ansiColors.gray(
            "------------------------------------------------------------",
        ),
    );

    console.log(`\n${ansiColors.bold("Quartiles & IQR:")}`);
    console.log(
        ansiColors.gray(
            "------------------------------------------------------------",
        ),
    );

    console.log(
        `🔸 Q1 (25%):             ${ansiColors.blue(gradingStats.Q1.toFixed(2))}/100`,
    );

    console.log(
        `🔸 Median (50%):         ${ansiColors.blue(gradingStats.median.toFixed(2))}/100`,
    );

    console.log(
        `🔸 Q3 (75%):             ${ansiColors.blue(gradingStats.Q3.toFixed(2))}/100`,
    );

    console.log(
        `🔸 Interquartile Range:  ${ansiColors.blue(gradingStats.IQR.toFixed(2))}`,
    );

    console.log(
        ansiColors.gray(
            "------------------------------------------------------------",
        ),
    );

    console.log(
        `🔸 Highest score:        ${ansiColors.red(gradingStats.highestScore.toFixed(2))}/100`,
    );

    console.log(
        `🔸 Lowest score:         ${ansiColors.red(gradingStats.lowestScore.toFixed(2))}/100`,
    );

    console.log(
        `🔸 Valid items:          ${ansiColors.red(gradingStats.validPercent.toFixed(2))}%`,
    );

    console.log(
        ansiColors.gray(
            "------------------------------------------------------------",
        ),
    );

    console.log(
        `\n✅ ${ansiColors.bold(
            "Summary:",
        )} The middle 50% of scores lie between ${ansiColors.green(
            gradingStats.Q1.toFixed(2),
        )} and ${ansiColors.green(gradingStats.Q3.toFixed(2))}, ` +
            `with an average score of ${ansiColors.cyan(gradingStats.totalMean.toFixed(2))}.`,
    );

    console.log(
        ansiColors.bold(
            "\n============================================================\n",
        ),
    );
}

function getPercentile(sorted: number[], percentile: number): number {
    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) return sorted[lower];

    // Linear interpolation between the two closest ranks
    return sorted[lower] + (index - lower) * (sorted[upper] - sorted[lower]);
}

function getQuartiles(scores: number[]): {
    IQR: number;
    Q1: number;
    Q3: number;
    median: number;
} {
    if (scores.length === 0) {
        throw new Error("Array is empty");
    }

    // Sort the array in ascending order
    const sorted = scores.slice().sort((a, b) => a - b);

    // Compute quartiles
    const Q1 = getPercentile(sorted, 25);
    const median = getPercentile(sorted, 50);
    const Q3 = getPercentile(sorted, 75);
    const IQR = Q3 - Q1;

    return { IQR, Q1, Q3, median };
}

function calculateConfidenceInterval(
    mean: number,
    variance: number,
    itemCount: number,
    confidenceLevel: number = 0.95,
): { lowerBound: number; upperBound: number } {
    if (itemCount <= 1)
        throw new Error("Not enough data points for confidence interval");

    // Standard deviation from variance
    const stdDev = Math.sqrt(variance);

    // Standard error of the mean
    const standardError = stdDev / Math.sqrt(itemCount);

    // Get Z-score based on confidence level (for 95% CI, Z ≈ 1.96)
    const zTable: { [key: number]: number } = {
        0.9: 1.645,
        0.95: 1.96,
        0.99: 2.576,
    };

    const z = zTable[confidenceLevel] || 1.96; // Default to 95% if invalid level

    // Compute margin of error
    const marginOfError = z * standardError;

    // Confidence interval bounds
    const lowerBound = mean - marginOfError;
    const upperBound = mean + marginOfError;

    return { lowerBound, upperBound };
}

import ansiColors from "ansi-colors";
import type { GradingStats } from "./generate_json/types";
import type { TranslationStatsItem } from "./types";

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
 * @param startTime - the startTime
 * @param endTime - the endTime
 * @param prefix - the prefix of the Execution Time
 */
export function printExecutionTime(
    startTime: number,
    endTime: number,
    prefix?: string,
): void {
    const roundedSeconds = Math.round((endTime - startTime) / 1000);

    printInfo(`${prefix}${formatTime(roundedSeconds)}\n`);
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
 * @param stats - the translation stats
 * @returns total price for category
 */
export function displayTranslationStats(stats: TranslationStatsItem): number {
    console.info(
        `${ansiColors.green("▶ Enqueued Items:")} ${stats.enqueuedItems}/${stats.totalItems}`,
    );

    const inputPrice = stats.enqueuedTokens * gpt40PricingPerToken.input;

    console.info(
        `${ansiColors.yellow("▶ Enqueued Message Tokens:")} ${stats.enqueuedTokens} - ${ansiColors.bold(`$${inputPrice.toFixed(3)}`)}`,
    );

    const cachedInputPrice =
        stats.enqueuedHistoryTokens * gpt40PricingPerToken.cachedInput;

    console.info(
        `${ansiColors.blue("▶ Enqueued History Tokens:")} ${stats.enqueuedHistoryTokens} - ${ansiColors.bold(`$${cachedInputPrice.toFixed(3)}`)}`,
    );

    const responsePrice = stats.receivedTokens * gpt40PricingPerToken.output;

    console.info(
        `${ansiColors.magenta("▶ Received Tokens:")} ${stats.receivedTokens} - ${ansiColors.bold(`$${responsePrice.toFixed(3)}`)}`,
    );

    const totalPrice = inputPrice + cachedInputPrice + responsePrice;
    console.info(
        ansiColors.bold.bgMagenta.white(
            `\n- Category Price: $${totalPrice.toFixed(3)}\n`,
        ),
    );

    return totalPrice;
}

/**
 * @param translationStats - the translation stats
 */
export function displayFullTranslationProcess(
    translationStats: TranslationStatsItem,
): void {
    let totalPrice = 0;
    console.info(ansiColors.bold.bgBlue.white("\n=== Grading price ===\n"));

    totalPrice += displayTranslationStats(translationStats);

    console.info(
        ansiColors.bold.bgRed.white(
            `\n- Grand Total Price: $${totalPrice.toFixed(3)}\n`,
        ),
    );
}

const gpt40PricingPerToken = {
    cachedInput: 1.25 / 1000000,
    input: 2.5 / 1000000,
    output: 10 / 1000000,
};

function displayHistogram(scores: number[]): void {
    console.info(`\n${ansiColors.bold("Score Distribution Histogram:")}`);
    console.info(
        ansiColors.gray(
            "------------------------------------------------------------",
        ),
    );

    const bins = [
        { count: 0, label: "  0-10" },
        { count: 0, label: " 11-20" },
        { count: 0, label: " 21-30" },
        { count: 0, label: " 31-40" },
        { count: 0, label: " 41-50" },
        { count: 0, label: " 51-60" },
        { count: 0, label: " 61-70" },
        { count: 0, label: " 71-80" },
        { count: 0, label: " 81-90" },
        { count: 0, label: "91-100" },
    ];

    // Count frequencies per bin
    for (const score of scores) {
        const index = Math.min(Math.floor(score / 10), 9); // Ensure 100 goes in last bin
        bins[index].count++;
    }

    // Determine scaling factor
    const maxStars = 50; // Max stars to display
    const maxCount = Math.max(...bins.map((bin) => bin.count)) || 1;
    const scale = maxCount > maxStars ? maxStars / maxCount : 1;

    // Print histogram with true scaling
    for (const bin of bins) {
        console.info(
            `${ansiColors.bold(bin.label)} | ${ansiColors.green("*".repeat(Math.floor(bin.count * scale)))}`,
        );
    }

    console.info(
        ansiColors.gray(
            "------------------------------------------------------------",
        ),
    );
}

/**
 * @param gradingStats - the GradingStats
 */
export function printResults(gradingStats: GradingStats): void {
    console.info(
        ansiColors.bold(
            "\n================= 📊 Grading Statistics 📊 =================\n",
        ),
    );

    console.info(ansiColors.bold("Category Means:"));
    console.info(
        ansiColors.gray(
            "------------------------------------------------------------",
        ),
    );

    console.info(
        `🔹 Accuracy:             ${ansiColors.cyan(gradingStats.accuracyMean.toFixed(2))}/100`,
    );

    console.info(
        `🔹 Formatting:           ${ansiColors.cyan(gradingStats.formattingMean.toFixed(2))}/100`,
    );

    console.info(
        `🔹 Fluency Readability:  ${ansiColors.cyan(gradingStats.fluencyReadabilityMean.toFixed(2))}/100`,
    );

    console.info(
        `🔹 Consistency:          ${ansiColors.cyan(gradingStats.consistencyMean.toFixed(2))}/100`,
    );

    console.info(
        `🔹 Cultural Adaptation:  ${ansiColors.cyan(gradingStats.culturalAdaptationMean.toFixed(2))}/100`,
    );

    console.info(
        ansiColors.gray(
            "------------------------------------------------------------",
        ),
    );

    console.info(`\n${ansiColors.bold("Overall Statistics:")}`);
    console.info(
        ansiColors.gray(
            "------------------------------------------------------------",
        ),
    );

    console.info(
        `📌 Total Mean:            ${ansiColors.green(gradingStats.totalMean.toFixed(2))}/100`,
    );

    console.info(
        `📌 Variance:              ${ansiColors.magenta(gradingStats.variance.toFixed(2))}`,
    );

    console.info(
        `📌 Standard Deviation:    ${ansiColors.magenta(gradingStats.standardDeviation.toFixed(2))}`,
    );

    console.info(
        ansiColors.gray(
            "------------------------------------------------------------",
        ),
    );

    console.info(`\n${ansiColors.bold("Confidence Interval (95%):")}`);
    console.info(
        ansiColors.gray(
            "------------------------------------------------------------",
        ),
    );

    console.info(
        `✅ Lower Bound:          ${ansiColors.yellow(gradingStats.confidenceIntervalLow.toFixed(2))}/100`,
    );

    console.info(
        `✅ Upper Bound:          ${ansiColors.yellow(gradingStats.confidenceIntervalHigh.toFixed(2))}/100`,
    );

    console.info(
        ansiColors.gray(
            "------------------------------------------------------------",
        ),
    );

    console.info(`\n${ansiColors.bold("Quartiles & IQR:")}`);
    console.info(
        ansiColors.gray(
            "------------------------------------------------------------",
        ),
    );

    console.info(
        `🔸 Q1 (25%):             ${ansiColors.blue(gradingStats.Q1.toFixed(2))}/100`,
    );

    console.info(
        `🔸 Median (50%):         ${ansiColors.blue(gradingStats.median.toFixed(2))}/100`,
    );

    console.info(
        `🔸 Q3 (75%):             ${ansiColors.blue(gradingStats.Q3.toFixed(2))}/100`,
    );

    console.info(
        `🔸 Interquartile Range:  ${ansiColors.blue(gradingStats.IQR.toFixed(2))}`,
    );

    console.info(
        ansiColors.gray(
            "------------------------------------------------------------",
        ),
    );

    console.info(
        `🔸 Highest score:        ${ansiColors.red(gradingStats.highestScore.toFixed(2))}/100`,
    );

    console.info(
        `🔸 Lowest score:         ${ansiColors.red(gradingStats.lowestScore.toFixed(2))}/100`,
    );

    console.info(
        `🔸 Valid items:          ${ansiColors.red(gradingStats.validPercent.toFixed(2))}%`,
    );

    console.info(
        ansiColors.gray(
            "------------------------------------------------------------",
        ),
    );

    displayHistogram(gradingStats.totalScoreArray);

    console.info(
        `\n✅ ${ansiColors.bold(
            "Summary:",
        )} The middle 50% of scores lie between ${ansiColors.green(
            gradingStats.Q1.toFixed(2),
        )} and ${ansiColors.green(gradingStats.Q3.toFixed(2))}, ` +
            `with an average score of ${ansiColors.cyan(gradingStats.totalMean.toFixed(2))}.`,
    );

    console.info(
        ansiColors.bold(
            "\n============================================================\n",
        ),
    );
}

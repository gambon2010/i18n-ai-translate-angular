import ansiColors from "ansi-colors";
import type { TranslationStats, TranslationStatsItem } from "./types";
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
    translationStats: TranslationStats,
): void {
    let totalPrice = 0;
    console.info(
        ansiColors.bold.bgBlue.white("\n=== Full Translation Process ===\n"),
    );

    console.info(
        ansiColors.bold.bgYellow.black("\n--- Translation Phase ---\n"),
    );
    totalPrice += displayTranslationStats(translationStats.translate);

    if (translationStats.verify.receivedTokens > 0) {
        console.info(
            ansiColors.bold.bgGreen.black("\n--- Verification Phase ---\n"),
        );
        totalPrice += displayTranslationStats(translationStats.verify);
    }

    if (translationStats.style.receivedTokens > 0) {
        console.info(
            ansiColors.bold.bgMagenta.white(
                "\n--- Style Verification Phase ---\n",
            ),
        );
        totalPrice += displayTranslationStats(translationStats.style);
    }

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

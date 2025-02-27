import { delay } from "./utils";
import { printInfo } from "./print";

export default class RateLimiter {
    lastAPICall: number | null;

    delayBetweenCallsMs: number;

    verboseLogging: boolean;

    constructor(delayBetweenCallsMs: number, verboseLogging: boolean) {
        this.lastAPICall = null;
        this.delayBetweenCallsMs = delayBetweenCallsMs;
        this.verboseLogging = verboseLogging;
    }

    apiCalled(): void {
        this.lastAPICall = Date.now();
    }

    async wait(): Promise<void> {
        if (this.lastAPICall) {
            const timeToWait =
                this.delayBetweenCallsMs - (Date.now() - this.lastAPICall);

            if (timeToWait > 0) {
                if (this.verboseLogging) {
                    printInfo(
                        `RateLimiter | Waiting ${timeToWait}ms before next API call`,
                    );
                }

                await delay(timeToWait);
            }
        }
    }
}

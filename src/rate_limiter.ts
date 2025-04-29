<<<<<<< HEAD
import { delay } from "./utils";
import { printInfo } from "./print";
=======
import { delay, printInfo } from "./utils";
>>>>>>> master

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
<<<<<<< HEAD
                        `RateLimiter | Waiting ${timeToWait}ms before next API call`,
=======
                        `\nRateLimiter | Waiting ${timeToWait}ms before next API call`,
>>>>>>> master
                    );
                }

                await delay(timeToWait);
            }
        }
    }
}

import { Tiktoken } from "tiktoken";
import { printError } from "../print";
import { toGeminiSchema } from "gemini-zod";
import ChatInterface from "./chat_interface";
import Role from "../enums/role";
import cl100k_base from "tiktoken/encoders/cl100k_base.json";
import type {
    ChatSession,
    Content,
    GenerativeModel,
    StartChatParams,
} from "@google/generative-ai";
import type { TranslationStatsItem } from "../types";
import type { ZodType, ZodTypeDef } from "zod";
import type RateLimiter from "../rate_limiter";

interface HistoryEntry {
    role: Role;
    parts: string;
}

export default class Gemini extends ChatInterface {
    tikToken: Tiktoken;

    model: GenerativeModel;

    chat: ChatSession | null;

    history: HistoryEntry[];

    params: StartChatParams | null;

    rateLimiter: RateLimiter;

    constructor(model: GenerativeModel, rateLimiter: RateLimiter) {
        super();
        this.model = model;
        this.chat = null;
        this.history = [];
        this.params = null;
        this.rateLimiter = rateLimiter;
        this.tikToken = new Tiktoken(
            cl100k_base.bpe_ranks,
            cl100k_base.special_tokens,
            cl100k_base.pat_str,
        );
    }

    startChat(params: StartChatParams): void {
        this.params = params;

        if (this.history.length > 0) {
            params.history = this.history.map(
                (x): Content => ({
                    parts: [{ text: x.parts }],
                    role: x.role === Role.User ? "user" : "model",
                }),
            );
        }

        this.chat = this.model.startChat(params);
    }

    async sendMessage(
        message: string,
        translationStats: TranslationStatsItem,
        format?: ZodType<any, ZodTypeDef, any>,
    ): Promise<string> {
        if (!this.chat) {
            console.trace("Chat not started");
            return "";
        }

        await this.rateLimiter.wait();
        this.rateLimiter.apiCalled();

        if (format) {
            this.model.generationConfig.responseMimeType = "application/json";
            this.model.generationConfig.responseSchema = toGeminiSchema(format);
        } else {
            this.model.generationConfig.responseMimeType = "";
            this.model.generationConfig.responseSchema = undefined;
        }

        // Get message len and history len in token for stats/price estimates
        translationStats.enqueuedTokens += this.tikToken.encode(message).length;

        try {
            const generatedContent = await this.chat.sendMessage(message);
            const response = generatedContent.response.text();

            if (!response) {
                printError(
                    `Gemini exception encountered. err = ${JSON.stringify(generatedContent?.response, null, 4)}`,
                );
            }

            const responseText = response.trimEnd();

            // Get response length in tokens for stats/price estimates
            translationStats.receivedTokens +=
                this.tikToken.encode(responseText).length;

            return responseText;
        } catch (err) {
            printError(err);
            return "";
        }
    }

    resetChatHistory(): void {
        this.history = [];
        this.startChat(this.params!);
    }

    rollbackLastMessage(): void {
        if (this.history.length === 0) {
            return;
        }

        if (this.history[this.history.length - 1].role === Role.Assistant) {
            this.history.pop();
            this.history.pop();
        } else if (this.history[this.history.length - 1].role === Role.User) {
            this.history.pop();
        }

        this.startChat(this.params!);
    }

    invalidTranslation(): void {
        this.history.push({
            parts: this.invalidTranslationMessage(),
            role: Role.System,
        });
    }

    invalidStyling(): void {
        this.history.push({
            parts: this.invalidStylingMessage(),
            role: Role.System,
        });
    }
}

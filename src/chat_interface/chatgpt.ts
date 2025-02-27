import { Tiktoken } from "tiktoken";
import { printError } from "../print";
import { zodResponseFormat } from "openai/helpers/zod";
import ChatInterface from "./chat_interface";
import Role from "../enums/role";
import cl100k_base from "tiktoken/encoders/cl100k_base.json";
import type { TranslationStatsItem } from "../types";
import type { ZodType, ZodTypeDef } from "zod";
import type OpenAI from "openai";
import type RateLimiter from "../rate_limiter";

export default class ChatGPT extends ChatInterface {
    tikToken: Tiktoken;

    model: OpenAI;

    chatParams: OpenAI.ChatCompletionCreateParamsNonStreaming | null;

    history: OpenAI.ChatCompletionMessageParam[];

    rateLimiter: RateLimiter;

    constructor(model: OpenAI, rateLimiter: RateLimiter) {
        super();
        this.model = model;
        this.chatParams = null;
        this.history = [];
        this.rateLimiter = rateLimiter;
        this.tikToken = new Tiktoken(
            cl100k_base.bpe_ranks,
            cl100k_base.special_tokens,
            cl100k_base.pat_str,
        );
    }

    startChat(params: OpenAI.ChatCompletionCreateParamsNonStreaming): void {
        this.chatParams = params;
        if (params.messages.length > 0) {
            this.history = params.messages;
        }
    }

    async sendMessage(
        message: string,
        translationStats: TranslationStatsItem,
        format?: ZodType<any, ZodTypeDef, any>,
    ): Promise<string> {
        if (!this.chatParams) {
            console.trace("Chat not started");
            return "";
        }

        // Limit the history to prevent wasting tokens
        if (this.history.length > 10) {
            this.history = this.history.slice(this.history.length - 10);
        }

        // Get message len and history len in tokens for stats/price estimates
        translationStats.enqueuedTokens += this.tikToken.encode(message).length;
        translationStats.enqueuedHistoryTokens += this.tikToken.encode(
            this.history.map((message) => message.content).join(" "),
        ).length;

        await this.rateLimiter.wait();
        this.rateLimiter.apiCalled();
        this.history.push({ content: message, role: Role.User });

        const formatSchema = format
            ? zodResponseFormat(format, format.description ?? "responseObject")
            : undefined;

        try {
            const response = await this.model.chat.completions.create({
                ...this.chatParams,
                messages: this.history,
                response_format: formatSchema,
            });

            const responseText = response.choices[0].message.content;
            if (!responseText) {
                return "";
            }

            // Get response length in tokens for stats/price estimates
            translationStats.receivedTokens +=
                this.tikToken.encode(responseText).length;

            this.history.push({ content: responseText, role: Role.Assistant });
            return responseText;
        } catch (err) {
            printError(err);
            return "";
        }
    }

    resetChatHistory(): void {
        this.history = [];
    }

    rollbackLastMessage(): void {
        if (this.history[this.history.length - 1].role === Role.Assistant) {
            // Remove the last two messages (user and assistant)
            // so we can get back to the last successful state in history
            this.history.pop();
            this.history.pop();
        } else if (this.history[this.history.length - 1].role === Role.User) {
            // The model didn't respond, so we only need to remove the user message
            this.history.pop();
        }
    }

    invalidTranslation(): void {
        this.history.push({
            content: this.invalidTranslationMessage(),
            role: Role.System,
        });
    }

    invalidStyling(): void {
        this.history.push({
            content: this.invalidStylingMessage(),
            role: Role.System,
        });
    }
}

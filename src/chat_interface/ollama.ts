import { Tiktoken } from "tiktoken";
import { printError } from "../print";
import ChatInterface from "./chat_interface";
import Role from "../enums/role";
import cl100k_base from "tiktoken/encoders/cl100k_base.json";
import zodToJsonSchema from "zod-to-json-schema";
import type { ChatRequest, Ollama as InternalOllama, Message } from "ollama";
import type { TranslationStatsItem } from "../types";
import type { ZodType, ZodTypeDef } from "zod";

export default class Ollama extends ChatInterface {
    tikToken: Tiktoken;
    model: InternalOllama;

    chatParams:
        | (ChatRequest & {
              stream: false;
          })
        | null;

    history: Message[];

    constructor(model: InternalOllama) {
        super();
        this.model = model;
        this.chatParams = null;
        this.history = [];
        this.tikToken = new Tiktoken(
            cl100k_base.bpe_ranks,
            cl100k_base.special_tokens,
            cl100k_base.pat_str,
        );
    }

    startChat(params: ChatRequest): void {
        this.chatParams = { ...params, stream: false };
        if (params.messages && params.messages.length > 0) {
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

        // Get message len and history len in token for stats/price estimates
        translationStats.enqueuedTokens += this.tikToken.encode(message).length;
        translationStats.enqueuedHistoryTokens += this.tikToken.encode(
            this.history.map((message) => message.content).join(" "),
        ).length;

        this.history.push({ content: message, role: Role.User });

        const formatSchema = format ? zodToJsonSchema(format) : undefined;

        this.chatParams = {
            ...this.chatParams,
            format: formatSchema,
            messages: [{ content: message, role: Role.User }],
            // message history breaks small models, they translate the previous message over and over instead of translating the new lines
            // we should add a way to enable/disable message history
        };

        try {
            const response = await this.model.chat(this.chatParams);

            const responseText = response.message.content;
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

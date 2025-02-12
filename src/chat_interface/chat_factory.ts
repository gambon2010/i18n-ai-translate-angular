import {
    type ChatParams,
    type Model,
    TranslateItemOutputObjectSchema,
} from "../types";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Anthropic as InternalAnthropic } from "@anthropic-ai/sdk";
import { Ollama as InternalOllama } from "ollama";
import Anthropic from "./anthropic";
import ChatGPT from "./chatgpt";
import Engine from "../enums/engine";
import Gemini from "./gemini";
import Ollama from "./ollama";
import OpenAI from "openai";
import type ChatInterface from "./chat_interface";
import type RateLimiter from "../rate_limiter";
import { toGeminiSchema } from "gemini-zod";

export default class ChatFactory {
    static newChat(
        engine: Engine,
        model: Model,
        rateLimiter: RateLimiter,
        apiKey?: string,
        host?: string,
    ): ChatInterface {
        let chat: ChatInterface;
        let params: ChatParams;
        switch (engine) {
            case Engine.Gemini: {
                const genAI = new GoogleGenerativeAI(apiKey!);
                const geminiModel = genAI.getGenerativeModel({ model });

                geminiModel.generationConfig.responseMimeType =
                    "application/json";

                geminiModel.generationConfig.responseSchema = toGeminiSchema(
                    TranslateItemOutputObjectSchema,
                );

                chat = new Gemini(geminiModel, rateLimiter);
                params = {
                    history: [],
                };
                break;
            }

            case Engine.ChatGPT: {
                const openAI = new OpenAI({ apiKey: apiKey! });
                chat = new ChatGPT(openAI, rateLimiter);
                params = {
                    messages: [],
                    model,
                };
                break;
            }

            case Engine.Ollama: {
                const llama = new InternalOllama({ host });
                chat = new Ollama(llama);
                params = {
                    messages: [],
                    model,
                };

                break;
            }

            case Engine.Claude: {
                const anthropic = new InternalAnthropic({ apiKey: apiKey! });
                chat = new Anthropic(anthropic, rateLimiter);
                params = {
                    messages: [],
                    model,
                };

                break;
            }

            default:
                throw new Error("Invalid engine");
        }

        chat.startChat(params);
        return chat;
    }
}

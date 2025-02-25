import { CLI_HELP, DEFAULT_MODEL, VERSION } from "./constants";
import { config } from "dotenv";
import { gradeFile } from "./grade";
import { printError } from "./utils";
import { program } from "commander";
import Engine from "./enums/engine";
import fs from "fs";
import path from "path";
import type { ChatParams, Model, ModelArgs } from "./types";

config({ path: path.resolve(process.cwd(), ".env") });

const processModelArgs = (options: any): ModelArgs => {
    let model: Model;
    let chatParams: ChatParams;
    let rateLimitMs = Number(options.rateLimitMs);
    let apiKey: string | undefined;
    let host: string | undefined;
    let batchSize = Number(options.batchSize);
    let batchMaxTokens = Number(options.batchMaxTokens);

    switch (options.engine) {
        case Engine.Gemini:
            model = options.model || DEFAULT_MODEL[Engine.Gemini];
            chatParams = {};
            if (!options.rateLimitMs) {
                // gemini-2.0-flash-exp limits us to 10 RPM => 1 call every 6 seconds
                rateLimitMs = 6000;
            }

            if (!process.env.GEMINI_API_KEY && !options.apiKey) {
                throw new Error("GEMINI_API_KEY not found in .env file");
            } else {
                apiKey = options.apiKey || process.env.GEMINI_API_KEY;
            }

            if (!options.batchSize) {
                batchSize = 16;
            }

            if (!options.batchMaxTokens) {
                batchMaxTokens = 4096;
            }

            break;
        case Engine.ChatGPT:
            model = options.model || DEFAULT_MODEL[Engine.ChatGPT];
            chatParams = {
                messages: [],
                model,
                seed: 69420,
            };
            if (!options.rateLimitMs) {
                // Free-tier rate limits are 3 RPM => 1 call every 20 seconds
                // Tier 1 is a reasonable 500 RPM => 1 call every 120ms
                // TODO: token limits
                rateLimitMs = 120;
            }

            if (!process.env.OPENAI_API_KEY && !options.apiKey) {
                throw new Error("OPENAI_API_KEY not found in .env file");
            } else {
                apiKey = options.apiKey || process.env.OPENAI_API_KEY;
            }

            if (!options.batchSize) {
                batchSize = 16;
            }

            if (!options.batchMaxTokens) {
                batchMaxTokens = 4096;
            }

            break;
        case Engine.Ollama:
            model = options.model || DEFAULT_MODEL[Engine.Ollama];
            chatParams = {
                messages: [],
                model,
                seed: 69420,
            };

            host = options.host || process.env.OLLAMA_HOSTNAME;

            if (!options.batchSize) {
                // Ollama's error rate is high with large batches
                batchSize = 16;
            }

            if (!options.batchMaxTokens) {
                // Ollama's default amount of tokens per request
                batchMaxTokens = 2048;
            }

            break;
        default: {
            throw new Error("Invalid engine");
        }
    }

    return {
        apiKey,
        batchMaxTokens,
        batchSize,
        chatParams,
        host,
        model: options.model || DEFAULT_MODEL[options.engine as Engine],
        rateLimitMs,
    };
};

program
    .name("i18n-ai-grading")
    .description(
        "Use ChatGPT, Gemini, Ollama, or Anthropic to grade your translated i18n JSON",
    )
    .version(VERSION);

program
    .command("grade")
    .requiredOption(
        "-o, --original <original>",
        "Original i18n file or path of source language, in the jsons/ directory if a relative path is given",
    )
    .requiredOption(
        "-t, --translated <translated>",
        "Translated i18n file to grade",
    )
    .requiredOption("-e, --engine <engine>", CLI_HELP.Engine)
    .option("-m, --model <model>", CLI_HELP.Model)
    .option("-r, --rate-limit-ms <rateLimitMs>", CLI_HELP.RateLimit)
    .option("-k, --api-key <API key>", "API key")
    .option("-h, --host <hostIP:port>", CLI_HELP.OllamaHost)
    .option("-n, --batch-size <batchSize>", CLI_HELP.BatchSize)
    .option("--verbose", CLI_HELP.Verbose, false)
    .option("--batch-max-tokens <batch-max-tokens>", CLI_HELP.MaxTokens)
    .action(async (options: any) => {
        const {
            model,
            chatParams,
            rateLimitMs,
            apiKey,
            host,
            batchSize,
            batchMaxTokens,
        } = processModelArgs(options);

        let originalFilePath: string = options.original;
        if (path.isAbsolute(options.original)) {
            originalFilePath = path.resolve(options.original);
        }

        let translatedFilePath: string = options.translated;
        if (path.isAbsolute(options.translated)) {
            translatedFilePath = path.resolve(options.translated);
        }

        if (
            fs.statSync(originalFilePath).isFile() &&
            fs.statSync(translatedFilePath).isFile()
        ) {
            try {
                // eslint-disable-next-line no-await-in-loop
                await gradeFile({
                    apiKey,
                    batchMaxTokens,
                    batchSize,
                    chatParams,
                    engine: options.engine,
                    host,
                    model,
                    originalFilePath,
                    rateLimitMs,
                    translatedFilePath,
                    verbose: options.verbose,
                });
            } catch (err) {
                printError(`Failed to translate file to : ${err}`);
            }
        }
    });

program.parse();

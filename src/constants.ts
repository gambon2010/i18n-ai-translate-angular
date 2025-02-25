import Engine from "./enums/engine";

export const DEFAULT_BATCH_SIZE = 16;
export const DEFAULT_REQUEST_TOKENS = 4096;
export const VERSION = "0.0.1";
export const FLATTEN_DELIMITER = "*";
export const DEFAULT_MODEL = {
    [Engine.ChatGPT]: "gpt-4o",
    [Engine.Gemini]: "gemini-2.0-flash-exp",
    [Engine.Ollama]: "llama3.3",
};
export const RETRY_ATTEMPTS = 25;

export const CLI_HELP = {
    BatchSize:
        "How many keys to process at a time, 32 by default for chatgpt, 16 otherwise",
    Engine: "Engine to use (chatgpt, gemini, ollama, or claude)",
    MaxTokens: "The maximum token size of a request",
    Model: `Model to use (e.g. ${Object.values(DEFAULT_MODEL).join(", ")})`,
    OllamaHost:
        "The host and port number serving Ollama. 11434 is the default port number.",
    RateLimit:
        "How many milliseconds between requests (defaults to 1s for Gemini, 120ms (at 500RPM) for ChatGPT, 1200ms for Claude)",
    Verbose: "Print logs about progress",
};

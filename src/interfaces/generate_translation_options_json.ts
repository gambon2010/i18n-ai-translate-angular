import type { TranslateItem } from "../generate_json/types";
import type { TranslationStatsItem } from "../types";
import type OverridePrompt from "./override_prompt";

export default interface GenerateTranslationOptionsJson {
    inputLanguage: string;
    outputLanguage: string;
    translateItems: TranslateItem[];
    templatedStringPrefix: string;
    templatedStringSuffix: string;
    verboseLogging: boolean;
    ensureChangedTranslation: boolean;
    skipTranslationVerification: boolean;
    skipStylingVerification: boolean;
    overridePrompt?: OverridePrompt;
    disableThink: boolean;
    translationStats: TranslationStatsItem;
}

import type { TranslateItem } from "../generate_json/types";
<<<<<<< HEAD
import type { TranslationStatsItem } from "../types";
import type OverridePrompt from "./override_prompt";

export default interface GenerateTranslationOptionsJson {
=======
import type Chats from "./chats";
import type OverridePrompt from "./override_prompt";

export default interface GenerateTranslationOptionsJson {
    chats: Chats;
>>>>>>> master
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
<<<<<<< HEAD
    disableThink: boolean;
    translationStats: TranslationStatsItem;
=======
>>>>>>> master
}

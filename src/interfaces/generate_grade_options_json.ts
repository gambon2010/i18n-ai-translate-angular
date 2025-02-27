import type { GradeItem } from "../generate_json/types";
import type { TranslationStatsItem } from "../types";

export default interface GenerateGradeOptionsJson {
    originalLanguage: string;
    translatedLanguage: string;
    gradeItems: GradeItem[];
    verboseLogging: boolean;
    translationStats: TranslationStatsItem;
}

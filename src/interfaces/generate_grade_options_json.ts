import type { GradeItem } from "src/generate_json/types";

export default interface GenerateGradeOptionsJson {
    originalLanguage: string;
    translatedLanguage: string;
    gradeItems: GradeItem[];
    verboseLogging: boolean;
}

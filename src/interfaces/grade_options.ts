import type Options from "./options";

export default interface GradeOptions extends Options {
    originalJSON: Object;
    originalLanguage: string;
    translatedJSON: Object;
    translatedLanguage: string;
    translatedFileName: string;
}

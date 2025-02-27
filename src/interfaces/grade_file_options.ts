import type Options from "./options";

export default interface GradeFileOptions extends Options {
    originalFilePath: string;
    originalFileLanguage: string;
    translatedFilePath: string;
    translatedFileLanguage: string;
}

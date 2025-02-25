import type Options from "./options";

export default interface GradeFileOptions extends Options {
    originalFilePath: string;
    translatedFilePath: string;
}

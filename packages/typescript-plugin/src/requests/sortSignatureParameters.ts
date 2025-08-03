import type { RequestContext } from "./types";

export function sortSignatureParameters(
    this: RequestContext | undefined,
    fileName: string,
    offset: number,
    orders: number[],
) {
    if (!this) {
        return [];
    }
    const { languageService } = this;

    const program = languageService.getProgram()!;
    const sourceFile = program.getSourceFile(fileName);
    if (!sourceFile) {
        return [];
    }

    const references = languageService.getReferencesAtPosition(fileName, offset) ?? [];
    for (const reference of references) {
        void [orders, reference];
    }

    return [];
}

import type ts from "typescript";

export interface RequestContext {
    ts: typeof ts;
    languageService: ts.LanguageService;
}

export type Requests =
    & Pick<typeof import("./getSignatureParameters"), "getSignatureParameters">
    & Pick<typeof import("./swapSignatureParameters"), "swapSignatureParameters">;

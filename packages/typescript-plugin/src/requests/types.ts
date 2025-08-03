import type ts from "typescript";

export interface RequestContext {
    ts: typeof ts;
    languageService: ts.LanguageService;
}

export interface Requests {
    getSignatureParameters: typeof import("./getSignatureParameters")["getSignatureParameters"];
    sortSignatureParameters: typeof import("./sortSignatureParameters")["sortSignatureParameters"];
}

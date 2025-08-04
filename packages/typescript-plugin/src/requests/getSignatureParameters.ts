import { findSignatureDeclaration } from "./utils";
import type { RequestContext } from "./types";

export function getSignatureParameters(
    this: RequestContext | undefined,
    fileName: string,
    position: number,
) {
    if (!this) {
        return [];
    }
    const { ts, languageService } = this;

    const program = languageService.getProgram()!;
    const sourceFile = program.getSourceFile(fileName);
    if (!sourceFile) {
        return [];
    }

    const decl = findSignatureDeclaration(ts, sourceFile, position);
    if (!decl) {
        return [];
    }

    const checker = program.getTypeChecker();
    const signatureType = checker.getTypeAtLocation(decl);
    const signatures = checker.getSignaturesOfType(signatureType, ts.SignatureKind.Call);

    return signatures[0]?.getParameters().map((param) => {
        const type = checker.getTypeOfSymbol(param);
        const decl = param.valueDeclaration;
        const isRest = decl && ts.isParameter(decl) && ts.isRestParameter(decl) || void 0;
        return {
            name: param.name,
            type: checker.typeToString(type),
            isRest,
        };
    }) ?? [];
}

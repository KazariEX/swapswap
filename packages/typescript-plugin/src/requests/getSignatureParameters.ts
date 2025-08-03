import type ts from "typescript";
import type { RequestContext } from "./types";

export function getSignatureParameters(
    this: RequestContext | undefined,
    fileName: string,
    offset: number,
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

    let decl: ts.SignatureDeclaration | undefined;

    ts.forEachChild(sourceFile, function visit(node) {
        if (ts.isFunctionLike(node) && node.pos <= offset && node.end >= offset) {
            decl = node;
        }
        ts.forEachChild(node, visit);
    });

    if (!decl) {
        return [];
    }

    const checker = program.getTypeChecker();
    const signatureType = checker.getTypeAtLocation(decl);
    const signatures = checker.getSignaturesOfType(signatureType, ts.SignatureKind.Call);

    return signatures[0]?.getParameters().map((param) => {
        const type = checker.getTypeOfSymbol(param);
        return {
            name: param.getName(),
            type: checker.typeToString(type),
        };
    }) ?? [];
}

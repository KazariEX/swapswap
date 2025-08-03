import type ts from "typescript";
import { findCallExpressions, findSignatureDeclaration } from "./utils";
import type { RequestContext } from "./types";

export function swapSignatureParameters(
    this: RequestContext | undefined,
    fileName: string,
    position: number,
    orders: number[],
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

    const changes: ts.FileTextChanges[] = [];

    const change = calcTextChange(decl.parameters, sourceFile, orders);
    if (change) {
        changes.push({
            fileName,
            textChanges: [change],
        });
    }

    const references = languageService.getReferencesAtPosition(fileName, position) ?? [];
    const fileToTextSpans: Record<string, ts.TextSpan[]> = {};
    for (const reference of references) {
        (fileToTextSpans[reference.fileName] ??= []).push(reference.textSpan);
    }

    for (const [fileName, textSpans] of Object.entries(fileToTextSpans)) {
        const sourceFile = program.getSourceFile(fileName);
        if (!sourceFile) {
            return [];
        }

        textSpans.sort((a, b) => a.start - b.start);
        const expressions = findCallExpressions(ts, sourceFile, textSpans);
        const textChanges: ts.TextChange[] = [];

        for (const { arguments: args } of expressions) {
            const change = calcTextChange(args, sourceFile, orders);
            if (change) {
                textChanges.push(change);
            }
        }

        changes.push({
            fileName: sourceFile.fileName,
            textChanges,
        });
    }

    return changes;
}

function calcTextChange(
    args: ts.NodeArray<ts.Node>,
    sourceFile: ts.SourceFile,
    orders: number[],
) {
    if (!args.length) {
        return;
    }

    const start = args[0].getStart(sourceFile);
    const end = args.at(-1)!.getEnd();
    const blanks = args
        .slice(0, -1)
        .map((arg, i) => sourceFile.text.slice(arg.getEnd(), args[i + 1].getStart()));

    let newText = "";
    for (let i = 0; i < args.length; i++) {
        const order = orders[i];
        newText += (args[order]?.getText(sourceFile) ?? "void 0") + (blanks[i] ?? "");
    }

    return {
        span: {
            start,
            length: end - start,
        },
        newText,
    };
}

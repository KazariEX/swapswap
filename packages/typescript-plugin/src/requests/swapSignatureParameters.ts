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
            fileName,
            textChanges,
        });
    }

    const change = calcTextChange(decl.parameters, sourceFile, orders);
    if (change) {
        const i = changes.findIndex((c) => c.fileName === fileName);
        if (i !== -1) {
            changes[i] = {
                fileName,
                textChanges: [change, ...changes[i].textChanges],
            };
        }
        else {
            changes.push({
                fileName,
                textChanges: [change],
            });
        }
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

    const segments: string[] = [];
    for (let i = 0; i < orders.length; i++) {
        const order = orders[i];
        segments.push(args[order]?.getText(sourceFile));
        if (i < orders.length - 1) {
            segments.push(blanks[i] ?? ", ");
        }
    }

    while (segments.length && segments.at(-1) === void 0) {
        segments.splice(-2);
    }

    return {
        span: {
            start,
            length: end - start,
        },
        newText: segments.map((s) => s ?? "null").join(""),
    };
}

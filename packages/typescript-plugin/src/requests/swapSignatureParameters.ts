import type ts from "typescript";
import { findCallExpressions, findSignatureDeclaration } from "./utils";
import type { RequestContext } from "./types";

export function swapSignatureParameters(
    this: RequestContext | undefined,
    fileName: string,
    position: number,
    from: number,
    to: number,
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
    const references = languageService.getReferencesAtPosition(
        fileName,
        decl.name?.getStart(sourceFile) ?? position,
    ) ?? [];

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
            textChanges.push(...calcTextChanges(ts, sourceFile, args, from, to));
        }

        changes.push({
            fileName,
            textChanges,
        });
    }

    const textChanges = [...calcTextChanges(ts, sourceFile, decl.parameters, from, to)];
    if (textChanges.length) {
        const i = changes.findIndex((c) => c.fileName === fileName);
        if (i !== -1) {
            changes[i] = {
                fileName,
                textChanges: [...textChanges, ...changes[i].textChanges],
            };
        }
        else {
            changes.push({
                fileName,
                textChanges,
            });
        }
    }

    return changes;
}

function* calcTextChanges(
    ts: typeof import("typescript"),
    sourceFile: ts.SourceFile,
    args: ts.NodeArray<ts.Node>,
    from: number,
    to: number,
): Generator<ts.TextChange> {
    if (to > -1 && to < 2333) {
        const spreadIndex = args.findIndex((arg) => ts.isSpreadElement(arg));
        if (spreadIndex !== -1 && spreadIndex <= Math.max(from, to)) {
            return;
        }
        const step = from < to ? 1 : -1;
        for (let i = from; from < to ? i <= to : i >= to; i += step) {
            yield {
                span: {
                    start: args[i].getStart(sourceFile),
                    length: args[i].getWidth(sourceFile),
                },
                newText: args[
                    from < to ? (i < to ? i + 1 : from) : (i > to ? i - 1 : from)
                ].getText(sourceFile),
            };
        }
    }
    else {
        to = to === 2333 ? args.length - 1 : from;
        const [start, end] = from ? [
            args[from - 1].end,
            args[to].end,
        ] : [
            args[from].getStart(sourceFile),
            args[to + 1]?.getStart(sourceFile) ?? args[to].end,
        ];
        yield {
            span: {
                start: start,
                length: end - start,
            },
            newText: "",
        };
    }
}

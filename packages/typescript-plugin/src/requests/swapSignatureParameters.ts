import type ts from "typescript";
import { findSignatureDeclaration, findSignatureReferences } from "./utils";
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

    const fileTextChanges: Record<string, ts.TextChange[]> = {};
    const references = findSignatureReferences(
        ts,
        languageService,
        fileName,
        decl.name?.getStart(sourceFile) ?? position,
    );

    for (const [fileName, node] of references) {
        const sourceFile = program.getSourceFile(fileName);
        if (!sourceFile) {
            return [];
        }
        const textChanges = fileTextChanges[fileName] ??= [];

        if (ts.isCallExpression(node)) {
            textChanges.push(...calcTextChanges(ts, sourceFile, node.arguments, from, to));
        }
        else {
            let [from2, to2] = [from, to];
            const firstArg = node.parameters[0];
            if (firstArg && ts.isIdentifier(firstArg.name) && firstArg.name.text === "this") {
                from2 += 1;
                if (to2 > -1 && to2 < 2333) {
                    to2 += 1;
                }
            }
            textChanges.push(...calcTextChanges(ts, sourceFile, node.parameters, from2, to2));
        }
    }

    return Object.entries(fileTextChanges).map<ts.FileTextChanges>(([fileName, textChanges]) => ({
        fileName,
        textChanges,
    }));
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
        to = to === 2333 ? args.length - 1 : Math.min(args.length - 1, from);
        if (from >= args.length) {
            return;
        }
        const [start, end] = from ? [
            args[from - 1].end,
            args[to].end,
        ] : [
            args[from].getStart(sourceFile),
            args[to + 1]?.getStart(sourceFile) ?? args[to].end,
        ];
        yield {
            span: {
                start,
                length: end - start,
            },
            newText: "",
        };
    }
}

import type ts from "typescript";

export function findCallExpressions(
    ts: typeof import("typescript"),
    sourceFile: ts.SourceFile,
    textSpans: ts.TextSpan[],
) {
    const results: ts.CallExpression[] = [];
    let spanIndex = 0;
    let currentSpan = textSpans[spanIndex++];

    visit(sourceFile);
    return results;

    function visit(node: ts.Node) {
        if (ts.isCallExpression(node)) {
            let identifier = node.expression;
            if (ts.isPropertyAccessExpression(identifier)) {
                identifier = identifier.name;
            }
            if (inCurrentSpan(identifier.getStart(sourceFile))) {
                results.push(node);
            }
        }
        node.forEachChild(visit);
    }

    function inCurrentSpan(pos: number) {
        while (currentSpan && pos > currentSpan.start + currentSpan.length - 1) {
            currentSpan = textSpans[spanIndex++];
        }
        return currentSpan && pos >= currentSpan.start && pos < currentSpan.start + currentSpan.length;
    }
}

export function findSignatureDeclaration(
    ts: typeof import("typescript"),
    sourceFile: ts.SourceFile,
    position: number,
) {
    let decl: ts.SignatureDeclaration | undefined;

    visit(sourceFile);
    return decl;

    function visit(node: ts.Node) {
        if (ts.isFunctionLike(node) && position >= node.getStart(sourceFile) && position <= node.end) {
            decl = node;
        }
        ts.forEachChild(node, visit);
    }
}

export function* findSignatureReferences(
    ts: typeof import("typescript"),
    languageService: ts.LanguageService,
    fileName: string,
    position: number,
    visited = new Set<string>(),
): Generator<ts.ReferenceEntry> {
    const program = languageService.getProgram()!;
    const references = languageService.getReferencesAtPosition(fileName, position) ?? [];

    for (const reference of references) {
        const key = reference.fileName + "@" + reference.textSpan.start;
        if (visited.has(key)) {
            continue;
        }
        visited.add(key);
        yield reference;

        const sourceFile = program.getSourceFile(fileName);
        if (!sourceFile) {
            continue;
        }

        const node = visit(sourceFile);
        if (
            node === void 0
            || ts.isCallExpression(node.parent)
            || ts.isCallExpression(node.parent.parent)
        ) {
            continue;
        }

        function visit(child: ts.Node) {
            if (
                ts.isIdentifier(child)
                && reference.textSpan.start >= child.getStart(sourceFile)
                && reference.textSpan.start <= child.end
            ) {
                return child;
            }
            return ts.forEachChild<ts.Identifier>(child, visit);
        }

        let start: number | undefined;

        // const foo = { swap: swap };
        //               ^^^^  ^^^^
        if (
            ts.isPropertyAssignment(node.parent)
            && node === node.parent.initializer
        ) {
            start = node.parent.name.getStart(sourceFile);
        }
        // const foo = { swap };
        //               ^^^^
        else if (ts.isShorthandPropertyAssignment(node.parent)) {
            start = node.getStart(sourceFile);
        }
        // const foo = {} as { swap: typeof swap };
        //                     ^^^^         ^^^^
        else if (
            ts.isTypeQueryNode(node.parent)
            && node === node.parent.exprName
            && ts.isPropertySignature(node.parent.parent)
        ) {
            start = node.parent.parent.name.getStart(sourceFile);
        }
        else {
            continue;
        }

        yield* findSignatureReferences(
            ts,
            languageService,
            reference.fileName,
            start,
            visited,
        );
    }
}

import type ts from "typescript";

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
): Generator<[string, ts.CallExpression | ts.SignatureDeclaration]> {
    const program = languageService.getProgram()!;
    const references = languageService.getReferencesAtPosition(fileName, position) ?? [];

    for (const { fileName, textSpan } of references) {
        const key = fileName + "@" + textSpan.start;
        if (visited.has(key)) {
            continue;
        }
        visited.add(key);

        const sourceFile = program.getSourceFile(fileName);
        if (!sourceFile) {
            continue;
        }

        const node = visit(sourceFile);
        if (!node) {
            continue;
        }
        if (ts.isCallExpression(node.parent)) {
            yield [fileName, node.parent];
            continue;
        }
        if (ts.isCallExpression(node.parent.parent)) {
            yield [fileName, node.parent.parent];
            continue;
        }
        if (ts.isFunctionLike(node.parent)) {
            yield [fileName, node.parent];
            continue;
        }
        if (
            (ts.isPropertyAssignment(node.parent) || ts.isPropertyDeclaration(node.parent))
            && ts.isFunctionLike(node.parent.initializer)
        ) {
            yield [fileName, node.parent.initializer];
            continue;
        }

        function visit(child: ts.Node) {
            if (
                ts.isIdentifier(child)
                && textSpan.start >= child.getStart(sourceFile)
                && textSpan.start <= child.end
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
            fileName,
            start,
            visited,
        );
    }
}

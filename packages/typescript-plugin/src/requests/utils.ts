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

    outer: for (const { fileName, textSpan } of references) {
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

        // swap(...)
        if (
            ts.isCallExpression(node.parent)
            && node === node.parent.expression
        ) {
            yield [fileName, node.parent];
            continue;
        }
        // foo.swap(...)
        if (
            ts.isPropertyAccessExpression(node.parent)
            && node === node.parent.name
            && ts.isCallExpression(node.parent.parent)
            && node.parent === node.parent.parent.expression
        ) {
            yield [fileName, node.parent.parent];
            continue;
        }
        // swap(...) {}
        if (
            ts.isFunctionLike(node.parent)
            && node === node.parent.name
        ) {
            yield [fileName, node.parent];
            continue;
        }
        // swap: (...) => {}
        if (
            (ts.isPropertyAssignment(node.parent) || ts.isPropertyDeclaration(node.parent))
            && node === node.parent.name
        ) {
            const signature = getUnwrappedSignature(ts, node.parent.initializer);
            if (signature) {
                yield [fileName, signature];
            }
            continue;
        }

        let start: number;
        let curr: ts.Node = node;

        inner: while (curr) {
            // const foo = swap;
            //       ^^^   ^^^^
            if (
                ts.isVariableDeclaration(curr.parent)
                && curr === curr.parent.initializer
            ) {
                start = curr.parent.name.getStart(sourceFile);
            }
            // const foo = { swap: swap };
            //               ^^^^  ^^^^
            else if (
                (ts.isPropertyAssignment(curr.parent) || ts.isPropertyDeclaration(curr.parent))
                && curr === curr.parent.initializer
            ) {
                start = curr.parent.name.getStart(sourceFile);
            }
            // const foo = { swap };
            //               ^^^^
            else if (ts.isShorthandPropertyAssignment(curr.parent)) {
                start = curr.getStart(sourceFile);
            }
            // const foo: typeof swap = {};
            //       ^^^         ^^^^
            else if (
                ts.isTypeQueryNode(curr.parent)
                && curr === curr.parent.exprName
                && ts.isVariableDeclaration(curr.parent.parent)
            ) {
                const signature = getUnwrappedSignature(ts, curr.parent.parent.initializer);
                if (signature) {
                    yield [fileName, signature];
                }
                start = curr.parent.parent.name.getStart(sourceFile);
            }
            // const foo = {} as typeof swap;
            //       ^^^                ^^^^
            else if (
                ts.isTypeQueryNode(curr.parent)
                && curr === curr.parent.exprName
                && ts.isAsExpression(curr.parent.parent)
            ) {
                const signature = getUnwrappedSignature(ts, curr.parent.parent.expression);
                if (signature) {
                    yield [fileName, signature];
                }
                curr = curr.parent.parent;
                continue inner;
            }
            // const foo = {} as { swap: typeof swap };
            //                     ^^^^         ^^^^
            else if (
                ts.isTypeQueryNode(curr.parent)
                && curr === curr.parent.exprName
                && ts.isPropertySignature(curr.parent.parent)
            ) {
                start = curr.parent.parent.name.getStart(sourceFile);
            }
            else {
                continue outer;
            }
            break;
        }

        yield* findSignatureReferences(
            ts,
            languageService,
            fileName,
            start!,
            visited,
        );
    }
}

function getUnwrappedSignature(ts: typeof import("typescript"), node?: ts.Node) {
    if (!node) {
        return;
    }
    while (ts.isParenthesizedExpression(node)) {
        node = node.expression;
        if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.CommaToken) {
            node = node.right;
        }
    }
    if (ts.isFunctionLike(node)) {
        return node;
    }
}

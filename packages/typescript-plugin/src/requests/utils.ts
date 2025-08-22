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

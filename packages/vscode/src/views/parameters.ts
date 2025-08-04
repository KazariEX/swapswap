import { ref, type TreeViewNode, useActiveTextEditor, useCommand, useTextEditorSelection, useTreeView, watch } from "reactive-vscode";
import vscode from "vscode";
import type ts from "typescript";
import { sendTsServerRequest } from "../utils";

interface ParameterNode extends TreeViewNode {
    index: number;
    isRest?: boolean;
}

export function useParametersView() {
    const activeTextEditor = useActiveTextEditor();
    const selection = useTextEditorSelection(activeTextEditor);

    const data = ref<ParameterNode[]>([]);
    const view = useTreeView("swapswap.parameters", data, {
        title: "parameters",
        dragAndDropController: {
            dragMimeTypes: ["text/uri-list"],
            dropMimeTypes: ["application/swapswap.parameter"],
            handleDrag(source, dataTransfer) {
                const transferItem = new vscode.DataTransferItem(source);
                dataTransfer.set("application/swapswap.parameter", transferItem);
            },
            handleDrop(target, dataTransfer) {
                const transferItem = dataTransfer.get("application/swapswap.parameter");
                const nodes = transferItem?.value as ParameterNode[] | undefined;
                if (!nodes?.length || !selection.value || !activeTextEditor.value) {
                    return;
                }
                swap(nodes[0], target?.index ?? data.value.length - 1);
            },
        },
    });

    useCommand("swapswap.parameters.forward", (node: ParameterNode) => {
        swap(node, node.index - 1);
    });

    useCommand("swapswap.parameters.backward", (node: ParameterNode) => {
        swap(node, node.index + 1);
    });

    useCommand("swapswap.parameters.delete", (node: ParameterNode) => {
        swap(node);
    });

    const visible = ref(false);
    view.onDidChangeVisibility((event) => {
        visible.value = event.visible;
    });

    watch([visible, selection], async () => {
        if (!visible.value || !selection.value || !activeTextEditor.value) {
            data.value = [];
            return;
        }

        const { document } = activeTextEditor.value;
        const parameters = await sendTsServerRequest(
            "getSignatureParameters",
            document.uri.fsPath,
            document.offsetAt(selection.value.end),
        );

        data.value = parameters?.map(({ name, type, isRest }, index) => ({
            index,
            isRest,
            treeItem: {
                label: (isRest ? "..." : "") + name,
                description: type,
                tooltip: `<${name}: ${type}>`,
                contextValue: isRest ? "rest" : void 0,
            },
        })) ?? [];
    });

    async function swap(node: ParameterNode, target?: number) {
        if (target !== void 0) {
            if (target >= data.value.length - 1 && data.value.at(-1)?.isRest) {
                return;
            }
            if (target < data.value.length - 1 && node.isRest) {
                return;
            }
        }

        const ordered = [...data.value];
        ordered.splice(node.index, 1);

        if (target !== void 0) {
            ordered.splice(target, 0, node);
        }

        const { document } = activeTextEditor.value!;
        const changes = await sendTsServerRequest(
            "swapSignatureParameters",
            document.uri.fsPath,
            document.offsetAt(selection.value.end),
            node.index,
            target ?? (node.isRest ? 2333 : -1),
        ) ?? [];

        await applyTextChanges(changes);

        data.value = ordered.map((node, index) => {
            node.index = index;
            return node;
        });
    }
}

async function applyTextChanges(changes: ts.FileTextChanges[]) {
    const edit = new vscode.WorkspaceEdit();
    for (const { fileName, textChanges } of changes) {
        const document = await vscode.workspace.openTextDocument(fileName);
        for (const { span, newText } of textChanges) {
            const range = new vscode.Range(
                document.positionAt(span.start),
                document.positionAt(span.start + span.length),
            );
            edit.replace(document.uri, range, newText);
        }
    }
    await vscode.workspace.applyEdit(edit, {
        isRefactoring: true,
    });
}

import { ref, type TreeViewNode, useActiveTextEditor, useCommand, useTextEditorSelection, useTreeView, watch } from "reactive-vscode";
import vscode from "vscode";
import type ts from "typescript";
import { sendTsServerRequest } from "../utils";

interface ParameterNode extends TreeViewNode {
    index: number;
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
                swap(nodes[0], target?.index ?? Infinity);
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

        data.value = parameters?.map(({ name, type }, index) => {
            return {
                index,
                treeItem: {
                    label: name,
                    description: type,
                },
            };
        }) ?? [];
    });

    async function swap(node: ParameterNode, targetIndex?: number) {
        const ordered = [...data.value];
        ordered.splice(node.index, 1);

        if (targetIndex !== void 0) {
            ordered.splice(targetIndex, 0, node);
        }

        const { document } = activeTextEditor.value!;
        const changes = await sendTsServerRequest(
            "swapSignatureParameters",
            document.uri.fsPath,
            document.offsetAt(selection.value.end),
            ordered.map((node) => node.index),
        ) ?? [];

        await applyTextChanges(changes);

        data.value = ordered.map((node, index) => {
            node.index = index;
            return node;
        });
    }
}

async function applyTextChanges(changes: ts.FileTextChanges[]) {
    for (const { fileName, textChanges } of changes) {
        const document = await vscode.workspace.openTextDocument(fileName);
        const edit = new vscode.WorkspaceEdit();
        for (const { span, newText } of textChanges) {
            const range = new vscode.Range(
                document.positionAt(span.start),
                document.positionAt(span.start + span.length),
            );
            edit.replace(document.uri, range, newText);
        }
        await vscode.workspace.applyEdit(edit);
    }
}

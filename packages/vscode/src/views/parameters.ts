import { ref, type TreeViewNode, useActiveTextEditor, useTextEditorSelection, useTreeView, watch } from "reactive-vscode";
import vscode from "vscode";
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
            async handleDrop(target, dataTransfer) {
                const transferItem = dataTransfer.get("application/swapswap.parameter");
                const nodes = transferItem?.value as ParameterNode[] | undefined;
                if (!nodes?.length || !selection.value || !activeTextEditor.value) {
                    return;
                }

                const sourceIndex = nodes[0].index;
                const targetIndex = target?.index ?? Infinity;

                const ordered = [...data.value];
                ordered.splice(sourceIndex, 1);
                ordered.splice(targetIndex, 0, ...nodes);

                const { document } = activeTextEditor.value;
                const changes = await sendTsServerRequest(
                    "swapSignatureParameters",
                    document.uri.fsPath,
                    document.offsetAt(selection.value.end),
                    ordered.map((node) => node.index),
                ) ?? [];

                for (const { fileName, textChanges } of changes) {
                    const document = await vscode.workspace.openTextDocument(fileName);
                    for (const { span, newText } of textChanges) {
                        const edit = new vscode.WorkspaceEdit();
                        const range = new vscode.Range(
                            document.positionAt(span.start),
                            document.positionAt(span.start + span.length),
                        );
                        edit.replace(document.uri, range, newText);
                        await vscode.workspace.applyEdit(edit);
                    }
                }

                data.value = ordered.map((node, index) => {
                    node.index = index;
                    return node;
                });
            },
        },
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
}

import { defineExtension } from "reactive-vscode";
import { useParametersView } from "./views/parameters";

export const { activate, deactivate } = defineExtension(() => {
    useParametersView();
});

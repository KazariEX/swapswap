import { defineConfig } from "tsdown";

export default defineConfig({
    entry: {
        index: "./src/index.ts",
        "../node_modules/swapswap-typescript-plugin/index": "../typescript-plugin/src/index.ts",
    },
    format: [
        "cjs",
    ],
    external: [
        "vscode",
    ],
});

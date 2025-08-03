import { defineConfig } from "tsdown";

export default defineConfig({
    entry: {
        index: "./src/index.ts",
        requests: "./src/requests/types.ts",
    },
});

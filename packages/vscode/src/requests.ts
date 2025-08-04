import vscode from "vscode";
import type { Requests } from "@swapswap/typescript-plugin/requests";

export const requests = createRequests();

function createRequests() {
    const cache: Record<PropertyKey, (...args: any) => any> = {};

    return new Proxy({} as {
        [K in keyof Requests]: (...args: Parameters<Requests[K]>) => Promise<ReturnType<Requests[K]> | void>;
    }, {
        get(target, p) {
            if (typeof p === "symbol") {
                return;
            }
            const request = cache[p] ??= async (...args: any[]) => {
                const res = await vscode.commands.executeCommand<{ body: unknown } | undefined>(
                    "typescript.tsserverRequest",
                    `_swapswap:${p}`,
                    args,
                    { isAsync: true, lowPriority: true },
                );
                return res?.body;
            };
            return request;
        },
    });
}

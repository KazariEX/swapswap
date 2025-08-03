import vscode from "vscode";
import type { Requests } from "@swapswap/typescript-plugin/requests";

export async function sendTsServerRequest<T extends keyof Requests>(
    command: T,
    ...args: Parameters<Requests[T]>
) {
    const res = await vscode.commands.executeCommand<{ body: ReturnType<Requests[T]> } | undefined>(
        "typescript.tsserverRequest",
        `_swapswap:${command}`,
        args,
        { isAsync: true, lowPriority: true },
    );
    return res?.body;
}

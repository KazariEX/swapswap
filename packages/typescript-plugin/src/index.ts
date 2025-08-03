import type ts from "typescript";
import { getSignatureParameters } from "./requests/getSignatureParameters";
import { sortSignatureParameters } from "./requests/sortSignatureParameters";
import type { RequestContext } from "./requests/types";

const plugin: ts.server.PluginModuleFactory = (modules) => {
    const { typescript: ts } = modules;

    const pluginModule: ts.server.PluginModule = {
        create(info) {
            const session = info.session!;

            session.addProtocolHandler("_swapswap:getSignatureParameters", ({ arguments: args }) => {
                return {
                    response: getSignatureParameters.apply(getRequestContext(args[0]), args),
                };
            });
            session.addProtocolHandler("_swapswap:sortSignatureParameters", ({ arguments: args }) => {
                return {
                    response: sortSignatureParameters.apply(getRequestContext(args[0]), args),
                };
            });

            return info.languageService;

            function getRequestContext(fileName: string): RequestContext | undefined {
                const fileAndProject = (info.session as any).getFileAndProject({
                    file: fileName,
                }) as {
                    project: ts.server.Project;
                };
                return {
                    ts,
                    languageService: fileAndProject.project.getLanguageService(),
                };
            }
        },
    };
    return pluginModule;
};

export = plugin;

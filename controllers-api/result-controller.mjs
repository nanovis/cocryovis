// @ts-check

import path from "path";
import Result from "../models/result.mjs";
import { ApiError } from "../tools/error-handler.mjs";
import { prepareDataForDownload } from "../tools/file-handler.mjs";
import appConfig from "../tools/config.mjs";
import fileSystem from "fs";

export default class ResultController {
    static async getById(req, res) {
        const result = await Result.getById(Number(req.params.idResult));

        return res.json(result);
    }

    static async getDetails(req, res) {
        const result = await Result.getByIdDeep(Number(req.params.idResult), {
            checkpoint: true,
        });

        return res.json(result);
    }

    static async downloadResult(req, res) {
        const result = await Result.getById(Number(req.params.idResult));

        if (!result.files) {
            throw new ApiError(400, "Result has no files.");
        }

        const filePaths = JSON.parse(result.files);
        const data = prepareDataForDownload(filePaths, `Result_${result.id}`);
        res.set("Content-Type", "application/zip");
        res.set("Content-Disposition", "attachment; filename=" + data.name);
        return res.send(data.zipBuffer);
    }

    static async downloadResultFile(req, res) {
        const result = await Result.getById(Number(req.params.idResult));

        if (!result.files) {
            throw new ApiError(404, "Result has no files.");
        }

        const filePaths = JSON.parse(result.files);
        const fileIndex = Number(req.params.fileIndex);

        if (fileIndex >= filePaths.length) {
            throw new ApiError(404, "Requested file does not exist.");
        }

        let data = prepareDataForDownload(
            [filePaths[fileIndex]],
            `Result_${result.id}`
        );
        res.set("Content-Type", "application/zip");
        res.set("Content-Disposition", "attachment; filename=" + data.name);
        return res.send(data.zipBuffer);
    }

    static async deleteResult(req, res) {
        await Result.del(Number(req.params.idResult));
        return res.sendStatus(204);
    }

    static async removeFromVolume(req, res) {
        await Result.removeFromVolume(
            Number(req.params.idResult),
            Number(req.params.idVolume)
        );
        return res.sendStatus(204);
    }

    static async getVisualizationData(req, res) {
        const result = await Result.getById(Number(req.params.idResult));
        if (result.files.length === 0) {
            throw new ApiError(
                400,
                "Visualisation requires the result to contain at least one file."
            );
        }

        const serverURL = `${req.protocol}://${req.get("host")}`;

        const settingsReferences = [];
        const visualizationFiles = [];
        const transferFunctions = new Set();

        /** @type {String[]} */
        const filePathsArray = JSON.parse(result.files);

        /** @type {Set<String>} */
        const filePaths = new Set(filePathsArray);
        /** @type {Set<String>} */
        const fileNames = new Set(
            filePathsArray.map((fileName) => path.basename(fileName))
        );

        for (const filePath of filePaths) {
            if (!filePath.endsWith(".json")) continue;

            const settingsReference = JSON.parse(
                (
                    await fileSystem.promises.readFile(filePath, "utf8")
                ).toString()
            );
            if (!fileNames.has(settingsReference.file)) {
                throw new ApiError(
                    500,
                    "Result is missing files and thus cannot be visualized."
                );
            }
            settingsReferences.push({
                data: settingsReference,
                filename: path.basename(filePath),
            });
            const rawFilePath = path.join(
                result.folderPath,
                settingsReference.file
            );
            visualizationFiles.push({
                url: new URL(
                    path.relative(appConfig.dataPath, rawFilePath),
                    serverURL
                ).toString(),
                filename: path.basename(settingsReference.file),
            });
            if (
                settingsReference.transferFunction &&
                !transferFunctions.has(settingsReference.transferFunction)
            ) {
                const { tfBasePath, tfPath } =
                    ResultController.#getTransferFunctionPath(
                        result.folderPath,
                        settingsReference.transferFunction
                    );
                visualizationFiles.push({
                    url: new URL(
                        path.relative(tfBasePath, tfPath),
                        serverURL
                    ).toString(),
                    filename: settingsReference.transferFunction,
                });
            }
        }

        visualizationFiles.push({
            url: new URL("/data/session.json", serverURL).toString(),
            filename: "session.json",
        });
        visualizationFiles.push({
            url: new URL("/data/tf-default.json", serverURL).toString(),
            filename: "tf-default.json",
        });

        const configData = {
            rawVolumeChannel: result.rawVolumeChannel,
            files: settingsReferences.map(
                (settingsReference) => settingsReference.filename
            ),
        };

        return res.json({
            settingsReferences: settingsReferences,
            files: visualizationFiles,
            config: configData,
        });
    }

    /**
     * @param {String} resultFolderPath
     * @param {String} transferFunction
     */
    static #getTransferFunctionPath(resultFolderPath, transferFunction) {
        if (
            fileSystem.existsSync(path.join(resultFolderPath, transferFunction))
        ) {
            return {
                basePath: transferFunction,
                path: path.join(resultFolderPath, transferFunction),
            };
        } else if (
            fileSystem.existsSync(path.join("web/data", transferFunction))
        ) {
            return {
                tfBasePath: "web",
                tfPath: path.join("web/data", transferFunction),
            };
        }

        throw new ApiError(
            500,
            `The transfer function ${transferFunction} is missing from the server.`
        );
    }
}

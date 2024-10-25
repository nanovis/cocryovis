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
            files: true,
        });

        return res.json(result);
    }

    static async getFromVolume(req, res) {
        const result = await Result.getFromVolume(Number(req.params.idVolume), {
            checkpoint: true,
        });

        return res.json(result);
    }

    static async downloadResult(req, res) {
        const result = await Result.getByIdDeep(Number(req.params.idResult), {
            files: true,
        });

        if (!result.files) {
            throw new ApiError(400, "Result has no files.");
        }

        const filePaths = [];
        for (const file of result.files) {
            filePaths.push(path.join(result.folderPath, file.rawFileName));
            filePaths.push(path.join(result.folderPath, file.settingsFileName));
        }
        const data = prepareDataForDownload(filePaths, `Result_${result.id}`);
        res.set("Content-Type", "application/zip");
        res.set("Content-Disposition", "attachment; filename=" + data.name);
        return res.send(data.zipBuffer);
    }

    // static async downloadResultFile(req, res) {
    //     const result = await Result.getById(Number(req.params.idResult));

    //     if (!result.files) {
    //         throw new ApiError(404, "Result has no files.");
    //     }

    //     const filePaths = JSON.parse(result.files);
    //     const fileIndex = Number(req.params.fileIndex);

    //     if (fileIndex >= filePaths.length) {
    //         throw new ApiError(404, "Requested file does not exist.");
    //     }

    //     let data = prepareDataForDownload(
    //         [filePaths[fileIndex]],
    //         `Result_${result.id}`
    //     );
    //     res.set("Content-Type", "application/zip");
    //     res.set("Content-Disposition", "attachment; filename=" + data.name);
    //     return res.send(data.zipBuffer);
    // }

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
        const result = await Result.getByIdDeep(Number(req.params.idResult), {
            files: true,
        });
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

        const fileReferences = result.files;
        fileReferences.sort((a, b) => a.index - b.index);

        for (const fileReference of fileReferences) {
            const settingsFilePath = path.join(
                result.folderPath,
                fileReference.settingsFileName
            );
            const settingsReferenceFile = await fileSystem.promises.readFile(
                settingsFilePath,
                "utf8"
            );
            const settingsReference = JSON.parse(
                settingsReferenceFile.toString()
            );
            settingsReferences.push({
                data: settingsReference,
                filename: fileReference.settingsFileName,
                name: fileReference.name,
            });
            const rawFilePath = path.join(
                result.folderPath,
                settingsReference.file
            );
            if (!fileSystem.existsSync(rawFilePath)) {
                throw new ApiError(
                    500,
                    "Result is missing files and thus cannot be visualized."
                );
            }
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

    static async createFromFiles(req, res) {
        if (!req.files || !req.files.files) {
            throw new ApiError(400, "No file uploaded");
        }

        let files = req.files.files;
        if (!Array.isArray(files)) {
            files = [files];
        }

        const data = JSON.parse(req.body.data);

        const result = await Result.createFromFiles(
            req.session.user.id,
            data.idCheckpoint,
            data.idVolumeData,
            Number(req.params.idVolume),
            data.volumeDescriptors,
            files
        );

        return res.json(result);
    }
}

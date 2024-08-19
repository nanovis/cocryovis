// @ts-check

import { Checkpoint } from "../models/checkpoint.mjs";
import { RawVolumeData } from "../models/raw-volume-data.mjs";
import { Result } from "../models/result.mjs";
import { prepareDataForDownload } from "../tools/file-handler.mjs";
import { NanoOetziHandler } from "../tools/nano-oetzi-handler.mjs";

export class ResultController {
    static async downloadResult(req, res) {
        try {
            const result = await Result.getById(Number(req.params.idResult));

            if (!result.files) {
                throw new Error("Result has no files.");
            }

            const filePaths = JSON.parse(result.files);
            let data = prepareDataForDownload(filePaths, `Result_${result.id}`);
            res.set("Content-Type", "application/zip");
            res.set("Content-Disposition", "attachment; filename=" + data.name);
            res.send(data.zipBuffer);
        } catch (err) {
            res.status(500).send(err);
        }
    }

    static async downloadResultFile(req, res) {
        try {
            const result = await Result.getById(Number(req.params.idResult));

            if (!result.files) {
                throw new Error("Result has no files.");
            }

            const filePaths = JSON.parse(result.files);
            const fileIndex = Number(req.params.fileIndex);

            if (fileIndex >= filePaths.length) {
                throw new Error("Requested file does not exist.");
            }

            let data = prepareDataForDownload(
                [filePaths[fileIndex]],
                `Result_${result.id}`
            );
            res.set("Content-Type", "application/zip");
            res.set("Content-Disposition", "attachment; filename=" + data.name);
            res.send(data.zipBuffer);
        } catch (err) {
            res.status(500).send(err);
        }
    }

    static async deleteResult(req, res) {
        try {
            await Result.del(Number(req.params.idResult));
            res.redirect(
                `/api/actions/projects/details/` + req.params.idProject
            );
        } catch (err) {
            res.status(500).send(err);
        }
    }

    /**
     * @param {NanoOetziHandler} nanoOetzi
     */
    static async runInference(nanoOetzi, req, res) {
        try {
            const volumeDataId = Number(req.params.idVolumeData);
            const checkpointId = Number(req.params.idCheckpoint);

            const volumeData = await RawVolumeData.getById(volumeDataId);

            if (!volumeData.settingsFile) {
                throw new Error(
                    `Inference: Selected Volume Data must contain a settings file.`
                );
            }

            const checkpoint = await Checkpoint.getById(checkpointId);

            const outputPath = await nanoOetzi.queueInference(
                volumeData.settingsFile.filePath,
                checkpoint.filePath
            );

            await Result.createFromFolder(
                Number(req.session.user.id),
                checkpointId,
                volumeDataId,
                outputPath
            );

            res.redirect(
                `/api/actions/projects/details/` + req.params.idProject
            );
            // const result = await Result.create(Number(req.session.user.id), checkpointId, volumeDataId);

            // const resultPath = await Result.reserveFolderName(result.id);

            // await rename(outputPath, resultPath);

            // const files = await readdir(resultPath);
            // for (const fileName of files) {
            //     const filePath = path.join(resultPath, fileName);
            //     if (Result.acceptedFileExtensions.includes(path.extname(fileName))) {
            //         result.addFile(filePath);
            //     }
            // }

            // await Result.update(result);
        } catch (err) {
            console.log(err);
            res.status(500).send(err);
        }
    }
}

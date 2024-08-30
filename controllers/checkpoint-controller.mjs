// @ts-check

import { Checkpoint } from "../models/checkpoint.mjs";
import { Volume } from "../models/volume.mjs";
import { prepareDataForDownload } from "../tools/file-handler.mjs";
import path from "path";
import { NanoOetziHandler } from "../tools/nano-oetzi-handler.mjs";
import { parseStringArray } from "../tools/utils.mjs";

export class CheckpointController {
    static async uploadCheckpoints(req, res) {
        try {
            if (!req.files || !req.files.files) {
                res.send({
                    status: false,
                    message: "No file uploaded",
                });
            } else {
                let files = req.files.files;
                if (!Array.isArray(req.files.files)) {
                    files = [req.files.files];
                }
                await Checkpoint.createFromFiles(
                    Number(req.session.user.id),
                    Number(req.params.idModel),
                    files
                );
                res.redirect(
                    `/api/actions/projects/details/` + req.params.idProject
                );
            }
        } catch (err) {
            res.status(500).send(err);
        }
    }

    static async downloadCheckpoint(req, res) {
        try {
            const checkpoint = await Checkpoint.getById(
                Number(req.params.idCheckpoint)
            );
            let data = prepareDataForDownload(
                [checkpoint.filePath],
                path.basename(checkpoint.filePath)
            );
            res.set("Content-Type", "application/zip");
            res.set("Content-Disposition", "attachment; filename=" + data.name);
            res.send(data.zipBuffer);
        } catch (err) {
            res.status(500).send(err);
        }
    }

    static async deleteCheckpoint(req, res) {
        try {
            await Checkpoint.del(Number(req.params.idCheckpoint));
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
    static async runTraining(nanoOetzi, req, res) {
        try {
            const modelId = Number(req.body.modelId);
            const trainingVolumesIds = parseStringArray(
                req.body.trainingVolumes
            );
            const validationVolumesIds = parseStringArray(
                req.body.validationVolumes
            );
            const testingVolumesIds = parseStringArray(req.body.testingVolumes);

            const trainingVolumes = await Volume.getMultipleByIdDeep(
                trainingVolumesIds,
                { rawData: true, pseudoVolumes: true }
            );
            const validationVolumes = await Volume.getMultipleByIdDeep(
                validationVolumesIds,
                { rawData: true, pseudoVolumes: true }
            );
            const testingVolumes = await Volume.getMultipleByIdDeep(
                testingVolumesIds,
                { rawData: true, pseudoVolumes: true }
            );

            const { outputPath, checkpointPath } =
                await nanoOetzi.queueTraining(
                    trainingVolumes,
                    validationVolumes,
                    testingVolumes
                );

            const labelIds = [];
            for (const trainingVolume of trainingVolumes) {
                for (const pseudoVolume of trainingVolume.pseudoVolumes) {
                    labelIds.push(pseudoVolume.id);
                }
            }

            await Checkpoint.createFromFolder(
                Number(req.session.user.id),
                modelId,
                labelIds,
                outputPath,
                checkpointPath
            );

            console.log("None-Oetzi training successful");

            res.redirect(
                `/api/actions/projects/details/` + req.params.idProject
            );
        } catch (err) {
            console.error("Error in creating model:", err);
            res.status(500).send(err);
        }
    }
}

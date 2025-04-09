import RawVolumeData from "../models/raw-volume-data.mjs";
import { VolumeDataFactory } from "../models/volume-data-factory.mjs";
import path from "path";
import { ApiError } from "../tools/error-handler.mjs";
import fileSystem from "fs";
import Utils from "../tools/utils.mjs";
import fsPromises from "node:fs/promises";
import MotionCorHandler from "../tools/motioncor-handler.mjs";
import GCTFFindHandler from "../tools/gctffind-handler.mjs";
import archiver from "archiver";
import fs from "fs";

/**
 * @typedef { import("express").Request } Request
 * @typedef { import("express").Response } Response
 */

export default class PreProcessingController {
    /**
     * @param {GPUTaskHandler} gpuTaskHandler
     * @param {Request} req
     * @param {Response} res
     */
    static async queueTiltSeriesReconstruction(gpuTaskHandler, req, res) {
        if (!req.files || !req.files.tiltSeries) {
            throw new ApiError(400, "No files uploaded.");
        }

        if (Array.isArray(req.files.tiltSeries)) {
            throw new ApiError(
                400,
                "Only one tilt series can be added to volume."
            );
        }

        const data = JSON.parse(req.body.data);

        await gpuTaskHandler.queueTiltSeriesReconstruction(
            req.files.tiltSeries,
            data.options,
            Number(data.volumeId),
            req.session.user.id
        );

        res.sendStatus(204);
    }

    static async runMotionCor3(type, req, res) {
        // Run motion correction
        const volumeData = await VolumeDataFactory.getClass(type).getById(
            Number(req.params.idVolumeData)
        );

        const {
            patchX = 5,
            patchY = 5,
            iterations = 1,
            tolerance = 0.1,
            pixelSize = volumeData.settings?.pixelSize || 1.19,
            dosePerFrame = 1.5,
            kV = 300,
        } = req.body;

        const volumePath = volumeData.path;
        const mrcFilePath = path.resolve(volumeData.mrcFilePath);

        const isTempInput = path
            .basename(mrcFilePath)
            .includes("temp_corrected");
        const tmpOutputPath = path.resolve(
            volumePath,
            isTempInput ? "motion_corrected.mrc" : "temp_corrected.mrc"
        );

        // Prevent MotionCor3 crash when in == out
        if (mrcFilePath === tmpOutputPath) {
            throw new ApiError(
                400,
                "Input and output MRC filenames must be different."
            );
        }

        // prettier-ignore
        const args = [
                "-InMrc", mrcFilePath,
                "-OutMrc", tmpOutputPath,
                "-Patch", patchX.toString(), patchY.toString(),
                "-Iter", iterations.toString(),
                "-Tol", tolerance.toString(),
                "-PixSize", pixelSize.toString(),
                "-FmDose", dosePerFrame.toString(),
                "-kV", kV.toString(),
                "-Gpu", "0",
            ];

        console.log("Running MotionCor3 with args:", args);

        await MotionCorHandler.runMotionCor3(
            args,
            (stdout) => console.log("GCtfFind Output:", stdout),
            (stderr) => console.error("GCtfFind Error:", stderr)
        );

        // Replace original with corrected
        await fsPromises.rename(tmpOutputPath, mrcFilePath);

        const data = await RawVolumeData.prepareDataForDownload(
            Number(req.params.idVolumeData),
            false,
            false,
            true
        );

        res.type("application/zip");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${data.name}"`
        );
        data.archive.pipe(res);
        data.archive.finalize();
    }

    static async runCTF(type, req, res) {
        const volumeData = await VolumeDataFactory.getClass(type).getById(
            Number(req.params.idVolumeData)
        );
        const {
            pixelSize,
            kv,
            sphericalAberration,
            ampContrast,
            tileSize,
            useLogSpectrum = false,
        } = req.body;

        const volumePath = volumeData.path;
        // Use the motion-corrected MRC file as input for GCtfFind
        const correctedMrcPath = path.resolve(
            volumePath,
            path.basename(volumeData.mrcFilePath)
        );

        if (!fileSystem.existsSync(correctedMrcPath)) {
            return res
                .status(404)
                .json({ error: "Corrected MRC file not found" });
        }

        // Define temporary output file paths for GCtfFind's results
        // The spectrum file is the one to be downloaded
        const outputSpectrumPath = correctedMrcPath.replace(
            ".mrc",
            "_ctf_spectrum.mrc"
        );
        const outputCtfPath = correctedMrcPath.replace(".mrc", "_ctf.txt");

        // Build arguments array for GCtfFind following provided parameters
        // prettier-ignore
        const args = [
                "-InMrc", correctedMrcPath,
                "-OutMrc", outputSpectrumPath,
                "-kV", kv,
                "-Cs", sphericalAberration,
                "-AmpContrast", ampContrast,
                "-PixSize", pixelSize,
                "-TileSize", tileSize,
                "-Gpu", "0",
            ];
        if (useLogSpectrum) {
            args.push("-LogSpect", "1");
        }

        await GCTFFindHandler.runCTF(
            args,
            (stdout) => console.log("GCtfFind Output:", stdout),
            (stderr) => console.error("GCtfFind Error:", stderr)
        );

        // Stream the spectrum file for download
        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${path.basename(outputSpectrumPath)}"`
        );
        const fileStream = fileSystem.createReadStream(outputSpectrumPath);
        fileStream.pipe(res);
        fileStream.on("error", (err) => {
            return res.status(500).json({ error: "File streaming error" });
        });
    }

    static async runImodAlignmentPipeline(type, req, res) {
        const volumeData = await VolumeDataFactory.getClass(type).getById(
            Number(req.params.idVolumeData)
        );

        const {
            peak,
            diff,
            grow,
            iterationsTSA,
            patchSizeTSA,
            patchRadius,
            pixSizeTSA,
            patchPixSize,
        } = req.body;

        const volumePath = volumeData.path;
        const mrcFilePath = path.resolve(volumeData.mrcFilePath);
        const baseName = path.basename(mrcFilePath, ".mrc");

        const fixedPath = path.resolve(volumePath, `${baseName}_fixed.mrc`);
        const fixedTrimmedPath = path.resolve(
            volumePath,
            `${baseName}_trimmed.mrc`
        );
        const tiltFile = path.resolve(volumePath, `${baseName}.tlt`);
        const fidModel = path.resolve(volumePath, `${baseName}_patchtrack.fid`);
        const xfFile = path.resolve(volumePath, `${baseName}_final.xf`);
        const alignedSt = path.resolve(volumePath, `${baseName}_aligned.st`);
        const logFile = path.resolve(volumePath, `${baseName}_align.log`);
        const residualFile = path.resolve(
            volumePath,
            `${baseName}_residual.txt`
        );
        const outputModelFile = path.resolve(
            volumePath,
            `${baseName}_output.fid`
        );

        console.log("CCDERASER------");
        // 1. Run CCDERASER

        // prettier-ignore
        await Utils.runScript(
            "ccderaser",
            [
                "-input", mrcFilePath,
                "-output", fixedPath,
                "-find",
                "-peak", peak.toString(),
                "-diff", diff.toString(),
                "-grow", grow.toString(),
                "-iterations", iterationsTSA.toString(),
            ],
            volumePath,
            console.log,
            console.error
        );

        // 2. Extract tilt angles
        console.log("EXTRACTTILTS------");
        await Utils.runScript(
            "extracttilts",
            ["-input", fixedPath, "-output", tiltFile],
            volumePath,
            console.log,
            console.error
        );

        // prettier-ignore
        const args = [
            fixedPath,
            fidModel,
            "-tiltfile", tiltFile,
            "-number", `${patchSizeTSA},${patchSizeTSA}`,
            "-size", `${patchPixSize},${patchPixSize}`,
            "-radius1", patchRadius.toString(),
        ];

        // 3. Patch tracking with tiltxcorr
        console.log("TILTXCORR------");
        await Utils.runScript(
            "tiltxcorr",
            args,
            volumePath,
            console.log,
            console.error
        );

        // 4. Solve alignment with tiltalign
        console.log("TILTALIGN------");
        // prettier-ignore
        await Utils.runScript(
            "tiltalign",
            [
                `${baseName}_align.ta`, // Input parameter 1 (name only)
                `${baseName}_align.log`, // Input parameter 2 (output log file)
                "-ModelFile", fidModel,
                "-ImageFile", fixedPath,
                "-TiltFile", tiltFile,
                "-IncludeStartEndInc", "1,61,1",
                "-RotationAngle", "60",
                "-OutputTransformFile", xfFile,
                // "-RobustFitting",
                // "-WeightWholeTracks",
                "-OutputResidualFile", residualFile,
                "-OutputModelFile", outputModelFile,
            ],
            volumePath,
            console.log,
            console.error,
            [139]
        );

        console.log("NEWSTACK------");
        await Utils.runScript(
            "newstack",
            // prettier-ignore
            [
                "-secs", "1-56",
                "-input", fixedPath,
                "-output", fixedTrimmedPath
            ],
            volumePath,
            console.log,
            console.error
        );

        // 5. Apply alignment with newstack
        // prettier-ignore
        await Utils.runScript(
            "newstack",
            [
                "-input", fixedTrimmedPath,
                "-output", alignedSt,
                "-xform", xfFile,
            ],
            volumePath,
            console.log,
            console.error
        );

        // Stream zip with relevant files
        const filesToZip = [
            // fixedTrimmedPath,
            tiltFile,
            fidModel,
            logFile,
            xfFile,
            alignedSt,
            // residualFile,
            // outputModelFile
        ];

        console.log("ZIPPING------");
        const archive = archiver("zip", { zlib: { level: 0 } });
        const zipName = `${baseName}_aligned_output.zip`;

        res.setHeader("Content-Type", "application/zip");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename=\"${zipName}\"`
        );

        archive.pipe(res);

        for (const file of filesToZip) {
            if (fs.existsSync(file)) {
                archive.file(file, { name: path.basename(file) });
            }
        }

        await archive.finalize();
    }
}

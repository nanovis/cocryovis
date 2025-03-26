import RawVolumeData from "../models/raw-volume-data.mjs";
import { VolumeDataFactory } from "../models/volume-data-factory.mjs";
import path from "path";
import { ApiError } from "../tools/error-handler.mjs";
import fileSystem from "fs";
import Utils from "../tools/utils.mjs";
import fsPromises from "node:fs/promises";
import MotionCorHandler from "../tools/motioncor-handler.mjs";
import GCTFFindHandler from "../tools/gctffind-handler.mjs";

export default class PreProcessingController {
    static async runMotionCor3(type, req, res) {
        try {
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

            await MotionCorHandler.runMotionCor3(args,
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
        } catch (err) {
            return res
                .status(err.status || 500)
                .json({ error: err.message || "Internal Server Error" });
        }
    }

    static async runCTF(type, req, res) {
        try {
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
                "-OutCtf", outputCtfPath,
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

            await GCTFFindHandler.runCTF(args,
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
        } catch (err) {
            return res
                .status(err.status || 500)
                .json({ error: err.message || "Internal Server Error" });
        }
    }
}

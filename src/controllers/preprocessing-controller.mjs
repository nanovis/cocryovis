import RawVolumeData from "../models/raw-volume-data.mjs";
import {
  VolumeDataFactory,
  VolumeDataType,
} from "../models/volume-data-factory.mjs";
import path from "path";
import { ApiError } from "../tools/error-handler.mjs";
import fileSystem, { fstat } from "fs";
import archiver from "archiver";
import Utils from "../tools/utils.mjs";
import { PendingLocalFile, unpackFiles } from "../tools/file-handler.mjs";
import fsPromises from "node:fs/promises";

export default class PreProcessingController {
  /**
   * @param {VolumeDataType} type
   * @param {AuthenticatedRequest} req
   * @param {import("express").Response} res
   */
  static async getById(type, req, res) {
    const volumeData = await VolumeDataFactory.getClass(type).getById(
      Number(req.params.idVolumeData)
    );

    res.json(volumeData);
  }

  /**
   * @param {VolumeDataType} type
   * @param {AuthenticatedRequest} req
   * @param {import("express").Response} res
   */
  static async getData(type, req, res) {
    const volumeData = await VolumeDataFactory.getClass(type).getById(
      Number(req.params.idVolumeData)
    );
    if (!volumeData.rawFilePath) {
      throw new ApiError(400, "Volume Data is missing a raw file.");
    }

    console.log(volumeData);

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${path.basename(volumeData.rawFilePath)}"`
    );
    const fileStream = fileSystem.createReadStream(volumeData.rawFilePath);
    fileStream.pipe(res);

    fileStream.on("error", (err) => {
      console.error("File streaming error:", err);
      throw new ApiError(500, "Error reading file.");
    });
  }

  /**
   * @param {VolumeDataType} type
   * @param {AuthenticatedRequest} req
   * @param {import("express").Response} res
   */
  static async runAreTomo3(type, req, res) {
    const volumeData = await VolumeDataFactory.getClass(type).getById(
      Number(req.params.idVolumeData)
    );

    console.log(volumeData);

    // Extract motion correction parameters from request body
    const {
      totalDose,
      tiltAxis,
      alignZ,
      volZ,
      binningFactor,
      gainReferencePath,
      darkReferencePath,
      defectFile,
      patchSize,
      iterations,
      tolerance,
      amplitudeContrast,
      ctfCorrection,
      defocusHandling
    } = req.body;
    
    console.log("🔧 AreTomo3 Parameters Received:", {
      totalDose,
      tiltAxis,
      alignZ,
      volZ,
      binningFactor,
      gainReferencePath,
      darkReferencePath,
      defectFile,
      patchSize,
      iterations,
      tolerance,
      amplitudeContrast,
      ctfCorrection,
      defocusHandling
    });
    if (!volumeData.rawFilePath) {
      throw new ApiError(
        400,
        "Visualisation requires the volume data to contain a .raw file."
      );
    }

    if (!volumeData.settings) {
      throw new ApiError(
        400,
        "Visualisation requires the volume data to contain a settings file."
      );
    }

    const volumePath = volumeData.path;
    console.log("📂 Volume Path:", volumePath);

    // Read directory contents
    let files;
    try {
      files = await fsPromises.readdir(volumePath);
    } catch (err) {
      throw new ApiError(500, `Error accessing volume directory: ${err.message}`);
    }

    // Find full paths of .mrc and .raw files
    const rawFile = files.find(file => file.endsWith(".raw"));
    const mrcFile = files.find(file => file.endsWith(".mrc"));

    const rawFilePath = rawFile ? path.resolve(volumePath, rawFile) : null;
    const mrcFilePath = mrcFile ? path.resolve(volumePath, mrcFile) : null;

    if (!rawFilePath && !mrcFilePath) {
      throw new ApiError(
        400,
        "No .mrc or .raw files found in the volume directory."
      );
    }

    console.log("✅ Found files:", { rawFilePath, mrcFilePath });

    // Run `cat` to display contents of the first available file
    let fileToRead = rawFilePath || mrcFilePath;
    let fileContent = "";

    if (fileToRead) {
      console.log(`📜 Reading file: ${fileToRead}`);
      try {
        await Utils.runScript(
          "pwd",
          [],
          volumePath,
          (stdout) => console.log("📌 Actual Executing Directory:", stdout.trim()),
          (stderr) => console.error("⚠️ Error checking PWD:", stderr)
        );

        // if (mrcFilePath) {
        //   console.log(`🚀 Running MotionCor3 on: ${mrcFilePath}`);

        //   try {
        //     // Ensure MotionCor3 can write to the directory
        //     try {
        //       await fsPromises.access(volumePath, fsPromises.constants.W_OK);
        //     } catch (err) {
        //       throw new Error(`❌ Write permission denied for directory: ${volumePath}`);
        //     }

        //     // Generate an absolute temporary output file path
        //     const tempFilePath = path.resolve(volumePath, "temp_corrected.mrc");

        //     // If temp file exists, remove it to avoid conflicts
        //     try {
        //       await fsPromises.unlink(tempFilePath);
        //       console.log("🗑️ Removed existing temp_corrected.mrc");
        //     } catch (err) {
        //       if (err.code !== "ENOENT") {
        //         throw err; // Ignore if file doesn't exist, throw for other errors
        //       }
        //     }

        //     const motionArgs = [
        //       "-InMrc", mrcFilePath,
        //       "-OutMrc", tempFilePath,
        //       "-Patch", patchSizeX, patchSizeY,
        //       "-FtBin", binningFactor
        //     ];

        //     if (enableDoseWeighting) {
        //       motionArgs.push("-Kv", "300", "-PixSize", "1.0", "-FmDose", "2.0");
        //     }

        //     // Run MotionCor3 with input and temp output file
        //     await Utils.runScript(
        //       "MotionCor3",
        //       // ["-InMrc", mrcFilePath, "-OutMrc", tempFilePath], // Use absolute temp file path
        //       motionArgs,
        //       volumePath,
        //       (stdout) => console.log("📜 MotionCor3 Output:", stdout),
        //       (stderr) => console.error("⚠️ MotionCor3 Error:", stderr)
        //     );

        //     // Replace the original file with the corrected file
        //     await fsPromises.rename(tempFilePath, mrcFilePath);

        //     console.log(`✅ MotionCor3 completed: Overwritten -> ${mrcFilePath}`);
        //   } catch (error) {
        //     console.error("❌ MotionCor3 Execution Failed:", error);
        //   }
        // }
      } catch (error) {
        console.error("❌ Failed to read file:", error);
        fileContent = "Error reading file.";
      }
    }
    const archive = archiver("zip", {
      zlib: { level: 9 },
    });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="volume.zip"'
    );
    archive.pipe(res);

    await Utils.packVisualizationArchive(
      archive,
      [JSON.parse(volumeData.settings)],
      [volumeData.rawFilePath]
    );

    archive.finalize();
  }


}
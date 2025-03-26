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

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${path.basename(volumeData.rawFilePath)}"`
    );
    const fileStream = fileSystem.createReadStream(volumeData.rawFilePath);
    fileStream.pipe(res);

    fileStream.on("error", (err) => {
      throw new ApiError(500, "Error reading file.");
    });
  }

  /**
   * @param {string} mrcFilePath
   * @returns {Promise<number>}
   */
  static async getMrcZDimension(mrcFilePath) {
    const header = await fsPromises.readFile(mrcFilePath, { encoding: null, length: 12 }); // read first 12 bytes
    const buffer = Buffer.from(header);

    const nx = buffer.readInt32LE(0); // X dimension
    const ny = buffer.readInt32LE(4); // Y dimension
    const nz = buffer.readInt32LE(8); // Z dimension

    return nz;
  }

  static async runMotionCor3(type, req, res) {
    try {
      // Run motion correction
      const volumeData = await VolumeDataFactory.getClass(type).getById(Number(req.params.idVolumeData));
  
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
  
      const isTempInput = path.basename(mrcFilePath).includes("temp_corrected");
      const tmpOutputPath = path.resolve(volumePath, isTempInput ? "motion_corrected.mrc" : "temp_corrected.mrc");
  
      // Prevent MotionCor3 crash when in == out
      if (mrcFilePath === tmpOutputPath) {
        throw new ApiError(400, "Input and output MRC filenames must be different.");
      }
  
      const args = [
        "-InMrc", mrcFilePath,
        "-OutMrc", tmpOutputPath,
        "-Patch", patchX.toString(), patchY.toString(),
        "-Iter", iterations.toString(),
        "-Tol", tolerance.toString(),
        "-PixSize", pixelSize.toString(),
        "-FmDose", dosePerFrame.toString(),
        "-kV", kV.toString(),
        "-Gpu", "0"
      ];
  
      await Utils.runScript("MotionCor3", args, volumePath,
        (stdout) => console.log("MotionCor3 Output:", stdout),
        (stderr) => console.error("MotionCor3 Error:", stderr)
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
      res.setHeader("Content-Disposition", `attachment; filename="${data.name}"`);
      data.archive.pipe(res);
      data.archive.finalize();
  
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
    }
  }
  

  static async runCTF(type, req, res) {
    try {
      const volumeData = await VolumeDataFactory.getClass(type).getById(Number(req.params.idVolumeData));
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
      const correctedMrcPath = path.resolve(volumePath, path.basename(volumeData.mrcFilePath));
  
      if (!fileSystem.existsSync(correctedMrcPath)) {
        return res.status(404).json({ error: "Corrected MRC file not found" });
      }
  
      // Define temporary output file paths for GCtfFind's results
      // The spectrum file is the one to be downloaded
      const outputSpectrumPath = correctedMrcPath.replace(".mrc", "_ctf_spectrum.mrc");
      const outputCtfPath = correctedMrcPath.replace(".mrc", "_ctf.txt");
  
      // Build arguments array for GCtfFind following provided parameters
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
  
      // Run GCtfFind with the specified arguments
      await Utils.runScript("GCtfFind", args, volumePath,
        (stdout) => console.log("GCtfFind Output:", stdout),
        (stderr) => console.error("GCtfFind Error:", stderr)
      );
  
      // Stream the spectrum file for download
      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${path.basename(outputSpectrumPath)}"`);
      const fileStream = fileSystem.createReadStream(outputSpectrumPath);
      fileStream.pipe(res);
      fileStream.on("error", (err) => {
        return res.status(500).json({ error: "File streaming error" });
      });
      
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
    }
  }

}
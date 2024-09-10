// @ts-check

import { exec } from "child_process";
import appConfig from "./config.mjs";
import path from "path";
import { promisify } from "util";
const execPromise = promisify(exec);

/**
 * @typedef { import("@prisma/client").RawVolumeData } RawVolumeDataDB
 * @typedef { import("@prisma/client").SparseLabelVolumeData } SparseLabelVolumeDataDB
 */

/**
 * @param {RawVolumeDataDB} rawVolumeData
 * @param {String} outputPath
 */
export async function rawToH5(rawVolumeData, outputPath) {
    const settings = JSON.parse(rawVolumeData.settings);
    const dimensionString = `${settings.size.x}x${settings.size.y}x${settings.size.z}`;
    const command = `${appConfig.nanoOetzi.python} \"${path.join(
        "tools-python",
        "raw-to-h5.py"
    )}\" -r \"${
        rawVolumeData.rawFilePath
    }\" -d \"${dimensionString}\" -o \"${outputPath}\"`;

    await execPromise(command);
    return outputPath;
}

/**
 * @param {SparseLabelVolumeDataDB[]} labels
 * @param {String} outputPath
 */
export async function labelsToH5(labels, outputPath) {
    let filePaths = "";
    for (const label of labels) {
        filePaths += ` \"${label.rawFilePath}\"`;
    }
    const settings = JSON.parse(labels[0].settings);
    const dimensionString = `${settings.size.x}x${settings.size.y}x${settings.size.z}`;
    const command = `${appConfig.nanoOetzi.python} \"${path.join(
        "tools-python",
        "labels-to-h5.py"
    )}\" -l${filePaths} -d \"${dimensionString}\" -o \"${outputPath}\"`;

    await execPromise(command);
    return outputPath;
}

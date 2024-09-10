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
 * @param {String} rawVolumePath
 * @param {{x: Number, y: Number, z: Number}} dimensions
 * @param {String} outputPath
 */
export async function rawToH5(rawVolumePath, dimensions, outputPath) {
    let params = [
        `-r \"${rawVolumePath}\"`,
        `-d \"${dimensions.x}x${dimensions.y}x${dimensions.z}\"`,
        `-o \"${outputPath}\"`,
    ];
    const command = `${appConfig.ilastik.python} \"${path.join(
        "tools-python",
        "raw-to-h5.py"
    )}\" ${params.join(" ")}`;

    await execPromise(command);
    return outputPath;
}

/**
 * @param {String[]} labelPaths
 * @param {{x: Number, y: Number, z: Number}} dimensions
 * @param {String} outputPath
 */
export async function labelsToH5(labelPaths, dimensions, outputPath) {
    let params = [
        `-l \"${labelPaths.join('" "')}\"`,
        `-d \"${dimensions.x}x${dimensions.y}x${dimensions.z}\"`,
        `-o \"${outputPath}\"`,
    ];
    const command = `${appConfig.ilastik.python} \"${path.join(
        "tools-python",
        "labels-to-h5.py"
    )}\" ${params.join(" ")}`;

    await execPromise(command);
    return outputPath;
}

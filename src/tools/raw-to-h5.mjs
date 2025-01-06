// @ts-check

import { exec } from "child_process";
import appConfig from "./config.mjs";
import path from "path";
import { promisify } from "util";
import LogFile from "./log-manager.mjs";
const execPromise = promisify(exec);

/**
 * @typedef { import("@prisma/client").RawVolumeData } RawVolumeDataDB
 * @typedef { import("@prisma/client").SparseLabelVolumeData } SparseLabelVolumeDataDB
 */

/**
 * @param {String} rawVolumePath
 * @param {{x: Number, y: Number, z: Number}} dimensions
 * @param {String} outputPath
 * @param {String} datasetName
 * @param {LogFile} logFile
 */
export async function rawToH5(
    rawVolumePath,
    dimensions,
    outputPath,
    datasetName,
    logFile=null
) {
    let params = [
        `-r \"${rawVolumePath}\"`,
        `-d \"${dimensions.x}x${dimensions.y}x${dimensions.z}\"`,
        `-s \"${datasetName}\"`,
        `-o \"${outputPath}\"`,
        "-log False",
    ];
    const command = `${appConfig.ilastik.python} \"${path.join(
        "./python-scripts",
        "raw-to-h5.py"
    )}\" ${params.join(" ")}`;

    const { stdout, stderr } = await execPromise(command);
    if (logFile) {
        await logFile.writeLog(stdout);
        await logFile.writeLog(stderr);
    }

    return outputPath;
}

/**
 * @param {String[]} labelPaths
 * @param {{x: Number, y: Number, z: Number}} dimensions
 * @param {String} outputPath
 * @param {String} datasetName
 * @param {LogFile} logFile
 */
export async function labelsToH5(
    labelPaths,
    dimensions,
    outputPath,
    datasetName,
    logFile=null
) {
    let params = [
        `-l \"${labelPaths.join('" "')}\"`,
        `-d \"${dimensions.x}x${dimensions.y}x${dimensions.z}\"`,
        `-s \"${datasetName}\"`,
        `-o \"${outputPath}\"`,
        "-log False",
    ];
    const command = `${appConfig.ilastik.python} \"${path.join(
        "./python-scripts",
        "labels-to-h5.py"
    )}\" ${params.join(" ")}`;

    const { stdout, stderr } = await execPromise(command);
    if (logFile) {
        await logFile.writeLog(stdout);
        await logFile.writeLog(stderr);
    }

    return outputPath;
}

/**
 * @param {String} labelPath
 * @param {String} datasetName
 * @param {String} outputPath
 * @param {LogFile} logFile
 */
export async function H5ToLabels(labelPath, datasetName, outputPath, logFile=null) {
    let params = [
        `-l \"${labelPath}\"`,
        `-s \"${datasetName}\"`,
        `-o \"${outputPath}\"`,
    ];
    const command = `${appConfig.ilastik.python} \"${path.join(
        "./python-scripts",
        "h5-to-labels.py"
    )}\" ${params.join(" ")}`;

    const { stdout, stderr } = await execPromise(command);
    if (logFile) {
        await logFile.writeLog(stdout);
        await logFile.writeLog(stderr);
    }

    return outputPath;
}

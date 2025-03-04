// @ts-check

import { exec } from "child_process";
import appConfig from "./config.mjs";
import path from "path";
import { promisify } from "util";
import LogFile from "./log-manager.mjs";
import Utils from "./utils.mjs";
const execPromise = promisify(exec);

/**
 * @typedef { import("@prisma/client").RawVolumeData } RawVolumeDataDB
 * @typedef { import("@prisma/client").SparseLabelVolumeData } SparseLabelVolumeDataDB
 */

/**
 * @param {String} rawVolumePath
 * @param {{x: Number, y: Number, z: Number}} dimensions
 * @param {Number} usedBits
 * @param {Boolean} isSigned
 * @param {Boolean} littleEndian
 * @param {String} outputPath
 * @param {String} datasetName
 * @param {LogFile} logFile
 */
export async function rawToH5(
    rawVolumePath,
    dimensions,
    usedBits,
    isSigned,
    littleEndian,
    outputPath,
    datasetName,
    logFile = null
) {
    // prettier-ignore
    const params = [
        path.join("./python-scripts", "raw-to-h5.py"),
        "-r", rawVolumePath,
        "-d", `${dimensions.x}x${dimensions.y}x${dimensions.z}`,
        "-b", usedBits.toString(),
        "-sg", isSigned.toString(),
        "-le", littleEndian.toString(),
        "-s", datasetName,
        "-o", outputPath
    ]

    await Utils.runScript(
        appConfig.ilastik.python,
        params,
        null,
        (value) => logFile.writeLog(value),
        (value) => logFile.writeLog(value)
    );

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
    logFile = null
) {
    // prettier-ignore
    const params = [
        path.join("./python-scripts", "labels-to-h5.py"),
        "-l", ...labelPaths,
        "-d", `${dimensions.x}x${dimensions.y}x${dimensions.z}`,
        "-s", datasetName,
        "-o", outputPath,
        "-log", "True"
    ];

    await Utils.runScript(
        appConfig.ilastik.python,
        params,
        null,
        (value) => logFile.writeLog(value),
        (value) => logFile.writeLog(value)
    );

    return outputPath;
}

/**
 * @param {String} labelPath
 * @param {String} datasetName
 * @param {String} outputPath
 * @param {LogFile} logFile
 */
export async function H5ToLabels(
    labelPath,
    datasetName,
    outputPath,
    logFile = null
) {
    // prettier-ignore
    const params = [
        path.join("./python-scripts", "h5-to-labels.py"),
        "-l", labelPath,
        "-s", datasetName,
        "-o", outputPath
    ];

    await Utils.runScript(
        appConfig.ilastik.python,
        params,
        null,
        (value) => logFile.writeLog(value),
        (value) => logFile.writeLog(value)
    );

    return outputPath;
}

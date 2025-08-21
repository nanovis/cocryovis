// @ts-check

import fsPromises from "fs/promises";
import path from "path";
import { ApiError } from "./error-handler.mjs";
import Utils from "./utils.mjs";

/**
 * @typedef {object} xyz
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @typedef {object} AnnotationsEntry
 * @property {boolean} add
 * @property {xyz} dimensions
 * @property {xyz} kernelSize
 * @property {xyz[]} positions
 * @property {string} volumeName
 */

const annotationsEntrySchema = {
    add: "boolean",
    dimensions: {
        x: "number",
        y: "number",
        z: "number",
    },
    kernelSize: {
        x: "number",
        y: "number",
        z: "number",
    },
    positions: [
        {
            x: "number",
            y: "number",
            z: "number",
        },
    ],
    volumeName: "string",
};

/**
 * @param {AnnotationsEntry[]} entries
 * @param {string} outputFile
 * @param {Buffer | undefined} currentData
 */
export async function annotationsToVolume(
    entries,
    outputFile,
    currentData = undefined
) {
    let dimensions = null;

    if (entries.length === 0) {
        throw new ApiError(400, "No annotations found.");
    }

    for (const entry of entries) {
        if (!Utils.matchesTemplate(entry, annotationsEntrySchema)) {
            throw new ApiError(
                400,
                "One of the annotation entries is missing required fields."
            );
        }

        const entryDimensions = entry.dimensions;
        if (!dimensions) {
            dimensions = entryDimensions;
        } else {
            if (
                dimensions.x !== entryDimensions.x ||
                dimensions.y !== entryDimensions.y ||
                dimensions.z !== entryDimensions.z
            ) {
                throw new ApiError(
                    400,
                    "Annotations entries have missmatches dimensions."
                );
            }
        }
    }

    if (
        currentData !== undefined &&
        currentData.length !== dimensions.x * dimensions.y * dimensions.z
    ) {
        throw new ApiError(
            400,
            "Current data does not match the dimensions of the annotations."
        );
    }

    const buffer =
        currentData ?? Buffer.alloc(dimensions.x * dimensions.y * dimensions.z);

    for (const entry of entries) {
        await processAnnotationsEntry(entry, buffer);
    }

    await fsPromises.writeFile(outputFile, buffer);
    const settings = {
        file: path.basename(outputFile),
        size: {
            x: dimensions.x,
            y: dimensions.y,
            z: dimensions.z,
        },
        ratio: {
            x: 1,
            y: 1,
            z: 1,
        },
        bytesPerVoxel: 1,
        usedBits: 8,
        skipBytes: 0,
        isLittleEndian: true,
        isSigned: false,
        addValue: 0,
        transferFunction: "tf-default.json",
    };

    return settings;
}

/**
 * @param {AnnotationsEntry} entry
 * @param {Buffer} outputBuffer
 * @returns {Promise<void>}
 */
async function processAnnotationsEntry(entry, outputBuffer) {
    if (entry.positions.length === 0) {
        return;
    }

    const kernelSize = entry.kernelSize;
    const dimensions = entry.dimensions;

    const zSlice = dimensions.x * dimensions.y;

    if (entry.add) {
        for (const position of entry.positions) {
            const vertex = {
                x: Math.floor(position.x * dimensions.x),
                y: Math.floor(position.y * dimensions.y),
                z: Math.floor(position.z * dimensions.z),
            };

            for (let x = 0; x < kernelSize.x * 2 + 1; x++) {
                for (let y = 0; y < kernelSize.y * 2 + 1; y++) {
                    for (let z = 0; z < kernelSize.z * 2 + 1; z++) {
                        const delta = [
                            kernelSize.x - x,
                            kernelSize.y - y,
                            kernelSize.z - z,
                        ];
                        const strength = Math.pow(
                            (delta[0] * delta[0]) / kernelSize.x +
                                (delta[1] * delta[1]) / kernelSize.y +
                                (delta[2] * delta[2]) / kernelSize.z,
                            0.5
                        );
                        if (strength > 1) {
                            continue;
                        }
                        const density =
                            0.5 - Math.cos((1.0 - strength) * 3.141592) * 0.5;

                        const densityUint8 = Math.floor(density * 255);

                        const bufferIndex =
                            vertex.x +
                            delta[0] +
                            (vertex.y + delta[1]) * dimensions.x +
                            (vertex.z + delta[2]) * zSlice;

                        const currentDensity = outputBuffer[bufferIndex];

                        outputBuffer[bufferIndex] = Math.min(
                            Math.max(currentDensity + densityUint8, 0),
                            255
                        );
                    }
                }
            }
        }
    } else {
        for (const position of entry.positions) {
            const vertex = {
                x: Math.floor(position.x * dimensions.x),
                y: Math.floor(position.y * dimensions.y),
                z: Math.floor(position.z * dimensions.z),
            };

            for (let x = 0; x < kernelSize.x; x++) {
                for (let y = 0; y < kernelSize.y; y++) {
                    for (let z = 0; z < kernelSize.z; z++) {
                        const delta = [
                            kernelSize.x - x,
                            kernelSize.y - y,
                            kernelSize.z - z,
                        ];

                        const bufferIndex =
                            vertex.x +
                            delta[0] +
                            (vertex.y + delta[1]) * dimensions.x +
                            (vertex.z + delta[2]) * zSlice;

                        outputBuffer[bufferIndex] = 0;
                    }
                }
            }
        }
    }
}

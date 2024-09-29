// @ts-check

import fsPromises from "fs/promises";
import path from "path";
import { ApiError } from "./error-handler.mjs";

/**
 * @typedef {Object} xyz
 * @property {Number} x
 * @property {Number} y
 * @property {Number} z
 * @param {xyz} dimensions
 * @param {xyz} kernelSize
 * @param {xyz[]} positions
 * @param {String} outputFile
 */
export async function annotationsToVolume(
    dimensions,
    kernelSize,
    positions,
    outputFile
) {
    if (positions.length === 0) {
        throw new ApiError(
            400,
            "Annotations Import: Annotations have no specified positions."
        );
    }

    const buffer = Buffer.alloc(dimensions.x * dimensions.y * dimensions.z);
    const zSlice = dimensions.x * dimensions.y;

    for (const position of positions) {
        for (let x = 0; x < kernelSize.x; x++) {
            for (let y = 0; y < kernelSize.y; y++) {
                for (let z = 0; z < kernelSize.z; z++) {
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

                    const vertex = {
                        x: Math.floor(position.x * dimensions.x),
                        y: Math.floor(position.y * dimensions.y),
                        z: Math.floor(position.z * dimensions.z),
                    };

                    const bufferIndex =
                        vertex.x +
                        delta[0] +
                        (vertex.y + delta[1]) * dimensions.x +
                        (vertex.z + delta[2]) * zSlice;

                    const currentDensity = buffer[bufferIndex];

                    buffer[bufferIndex] = Math.min(
                        Math.max(currentDensity + densityUint8, 0),
                        255
                    );
                }
            }
        }
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

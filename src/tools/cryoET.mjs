// @ts-check

import Utils from "./utils.mjs";

/**
 * Fetch cryoET tomogram metadata by id
 * @param {number} id
 * @returns {Promise<Object>}
 */
export async function fetchCtyoETTomogramMetadata(id) {
    try {
        let output = "";
        await Utils.runPythonScript(
            "fetch-cryoET-tomogram_by_id.py",
            [id.toString()],
            (value) => (output += value)
        );
        return JSON.parse(output);
    } catch (error) {
        console.error(error);
        throw new Error("Failed to fetch cryoET tomogram metadata");
    }
}

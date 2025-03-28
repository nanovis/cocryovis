// @ts-check

import fs from "fs";
import archiver from "archiver";
import { ApiError } from "../tools/error-handler.mjs";

/**
 * @typedef { import("express").Request } Request
 * @typedef { import("express").Response } Response
 */

export default class DemoController {
    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async getDemo(req, res) {
        let demoDefinesData;
        try {
            demoDefinesData = await fs.promises.readFile(
                `${process.cwd()}/demo/defines.json`,
                "utf-8"
            );
        } catch {
            throw new ApiError(500, "Server error: demo defines not found");
        }

        const demoId = req.params.idDemo;
        if (!demoId) {
            throw new ApiError(400, "Demo ID is required");
        }

        /**
         * @type {Map<String, {type: String, label: String}>}
         */
        const demoDefines = JSON.parse(demoDefinesData);
        const demoDefine = demoDefines[demoId];
        if (!demoDefine) {
            throw new ApiError(404, "Demo not found");
        }

        const demoPath = `${process.cwd()}/demo/${demoId}`;
        const demoFiles = await fs.promises.readdir(demoPath);

        const archive = archiver("zip", {
            zlib: { level: 9 },
        });

        for (const file of demoFiles) {
            const filePath = `${demoPath}/${file}`;
            const stat = await fs.promises.stat(filePath);
            if (stat.isFile()) {
                archive.file(filePath, { name: file });
            }
        }

        res.setHeader("Content-Type", "application/zip");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="demo_${demoId}.zip"`
        );
        res.setHeader("X-Demo-Type", demoDefine.type);

        archive.pipe(res);
        archive.on("error", (err) => {
            throw new ApiError(500, "Error creating archive");
        });
        archive.finalize();
    }
}

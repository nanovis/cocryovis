// @ts-check

import appConfig from "../tools/config.mjs";
import path from "path";
import Utils from "./utils.mjs";
import fileSystem from "fs";

export default class LogFile {
    /** @type {String} */ #filePath;

    /**
     * @param {String} basename
     * @return {Promise<LogFile>}
     */
    static async createLogFile(basename) {
        await fileSystem.promises.mkdir(appConfig.logPath, { recursive: true });

        let logPath = Utils.getInverseDateString() + "_" + basename;
        logPath = path.join(appConfig.logPath, logPath);
        while (fileSystem.existsSync(logPath + ".log")) {
            logPath += "_";
        }
        logPath += ".log";
        await fileSystem.promises.writeFile(logPath, "");
        return new LogFile(logPath);
    }

    /**
     * @param {String} filePath
     */
    constructor(filePath) {
        this.#filePath = filePath;

        Object.preventExtensions(this);
    }

    get fileName() {
        return path.basename(this.#filePath);
    }

    exists() {
        return fileSystem.existsSync(this.#filePath);
    }

    /**
     * @param {String} data
     */
    async writeLog(data) {
        return await fileSystem.promises.appendFile(this.#filePath, data);
    }

    /**
     * @param {String} directory
     */
    async moveTo(directory) {
        const newFilePath = path.join(directory, path.basename(this.#filePath));
        await fileSystem.promises.rename(this.#filePath, newFilePath);
        this.#filePath = newFilePath;
    }
}

// export default class LogFileManager {
//     /**
//      * @param {String} basename
//      * @return {Promise<LogFile>}
//      */
//     static async createLogFile(basename) {
//         let logPath = Utils.getInverseDateString() + "_" + basename;
//         logPath = path.join(appConfig.logPath, basename);
//         while (fileSystem.existsSync(logPath + ".log")) {
//             logPath += "_";
//         }
//         logPath += ".log";
//         await fileSystem.promises.writeFile(logPath, "");
//         return new LogFile(logPath);
//     }
// }

import appConfig from "./config.mjs";
import path from "path";
import Utils from "./utils.mjs";

export default class GCTFFindHandler {
    static async runCTF(args, onStdout, onStderr) {
        await Utils.runScript(
            "./" + appConfig.GCtfFind.executable,
            args,
            path.resolve(appConfig.GCtfFind.path),
            onStdout,
            onStderr
        );
    }
}

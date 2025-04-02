import appConfig from "./config.mjs";
import path from "path";
import Utils from "./utils.mjs";

export default class MotionCorHandler {
    static async runMotionCor3(args, onStdout, onStderr) {
        await Utils.runScript(
            "./" + appConfig.MotionCor3.executable,
            args,
            path.resolve(appConfig.MotionCor3.path),
            onStdout,
            onStderr
        );
    }
}

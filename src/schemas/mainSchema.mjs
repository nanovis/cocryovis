// @ts-check
import fs from "fs";
import YAML from "yaml";
import { createDocument } from "zod-openapi";
import { userPath } from "./userMainSchema.mjs";
import { createErrorMap } from "zod-validation-error";
import zod from "zod";
import { projectPath } from "./projectMainSchema.mjs";
import { volumePath } from "./volumeMainSchema.mjs";
import { volumeDataPath } from "./volumeDataMainSchema.mjs";
import { modelsPath } from "./modelsMainSchema.mjs";
import { checkPointPath } from "./checkpointMainSchema.mjs";
import { resultPath } from "./resultMainSchema.mjs";
import { demoPath } from "./demoSchema.mjs";

// Makes errors readable
zod.config({
    customError: createErrorMap(),
});

const document = createDocument(
    {
        openapi: "3.1.0",
        info: {
            title: "My API",
            version: "1.0.0",
        },
        servers: [
            {
                url: "http://localhost:8080/api",
            },
        ],
        paths: {
            ...userPath,
            ...projectPath,
            ...volumePath,
            ...volumeDataPath,
            ...modelsPath,
            ...checkPointPath,
            ...resultPath,
            ...demoPath,
        },
    },
    { reused: "ref" }
);
export function writeOpenApi() {
    const yaml = YAML.stringify(document);
    fs.writeFileSync("openapi.yaml", yaml);
}

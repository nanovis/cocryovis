// @ts-check
import fs from "fs";
import YAML from "yaml";
import { createDocument } from "zod-openapi";
import { userPath } from "./user-path-schema.mjs";
import { createErrorMap } from "zod-validation-error";
import zod from "zod";
import { projectPath } from "./project-path-schema.mjs";
import { volumePath } from "./volume-path-schema.mjs";
import { volumeDataPath } from "./volume-data-path-schema.mjs";
import { modelsPath } from "./models-path-schema.mjs";
import { checkPointPath } from "./checkpoint-path-schema.mjs";
import { resultPath } from "./result-path-schema.mjs";
import { demoPath } from "./demo-path-schema.mjs";
import { IlastikPath } from "./Ilastik-path-schema.mjs";
import { nanoOetziPath } from "./nano-oetzi-path-schema.mjs";
import { cryoEtPath } from "./cryoEt-path-schema.mjs";

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
            ...IlastikPath,
            ...nanoOetziPath,
            ...cryoEtPath,
        },
    },
    { reused: "ref" }
);
export function writeOpenApi() {
    const yaml = YAML.stringify(document);
    fs.writeFileSync("openapi.yaml", yaml);
}

// @ts-check
import fs from "fs";
import YAML from "yaml";
import { createDocument } from "zod-openapi";
import { userPath } from "./userSchema.mjs";
import { createErrorMap } from "zod-validation-error";
import zod from "zod";

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
        paths: userPath,
    },
    { reused: "inline" }
);
export function writeOpenApi() {
    const yaml = YAML.stringify(document);
    fs.writeFileSync("openapi.yaml", yaml);
}

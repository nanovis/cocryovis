// @ts-check
import z from "zod";
import { fromError } from "zod-validation-error";
import { ApiError } from "../tools/error-handler.mjs";

function replaceStrinInError(input) {
    return input.replace(/\bString\b/g, "Form");
}

export function formatUserError(validation) {
    if (!validation.success) {
        const validationError = fromError(validation.error, {
            maxIssuesInMessage: 1,
            prefix: undefined,
        });

        throw new ApiError(
            400,
            replaceStrinInError(validationError.toString())
        );
    }
}

export const errorSchema = z.object({
    name: z.string(),
    message: z.string(),
});
export const errorResponse = {
    content: {
        "application/json": {
            schema: errorSchema,
        },
    },
};

export const defaultError = {
    500: errorResponse,
    404: errorResponse,
};

/**
 * @param {number[]} errorArray
 */
export function generateErrors(errorArray) {
    const responseObj = {};

    for (let i = 0; i < errorArray.length; i++) {
        responseObj[errorArray[i]] = {
            content: {
                "application/json": {
                    schema: errorSchema,
                },
            },
        };
    }

    return responseObj;
}

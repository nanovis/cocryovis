// @ts-check
import z from "zod";

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

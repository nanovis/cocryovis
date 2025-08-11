// @ts-check

import z from "zod";
import { fromError } from "zod-validation-error";
import { ApiError } from "../tools/error-handler.mjs";

/**
 * @param {string} input
 * @returns {string}
 */
function replaceStrinInError(input) {
    return input.replace(/\bString\b/g, "Form");
}

/**
 * @param {z.ZodSafeParseResult<any>} validation
 */
export function checkAndThrowValidationError(validation) {
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

/**
 * @param {Object} [schemas] - Optional schemas for request validation.
 * @param {z.ZodTypeAny} [schemas.bodySchema] - Schema to validate `req.body`.
 * @param {z.ZodTypeAny} [schemas.paramsSchema] - Schema to validate `req.params`.
 * @param {z.ZodTypeAny} [schemas.querySchema] - Schema to validate `req.query`.
 * @returns {import("express").RequestHandler} Express middleware function.

 */
export default function validateSchema({
    bodySchema,
    paramsSchema,
    querySchema,
} = {}) {
    return (req, res, next) => {
        if (bodySchema !== undefined) {
            const bodyValidation = bodySchema.safeParse(req.body);
            checkAndThrowValidationError(bodyValidation);
            req.body = bodyValidation.data;
        }

        if (paramsSchema !== undefined) {
            const paramsValidation = paramsSchema.safeParse(req.params);
            checkAndThrowValidationError(paramsValidation);
            req.params = paramsValidation.data;
        }

        if (querySchema !== undefined) {
            const queryValidation = querySchema.safeParse(req.query);
            checkAndThrowValidationError(queryValidation);
            req.query = queryValidation.data;
        }

        next();
    };
}

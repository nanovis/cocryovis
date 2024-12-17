// @ts-check

import { Prisma } from "@prisma/client";

export class ApiError extends Error {
    /** @type {Number} */
    statusCode = 500;

    /**
     * @param {String} message
     * @param {Number} statusCode
     */
    constructor(statusCode, message) {
        super(message);
        this.name = "ApiError";
        this.statusCode = statusCode;
    }

    /**
     * @param {Number} instanceId
     * @param {String} modelName
     * @returns {MissingResourceError}
     */
    static fromId(instanceId, modelName) {
        return new MissingResourceError(
            `The ${modelName} with the ID ${instanceId} does not exist.`
        );
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
        };
    }
}

export class MissingResourceError extends ApiError {
    /**
     * @param {String} message
     */
    constructor(message) {
        super(404, message);
        this.name = "MissingResourceError";
    }

    /**
     * @param {Number} instanceId
     * @param {String} modelName
     * @returns {MissingResourceError}
     */
    static fromId(instanceId, modelName) {
        return new MissingResourceError(
            `The ${modelName} with the ID ${instanceId} does not exist.`
        );
    }
}

export function logErrors(err, req, res, next) {
    console.error(err.message);
    next(err);
}

export function clientErrorHandler(error, req, res, next) {
    if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
    ) {
        res.status(404).json({ name: error.name, message: error.message });
    } else if (error instanceof ApiError) {
        res.status(error.statusCode).json({
            name: error.name,
            message: error.message,
            status: error.statusCode,
        });
    } else {
        res.status(500).json({ name: error.name, message: error.message });
    }
}

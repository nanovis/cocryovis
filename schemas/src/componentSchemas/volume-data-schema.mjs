// @ts-check

import z from "zod";
import { idSchema } from "./id-param-schema.mjs";

export const typeSchema = z.enum([
    "RawVolumeData",
    "SparseLabeledVolumeData",
    "PseudoLabeledVolumeData",
]);

export const idVolumeData = z
    .object({
        idVolumeData: idSchema,
    })
    .meta({
        param: {
            name: "idVolumeData",
            in: "path",
            required: true,
        },
        example: { idVolumeData: "1" },
    });

export const type = z
    .object({
        type: typeSchema,
    })
    .meta({
        param: {
            name: "type",
            in: "path",
            required: true,
        },
    });

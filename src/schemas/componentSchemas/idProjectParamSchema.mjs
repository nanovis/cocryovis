// @ts-check

import z from "zod";

export const idProject = z
    .object({
        idProject: z.string().regex(/^\d+$/),
    })
    .meta({
        param: {
            name: "idProject",
            in: "path",
            required: true,
        },
        example: { idProject: "123" },
    });

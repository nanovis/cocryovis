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

export function generateErrors(errorArray: number[]) {
  const responseObj: Record<number, typeof errorResponse> = {};

  for (const error of errorArray) {
    responseObj[error] = {
      content: {
        "application/json": {
          schema: errorSchema,
        },
      },
    };
  }

  return responseObj;
}

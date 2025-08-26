import z from "zod";
import * as Utils from "../utils/Helpers";
import { inferenceIds, trainingReq } from "#schemas/nano-oetzi-path-schema.mjs";

export async function queueInference(request: z.input<typeof inferenceIds>) {
  await Utils.sendApiRequest(
    `queue-inference`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    },
  );
}

export async function queueTraining(request: z.input<typeof trainingReq>) {
  await Utils.sendApiRequest(
    `queue-training`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    },
  );
}

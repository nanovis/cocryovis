import z from "zod";
import * as Utils from "../utils/Helpers";
import { inferenceIds, trainingReq } from "#schemas/nano-oetzi-path-schema.mjs";

export async function queueInference(request: z.infer<typeof inferenceIds>) {
  await Utils.sendRequestWithToast(
    `queue-inference`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    },
    { successText: "Inference successfuly queued!" }
  );
}

export async function queueTraining(request: z.infer<typeof trainingReq>) {
  await Utils.sendReq(
    `queue-training`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    },
    false
  );
}

import z from "zod";
import { modelSchema } from "./model-schema";
import { volumeSchema } from "./volume-schema";
import { checkpointSchema } from "./checkpoint-schema";

export const gpuStatusSchema = z.object({
  freeGpus: z.number(),
  totalGpus: z.number(),
});

export const taskHistorySchema = z.object({
  enqueuedTime: z.date(),
  startTime: z.date().nullable(),
  endTime: z.date().nullable(),
  id: z.int(),
  taskType: z.int(),
  taskStatus: z.int(),
  userId: z.int(),
  logFile: z.string().nullable(),
  volumeId: z.int().nullable(),
  modelId: z.int().nullable(),
  checkpointId: z.int().nullable(),
  volume: volumeSchema.nullable(),
  model: modelSchema.nullable(),
  checkpoint: checkpointSchema.nullable(),
});

export const statusTaskHistory = z.object({
  values: z.array(taskHistorySchema),
  lenght: z.number(),
});

export const statusSchema = z.object({
  gpuStatus: gpuStatusSchema,
  taskHistory: statusTaskHistory,
  cpuTaskQueue: z.array(taskHistorySchema),
  gpuTaskQueue: z.array(taskHistorySchema),
});

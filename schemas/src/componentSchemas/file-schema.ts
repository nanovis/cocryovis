import z from "zod";

export const fileSchema = z.file().mime("application/zip");

export const multipleFileSchema = z.object({ files: z.array(fileSchema) });
export const singleFileSchema = z.object({ files: fileSchema });

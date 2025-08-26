import { Id, toast } from "react-toastify";
import JSZip from "jszip";
import { DEFAULT_TF } from "../DefaultTransferFunctions";

export type FileMap = Map<string, File>;

export async function sendApiRequest(
  url: string,
  request: RequestInit,
  options?: { query?: Record<string, string> }
) {
  if (!request.method) {
    throw new Error("The 'method' option is required.");
  }
  const defaultOptions: RequestInit = {
    credentials: "include",
  };

  if (options?.query !== undefined) {
    url += "?" + new URLSearchParams(options.query);
  }

  const fetchOptions = { ...defaultOptions, ...request };

  let errorMsg = "Error connecting to the server.";

  const response = await fetch(`/api/${url}`, fetchOptions);

  if (!response.ok) {
    const contentType = response.headers.get("Content-Type");
    const isJson = contentType && contentType.includes("application/json");
    const content = isJson ? await response.json() : await response.text();

    errorMsg = isJson ? content.message : content;
    console.error(
      `Error when calling ${url}: (${response.status}) ${errorMsg}`
    );
    throw new Error(`(${response.status}) ${errorMsg}`);
  }
  return response;
}

// export async function sendRequestWithToast(
//   url: string,
//   options: RequestInit,
//   {
//     successText = null as string | null,
//     pendingTextOverride = null as string | null,
//   } = {}
// ) {
//   const errorRender = (messageData: { data: { message: string } }) => {
//     return messageData.data.message;
//   };

//   const toastParameters: ToastPromiseParams<unknown, { message: string }> = {
//     pending: pendingTextOverride ?? "Processing request...",
//     error: {
//       render: errorRender,
//     },
//   };

//   if (successText) {
//     toastParameters.success = successText;
//   }

//   return toast.promise(
//     sendReq(url, options).then((response) => {
//       return response;
//     }),
//     toastParameters
//   ) as Promise<Response>;
// }

export function updateToastWithErrorMsg(toastId: Id | null, error: unknown) {
  if (toastId !== null) {
    const errMsg = getErrorMessage(error);
    toast.update(toastId, {
      render: errMsg,
      type: "error",
      isLoading: false,
      autoClose: 2000,
      closeOnClick: true,
    });
  }
}

export function getFileNameFromPath(path: string | null | undefined) {
  return path?.replace(/^.*[\\/]/, "");
}

export function shortFileNameFromPath(path: string) {
  const fileName = getFileNameFromPath(path);
  if (!fileName) return "";
  return fileName.substring(0, 50);
}

export function removeExtensionFromPath(path: string) {
  return path.replace(/\.[^/.]+$/, "");
}

export function isRawFile(fileName: string) {
  return fileName.toLowerCase().endsWith(".raw");
}

export function isMrcFile(fileName: string) {
  return fileName.toLowerCase().endsWith(".mrc");
}

export function isInteger(value: string | number) {
  const num = Number(value);
  return Number.isInteger(num);
}

export function isIntegerBetween(
  string: string | number,
  min: number,
  max: number
) {
  const num = Number(string);
  return Number.isInteger(num) && num >= min && num <= max;
}

export function isFloat(value: string | number) {
  const num = Number(value);
  return !Number.isNaN(num);
}

export function isFloatBetween(
  string: string | number,
  min: number,
  max: number
) {
  const num = Number(string);
  return !Number.isNaN(num) && num >= min && num <= max;
}

/**
 * @param {string?} filenameOverwrite
 */
//Don't put in Api folder
export async function downloadFileFromServer(
  url: string,
  filenameOverwrite?: string
) {
  let toastId = null;
  try {
    toastId = toast.loading("Downloading...");
    const response = await sendApiRequest(url, {
      method: "GET",
      credentials: "include",
    });
    await downloadFile(response, filenameOverwrite);
    toast.update(toastId, {
      render: "Download Successful!",
      type: "success",
      isLoading: false,
      autoClose: 2000,
      closeOnClick: true,
    });
  } catch (error) {
    updateToastWithErrorMsg(toastId, error);
  }
}

export function getFilenameFromHeader(response: Response) {
  const disposition = response.headers.get("Content-Disposition");
  if (disposition) {
    const matches = disposition.match(/filename="?([^";]+)"?/);
    if (matches && matches[1]) {
      return matches[1];
    }
  }

  const fileName = response.url.split("/").pop()?.split("?")[0].split("#")[0];
  if (fileName && fileName.includes(".")) return fileName;
}

export async function downloadFile(
  response: Response,
  filenameOverwrite?: string
) {
  const filename = filenameOverwrite ?? getFilenameFromHeader(response);

  if (!filename) {
    throw new Error("Missing filename");
  }

  const blob = await response.blob();

  downloadBlob(blob, filename);
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();

  a.remove();
  window.URL.revokeObjectURL(url);
}

export function readFileAsText(file: Blob): Promise<string | null | undefined> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      resolve(event.target?.result as string | null);
    };

    reader.onerror = () => {
      reject(new Error("File reading has failed."));
    };

    reader.readAsText(file);
  });
}

export function readFileAsArrayBuffer(
  file: Blob
): Promise<ArrayBuffer | null | undefined> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      resolve(event.target?.result as ArrayBuffer | null);
    };

    reader.onerror = () => {
      reject(new Error("File reading has failed."));
    };

    reader.readAsArrayBuffer(file);
  });
}

export async function zipToFileMap(archive: Blob) {
  const zip = new JSZip();
  const zipContent = await zip.loadAsync(archive);

  const fileMap: FileMap = new Map<string, File>();
  for (const filePath of Object.keys(zipContent.files)) {
    const zipEntry = zipContent.file(filePath);
    if (!zipEntry) continue;

    if (!zipEntry.dir) {
      const content = await zipEntry.async("blob");
      fileMap.set(
        filePath,
        new File([content], getFileNameFromPath(filePath) ?? "")
      );
    }
  }

  return fileMap;
}

function InplaceMapMerge(
  destination: Map<any, any>,
  source: Map<any, any>,
  onDuplicate?: (key: any) => void
) {
  source.forEach((value, key) => {
    if (onDuplicate && destination.has(key)) {
      onDuplicate(key);
    }
    destination.set(key, value);
  });
}

export async function unpackAndcreateFileMap(files: FileList | File[]) {
  const fullFileMap: FileMap = new Map<string, File>();

  for (const file of files) {
    if (file.name.endsWith(".zip")) {
      const fileMap = await zipToFileMap(file);
      InplaceMapMerge(fullFileMap, fileMap, (key) => {
        throw new Error(`Duplicate file: ${key}`);
      });
    } else {
      fullFileMap.set(file.name, file);
    }
  }

  return fullFileMap;
}

export function pickDefaultTF(currentIndex: number, blank = false) {
  let tfName = null;
  let tfDefinition = null;
  if (blank) {
    tfName = `${DEFAULT_TF.prefix}_${DEFAULT_TF.defaultTransferFunction.comment}.json`;
    tfDefinition = DEFAULT_TF.defaultTransferFunction;
  } else {
    tfName = `${DEFAULT_TF.prefix}_${currentIndex}.json`;
    tfDefinition = DEFAULT_TF.tfArray[currentIndex];
  }

  return { tfName: tfName, tfDefinition: tfDefinition };
}

export function validateRawFileUpload(files: FileMap | null) {
  if (!files || files.size == 0) {
    toast.error(`No files silected`);
    throw new Error("No files silected.");
  }

  if (files.size > 2) {
    toast.error(
      `Too many files selected. Volume Data only requires a raw data file and settings file.`
    );
    throw new Error("Too many files selected.");
  }

  let rawFileFound = false;
  let settingsFileFound = false;
  files.forEach((file) => {
    if (file.name.endsWith(".raw")) {
      rawFileFound = true;
    } else if (file.name.endsWith(".json")) {
      settingsFileFound = true;
    } else if (file.name.endsWith(".zip")) {
      rawFileFound = true;
      settingsFileFound = true;
    }
  });

  if (!rawFileFound) {
    toast.error(
      "Missing .raw data file. Volume Data requires both a raw data file and settings file."
    );
    throw new Error("Missing .raw data file.");
  }
  if (!settingsFileFound) {
    toast.error(
      "Missing volume settings file. Volume Data requires both a raw data file and settings file."
    );
    throw new Error("Missing volume settings file.");
  }

  return files;
}

export async function convertTiltSeriesToRawData(
  file: File | null,
  volumeDepth: number
) {
  if (!window.WasmModule) {
    throw new Error("Wasm module not initialized!");
  }

  if (!file) {
    throw new Error("No file found.");
  }

  if (!file.name.endsWith(".ali") && !file.name.endsWith(".mrc")) {
    throw new Error("Wrong file format.");
  }

  if (isNaN(volumeDepth) || volumeDepth < 1) {
    throw new Error("Volume depth must be a positive integer.");
  }

  const fileContent = await readFileAsArrayBuffer(file);

  if (!fileContent) {
    throw new Error("Conversion failed.");
  }

  const data = new Uint8Array(fileContent);

  window.WasmModule?.FS.writeFile(file.name, data);
  const settings = await window.WasmModule?.loadForSart(file.name, volumeDepth);
  if (!settings) {
    throw new Error("Conversion failed.");
  }

  const parsedSettings = JSON.parse(settings);

  const fileData = (await window.WasmModule?.FS.readFile(
    parsedSettings.file
  )) as ArrayBuffer;

  return { parsedSettings: parsedSettings, fileData: fileData };
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max);
}

export function convolve3D(
  input: Uint8Array,
  width: number,
  height: number,
  depth: number,
  kernel: number[][][]
): Uint8Array {
  const [kd, kh, kw] = [kernel.length, kernel[0].length, kernel[0][0].length];

  const padDepth = Math.floor(kd / 2);
  const padHeight = Math.floor(kh / 2);
  const padWidth = Math.floor(kw / 2);

  const output = new Uint8Array(depth * height * width);

  for (let oz = 0; oz < depth; oz++) {
    for (let oy = 0; oy < height; oy++) {
      for (let ox = 0; ox < width; ox++) {
        let sum = 0;

        for (let kz = 0; kz < kd; kz++) {
          for (let ky = 0; ky < kh; ky++) {
            for (let kx = 0; kx < kw; kx++) {
              const iz = Math.min(Math.max(oz + kz - padDepth, 0), depth - 1);
              const iy = Math.min(Math.max(oy + ky - padHeight, 0), height - 1);
              const ix = Math.min(Math.max(ox + kx - padWidth, 0), width - 1);

              const value = input[iz * height * width + iy * width + ix];
              sum += value * kernel[kz][ky][kx];
            }
          }
        }

        sum = Math.min(Math.max(sum, 0), 255);

        output[oz * height * width + oy * width + ox] = 255 - sum;
      }
    }
  }

  return output;
}

export function isValidHttpUrl(string: string) {
  let url;

  try {
    url = new URL(string);
  } catch {
    return false;
  }

  return url.protocol === "http:" || url.protocol === "https:";
}

export function waitForNextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

export function toHexColor(r: number, g: number, b: number) {
  return `#${r.toString(16).padStart(2, "0")}${g
    .toString(16)
    .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export function fromHexColor(color: string) {
  return {
    r: parseInt(color[1] + color[2], 16),
    g: parseInt(color[3] + color[4], 16),
    b: parseInt(color[5] + color[6], 16),
  };
}

export async function loadScript(src: string): Promise<void> {
  const res = await fetch(src, { method: "GET" });
  const contentType = res.headers.get("content-type");
  if (!res.ok || !contentType?.includes("javascript")) {
    throw new Error(`Script ${src} failed to load: ${res.status}`);
  }

  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

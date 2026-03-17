import type { TransferFunction } from "@/utils/volumeDescriptor";

const defaultTransferFunction: TransferFunction = {
  breakpoints: [
    { position: 0, color: "#ffffff00" },
    { position: 1, color: "#ffffffff" },
  ],
  comment: "blank",
} as const;

const defaultTransferFunctionArray: TransferFunction[] = [
  {
    breakpoints: [
      { position: 0.34, color: "#ffffff00" },
      { position: 0.45, color: "#cf1f61ff" },
    ],
  },
  {
    breakpoints: [
      { position: 0.43, color: "#ffffff00" },
      { position: 0.86, color: "#c79aabff" },
    ],
  },
  {
    breakpoints: [
      { position: 0.7, color: "#ffffff00" },
      { position: 1, color: "#223378ff" },
    ],
  },
  {
    breakpoints: [
      { position: 0.01, color: "#ffffff00" },
      { position: 0.99, color: "#ffffffff" },
    ],
  },
  {
    breakpoints: [
      { position: 0.97, color: "#ffffff00" },
      { position: 0.99, color: "#0c96dfff" },
    ],
  },
] as const;

export const DEFAULT_TF = {
  prefix: "00-TF-DEFAULT",
  defaultTransferFunction: defaultTransferFunction,
  tfArray: defaultTransferFunctionArray,
} as const;

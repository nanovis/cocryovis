export const CONFIG = {
  maxLabels: 4,
  visibleVolumes: 3,
  shadowsTransferFunctionIndex: 4,
  statusRefreshInterval: 5000,
  clippingPlaneScrollSpeed: 0.007,
  maxRenderedVolumes: 4,
  forceWriteOnlyAnnotations: false,
} as const;

export const CHROMIUM_BASED_BROWSERS: string[] = [
  "edge-chromium",
  "chrome",
  "crios",
  "yandexbrowser",
  "samsung",
  "opera",
] as const;

export const DEFAULT_URL = "http://localhost:8080";

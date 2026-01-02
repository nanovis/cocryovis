import { DEFAULT_URL } from "./constants";

const apiBase = import.meta.env.VITE_API_URL || DEFAULT_URL;
const wsProtocol = apiBase.startsWith("https") ? "wss" : "ws";
export const websocketUrl = `${wsProtocol}://${new URL(apiBase).host}/ws`;

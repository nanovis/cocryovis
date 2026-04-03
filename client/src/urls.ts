const envApiUrl = import.meta.env.VITE_API_URL;

// Prefer build-time env and fallback to current page origin.
const resolvedApiBase = new URL(
	envApiUrl || window.location.origin,
	window.location.origin
);

const wsProtocol = resolvedApiBase.protocol === "https:" ? "wss" : "ws";
export const websocketUrl = `${wsProtocol}://${resolvedApiBase.host}/ws`;

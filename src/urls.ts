export const apiUrl = process.env.REACT_APP_API_URL ?? "http://localhost:8080";
export const websocketUrl = apiUrl ? apiUrl.replace(/^http/, "ws") : "";

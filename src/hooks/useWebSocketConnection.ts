import useWebSocket, { ReadyState } from "react-use-websocket";

export function useWebSocketConnection(
  url: string,
  shouldReconnect: () => boolean
) {
  const { lastMessage, lastJsonMessage, readyState } = useWebSocket(
    shouldReconnect() ? url : null,
    {
      retryOnError: true,
      shouldReconnect: shouldReconnect,
      reconnectAttempts: 999999999,
      reconnectInterval: 1000,
      onOpen: () => console.log("WebSocket connected"),
      onClose: () => console.log("WebSocket disconnected"),
      onError: (error) => console.error("WebSocket error", error),
    }
  );

  const connectionStatus = {
    [ReadyState.CONNECTING]: "Connecting",
    [ReadyState.OPEN]: "Open",
    [ReadyState.CLOSING]: "Closing",
    [ReadyState.CLOSED]: "Closed",
    [ReadyState.UNINSTANTIATED]: "Uninstantiated",
  }[readyState];

  return { lastMessage, lastJsonMessage, connectionStatus };
}

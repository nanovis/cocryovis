import { useEffect, useRef } from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";

export function useWebSocketConnection(
  url: string,
  shouldReconnect: () => boolean
) {
  const { lastMessage, lastJsonMessage, readyState, sendJsonMessage } =
    useWebSocket(shouldReconnect() ? url : null, {
      retryOnError: true,
      shouldReconnect: shouldReconnect,
      reconnectAttempts: 999999999,
      reconnectInterval: 1000,
      onOpen: () => console.log("WebSocket connected"),
      onClose: () => console.log("WebSocket disconnected"),
      onError: (error) => console.error("WebSocket error", error),
    });

  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (readyState === ReadyState.OPEN) {
      console.log("Starting heartbeat interval");

      heartbeatRef.current = setInterval(
        () => {
          sendJsonMessage({ type: "heartbeat" });
          console.log("Sent heartbeat");
        },
        60 * 60 * 1000
      ); // 1 hour

      return () => {
        console.log("Clearing heartbeat interval");
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      };
    }
  }, [readyState]);

  const connectionStatus = {
    [ReadyState.CONNECTING]: "Connecting",
    [ReadyState.OPEN]: "Open",
    [ReadyState.CLOSING]: "Closing",
    [ReadyState.CLOSED]: "Closed",
    [ReadyState.UNINSTANTIATED]: "Uninstantiated",
  }[readyState];

  return { lastMessage, lastJsonMessage, connectionStatus };
}

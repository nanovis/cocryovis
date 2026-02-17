import { useEffect, useRef } from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";

export function useWebSocketConnection(url: string, enabled: boolean) {
  const { lastMessage, lastJsonMessage, readyState, sendJsonMessage } =
    useWebSocket(enabled ? url : null, {
      retryOnError: true,
      reconnectAttempts: Infinity,
      reconnectInterval: 1000,
      onOpen: () => console.log("WebSocket connected"),
      onClose: () => console.log("WebSocket disconnected"),
      onError: (error) => console.error("WebSocket error", error),
    });

  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Is this even relevant on server?
  useEffect(() => {
    if (readyState === ReadyState.OPEN) {
      console.log("Starting heartbeat interval");

      heartbeatRef.current = setInterval(
        () => {
          sendJsonMessage({ type: "heartbeat" });
          console.log("Sent heartbeat");
        },
        30 * 1000 // 30 seconds
      );

      return () => {
        console.log("Clearing heartbeat interval");
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      };
    }
  }, [readyState, sendJsonMessage]);

  const connectionStatus = {
    [ReadyState.CONNECTING]: "Connecting",
    [ReadyState.OPEN]: "Open",
    [ReadyState.CLOSING]: "Closing",
    [ReadyState.CLOSED]: "Closed",
    [ReadyState.UNINSTANTIATED]: "Uninstantiated",
  }[readyState];

  return { lastMessage, lastJsonMessage, connectionStatus };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { io } from "socket.io-client";

export type WebSocketConfig = {
  url: string;
  namespace?: string;
  options?: any;
};

export type WebSocketHookReturn = {
  socket: Socket | null;
  isConnected: boolean;
  error: string | null;
  subscribe: (channels: string[], filters?: any) => void;
  unsubscribe: (channels: string[]) => void;
  emit: (event: string, data: any) => void;
  on: (event: string, callback: (data: any) => void) => void;
  off: (event: string) => void;
};

export function useWebSocket(config: WebSocketConfig): WebSocketHookReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const listenersRef = useRef<Map<string, (data: any) => void>>(new Map());

  const connect = useCallback(() => {
    try {
      const socketUrl = `${config.url}${config.namespace || ""}`;
      const socket = io(socketUrl, {
        transports: ["websocket"],
        timeout: 10000,
        ...config.options,
      });

      socket.on("connect", () => {
        setIsConnected(true);
        setError(null);
      });

      socket.on("disconnect", () => {
        setIsConnected(false);
      });

      socket.on("connect_error", (err) => {
        setError(`Connection failed: ${err.message}`);
        setIsConnected(false);
      });

      socket.on("error", (err) => {
        setError(`Socket error: ${err.message || err}`);
      });

      socketRef.current = socket;
    } catch (err) {
      setError(`Failed to create socket: ${err.message}`);
    }
  }, [config.url, config.namespace, config.options]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const subscribe = useCallback(
    (channels: string[], filters?: any) => {
      if (socketRef.current && isConnected) {
        socketRef.current.emit("subscribe", { channels, filters });
      }
    },
    [isConnected],
  );

  const unsubscribe = useCallback(
    (channels: string[]) => {
      if (socketRef.current && isConnected) {
        socketRef.current.emit("unsubscribe", { channels });
      }
    },
    [isConnected],
  );

  const emit = useCallback(
    (event: string, data: any) => {
      if (socketRef.current && isConnected) {
        socketRef.current.emit(event, data);
      }
    },
    [isConnected],
  );

  const on = useCallback((event: string, callback: (data: any) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
      listenersRef.current.set(event, callback);
    }
  }, []);

  const off = useCallback((event: string) => {
    if (socketRef.current) {
      const callback = listenersRef.current.get(event);
      if (callback) {
        socketRef.current.off(event, callback);
        listenersRef.current.delete(event);
      }
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    socket: socketRef.current,
    isConnected,
    error,
    subscribe,
    unsubscribe,
    emit,
    on,
    off,
  };
}

// Specialized hooks for different data types
export function useRealtimeMetrics(websocketUrl: string) {
  const { subscribe, unsubscribe, on, off, isConnected } = useWebSocket({
    url: websocketUrl,
    namespace: "/monitoring",
  });

  const [systemMetrics, setSystemMetrics] = useState<any>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<any>(null);
  const [serviceHealth, setServiceHealth] = useState<any[]>([]);

  useEffect(() => {
    if (isConnected) {
      subscribe(["systemMetrics", "performance", "serviceHealth"]);

      on("systemMetrics", (data) => {
        setSystemMetrics(data.data);
      });

      on("performanceMetrics", (data) => {
        setPerformanceMetrics(data.data);
      });

      on("serviceHealth", (data) => {
        if (data.type === "serviceHealth") {
          setServiceHealth((prev) => {
            const updated = [...prev];
            const index = updated.findIndex((s) => s.service === data.data.service);
            if (index >= 0) {
              updated[index] = data.data;
            } else {
              updated.push(data.data);
            }
            return updated;
          });
        }
      });

      return () => {
        off("systemMetrics");
        off("performanceMetrics");
        off("serviceHealth");
        unsubscribe(["systemMetrics", "performance", "serviceHealth"]);
      };
    }
  }, [isConnected, subscribe, unsubscribe, on, off]);

  return {
    systemMetrics,
    performanceMetrics,
    serviceHealth,
    isConnected,
  };
}

export function useRealtimeAlerts(websocketUrl: string) {
  const { subscribe, unsubscribe, on, off, isConnected, emit } = useWebSocket({
    url: websocketUrl,
    namespace: "/monitoring",
  });

  const [alerts, setAlerts] = useState<any[]>([]);
  const [activeAlertsCount, setActiveAlertsCount] = useState(0);

  useEffect(() => {
    if (isConnected) {
      subscribe(["alerts"]);

      on("alertCreated", (data) => {
        setAlerts((prev) => [data.data, ...prev]);
        setActiveAlertsCount((prev) => prev + 1);
      });

      on("alertResolved", (data) => {
        setAlerts((prev) =>
          prev.map((alert) =>
            alert.id === data.data.id
              ? { ...alert, resolved: true, resolvedAt: data.data.resolvedAt }
              : alert,
          ),
        );
        setActiveAlertsCount((prev) => Math.max(0, prev - 1));
      });

      on("activeAlerts", (data) => {
        setAlerts(data.data);
        setActiveAlertsCount(data.count);
      });

      // Request initial alerts
      emit("getActiveAlerts", {});

      return () => {
        off("alertCreated");
        off("alertResolved");
        off("activeAlerts");
        unsubscribe(["alerts"]);
      };
    }
  }, [isConnected, subscribe, unsubscribe, on, off, emit]);

  const resolveAlert = useCallback(
    (alertId: string) => {
      if (isConnected) {
        emit("resolveAlert", { alertId });
      }
    },
    [isConnected, emit],
  );

  return {
    alerts,
    activeAlertsCount,
    resolveAlert,
    isConnected,
  };
}

export function useRealtimeConfiguration(websocketUrl: string) {
  const { subscribe, unsubscribe, on, off, isConnected, emit } = useWebSocket({
    url: websocketUrl,
    namespace: "/monitoring",
  });

  const [configSummary, setConfigSummary] = useState<any>(null);
  const [configChanges, setConfigChanges] = useState<any[]>([]);

  useEffect(() => {
    if (isConnected) {
      subscribe(["configuration"]);

      on("configurationChanged", (data) => {
        setConfigChanges((prev) => [data.data, ...prev.slice(0, 49)]); // Keep last 50 changes
      });

      on("configurationSummary", (data) => {
        setConfigSummary(data.data);
      });

      return () => {
        off("configurationChanged");
        off("configurationSummary");
        unsubscribe(["configuration"]);
      };
    }
  }, [isConnected, subscribe, unsubscribe, on, off]);

  const getConfiguration = useCallback(
    (type?: string) => {
      if (isConnected) {
        emit("getConfiguration", { type });
      }
    },
    [isConnected, emit],
  );

  return {
    configSummary,
    configChanges,
    getConfiguration,
    isConnected,
  };
}

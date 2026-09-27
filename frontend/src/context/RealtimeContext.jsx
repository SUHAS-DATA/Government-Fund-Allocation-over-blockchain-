import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { getWsUrl } from '../services/api';
import API from '../services/api';

const RealtimeContext = createContext({
  isConnected: false,
  lastEvent: null,
  mutationTick: 0,
  registerListener: () => () => {},
  triggerManualSync: () => {},
});

export const RealtimeProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const [mutationTick, setMutationTick] = useState(0);

  const listenersRef = useRef(new Set());
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const broadcastChannelRef = useRef(null);
  const lastMutationTimeRef = useRef(0);

  // Notify all registered component listeners
  const notifyListeners = useCallback((eventPayload) => {
    setLastEvent(eventPayload);
    setMutationTick((prev) => prev + 1);
    listenersRef.current.forEach((fn) => {
      try {
        fn(eventPayload);
      } catch (err) {
        console.error('Error executing realtime listener:', err);
      }
    });
  }, []);

  // Register / Unregister component callbacks
  const registerListener = useCallback((fn) => {
    listenersRef.current.add(fn);
    return () => {
      listenersRef.current.delete(fn);
    };
  }, []);

  // Manual or programmatic sync trigger across tabs and windows
  const triggerManualSync = useCallback((event = { type: 'DATA_MUTATED', source: 'manual' }) => {
    notifyListeners(event);
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage(event);
      } catch (e) {
        // BroadcastChannel send error ignored
      }
    }
  }, [notifyListeners]);

  // Establish and manage WebSocket connection
  const connectWebSocket = useCallback(() => {
    if (typeof window === 'undefined') return;

    // Clean up existing socket if any
    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch (e) {}
      socketRef.current = null;
    }

    const wsUrl = getWsUrl();
    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        // Start heartbeat ping every 20 seconds
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('ping');
          }
        }, 20000);
      };

      ws.onmessage = (event) => {
        if (event.data === 'pong') return;

        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === 'DATA_MUTATED') {
            notifyListeners(parsed);
            if (broadcastChannelRef.current) {
              try {
                broadcastChannelRef.current.postMessage(parsed);
              } catch (e) {}
            }
          }
        } catch (e) {
          // Non-JSON message ignored
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
        // Attempt reconnect with backoff
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connectWebSocket();
          }, 3000);
        }
      };

      ws.onerror = () => {
        setIsConnected(false);
        try {
          ws.close();
        } catch (e) {}
      };
    } catch (err) {
      setIsConnected(false);
      if (!reconnectTimeoutRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = null;
          connectWebSocket();
        }, 5000);
      }
    }
  }, [notifyListeners]);

  // Cross-tab synchronization via BroadcastChannel
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel('govtfund_realtime_sync');
        broadcastChannelRef.current = bc;
        bc.onmessage = (msgEvent) => {
          if (msgEvent.data) {
            notifyListeners(msgEvent.data);
          }
        };
      } catch (e) {
        // BroadcastChannel unavailable
      }
    }

    return () => {
      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.close();
        } catch (e) {}
      }
    };
  }, [notifyListeners]);

  // Tab visibility sync: when user switches back to this browser/laptop tab, refresh instantly
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        notifyListeners({ type: 'VISIBILITY_RESUME', timestamp: Date.now() });
      }
    };

    const handleWindowFocus = () => {
      notifyListeners({ type: 'WINDOW_FOCUS', timestamp: Date.now() });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [notifyListeners]);

  // Initialize WebSocket connection
  useEffect(() => {
    connectWebSocket();

    // Background HTTP fallback polling in case WebSocket is blocked or disconnected
    const fallbackPollInterval = setInterval(async () => {
      try {
        const res = await API.get('/realtime/status');
        if (res && res.mutation_counter !== undefined) {
          if (lastMutationTimeRef.current !== 0 && res.last_mutation_time > lastMutationTimeRef.current) {
            notifyListeners({ type: 'DATA_MUTATED', source: 'polling' });
          }
          lastMutationTimeRef.current = res.last_mutation_time;
        }
      } catch (e) {
        // Polling error silently suppressed
      }
    }, 6000);

    return () => {
      clearInterval(fallbackPollInterval);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch (e) {}
      }
    };
  }, [connectWebSocket, notifyListeners]);

  return (
    <RealtimeContext.Provider
      value={{
        isConnected,
        lastEvent,
        mutationTick,
        registerListener,
        triggerManualSync,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
};

export const useRealtime = () => useContext(RealtimeContext);

/**
 * useRealtimeSync Hook
 * Attach to any dashboard, page, or table component.
 * Automatically executes the given refreshFunction whenever:
 * 1. An action occurs anywhere in the system (across laptops/browsers via WebSocket)
 * 2. Window/tab is focused or resumed
 * 3. Fallback polling tick triggers
 *
 * @param {Function} refreshFunction - Function to refresh page data (e.g. loadData)
 * @param {Object} options - { interval: ms, enabled: boolean }
 */
export const useRealtimeSync = (refreshFunction, options = {}) => {
  const { interval = 6000, enabled = true } = options;
  const { registerListener, mutationTick } = useRealtime();
  const refreshRef = useRef(refreshFunction);
  const debounceTimerRef = useRef(null);

  useEffect(() => {
    refreshRef.current = refreshFunction;
  }, [refreshFunction]);

  // Debounced execution to avoid multiple rapid re-renders
  const triggerDebounced = useCallback(() => {
    if (!enabled) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      if (typeof refreshRef.current === 'function') {
        try {
          refreshRef.current();
        } catch (err) {
          console.error('Error in useRealtimeSync callback:', err);
        }
      }
    }, 300);
  }, [enabled]);

  // Listen to WebSocket broadcasts and tab focus
  useEffect(() => {
    if (!enabled) return;
    const unregister = registerListener(() => {
      triggerDebounced();
    });
    return () => {
      unregister();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [registerListener, triggerDebounced, enabled]);

  // Fallback periodic sync interval
  useEffect(() => {
    if (!enabled || !interval) return;
    const timer = setInterval(() => {
      triggerDebounced();
    }, interval);

    return () => clearInterval(timer);
  }, [interval, enabled, triggerDebounced]);
};

/**
 * LiveSyncIndicator Component
 * Visual status pill indicating active real-time multi-device connection.
 */
export const LiveSyncIndicator = ({ style = {} }) => {
  const { isConnected } = useRealtime();

  return (
    <div
      title={isConnected ? 'Real-Time Multi-Device Sync Active (Auto-updating)' : 'Connecting to Live Sync...'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '3px 10px',
        borderRadius: '20px',
        fontSize: '11px',
        fontWeight: '700',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        backgroundColor: isConnected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
        color: isConnected ? '#059669' : '#D97706',
        border: `1px solid ${isConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
        transition: 'all 0.3s ease',
        ...style,
      }}
    >
      <span
        style={{
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          backgroundColor: isConnected ? '#10B981' : '#F59E0B',
          boxShadow: isConnected ? '0 0 6px #10B981' : 'none',
          animation: isConnected ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none',
        }}
      />
      <span>{isConnected ? 'LIVE SYNC' : 'CONNECTING'}</span>
    </div>
  );
};

export default RealtimeContext;

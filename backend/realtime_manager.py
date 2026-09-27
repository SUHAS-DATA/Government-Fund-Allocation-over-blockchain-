import asyncio
import json
import logging
import time
from typing import Set, Dict, Any, Optional
from fastapi import WebSocket

logger = logging.getLogger("RealtimeManager")

class RealtimeConnectionManager:
    """
    Central WebSocket Connection Manager for PFMS Blockchain System.
    Enables instant real-time synchronization across multiple laptops, PCs,
    and mobile devices without requiring manual browser refreshes.
    """
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self.main_loop: Optional[asyncio.AbstractEventLoop] = None
        self.last_mutation_time: float = time.time()
        self.mutation_counter: int = 0

    def set_loop(self, loop: asyncio.AbstractEventLoop):
        self.main_loop = loop

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"WebSocket client connected. Active clients: {len(self.active_connections)}")
        
        # Send initial connection confirmation
        try:
            await websocket.send_json({
                "type": "CONNECTION_ESTABLISHED",
                "timestamp": time.time(),
                "mutation_counter": self.mutation_counter,
                "message": "Connected to PFMS Real-Time Sync Hub"
            })
        except Exception as e:
            logger.warning(f"Failed to send greeting to new client: {e}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        logger.info(f"WebSocket client disconnected. Remaining active: {len(self.active_connections)}")

    async def broadcast(self, event_type: str, data: Optional[Dict[str, Any]] = None):
        """
        Asynchronously broadcasts a typed event to all connected browsers/devices.
        """
        self.last_mutation_time = time.time()
        self.mutation_counter += 1

        payload = {
            "type": event_type,
            "data": data or {},
            "timestamp": self.last_mutation_time,
            "mutation_counter": self.mutation_counter
        }
        raw_msg = json.dumps(payload)

        dead_connections = []
        for connection in list(self.active_connections):
            try:
                await connection.send_text(raw_msg)
            except Exception as e:
                logger.debug(f"Failed to send to socket, scheduling cleanup: {e}")
                dead_connections.append(connection)

        for dead in dead_connections:
            self.disconnect(dead)

    def trigger_broadcast(self, event_type: str, data: Optional[Dict[str, Any]] = None):
        """
        Thread-safe and context-agnostic trigger for broadcasts.
        Can be called from async route handlers, sync middleware, or background threads.
        """
        try:
            loop = None
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = self.main_loop

            if loop and loop.is_running():
                # Schedule in the running event loop
                asyncio.run_coroutine_threadsafe(self.broadcast(event_type, data), loop)
            else:
                # Fallback if no loop is running in thread
                if self.main_loop and self.main_loop.is_running():
                    asyncio.run_coroutine_threadsafe(self.broadcast(event_type, data), self.main_loop)
                else:
                    asyncio.run(self.broadcast(event_type, data))
        except Exception as e:
            logger.warning(f"Error triggering realtime broadcast: {e}")

    def get_status(self) -> Dict[str, Any]:
        return {
            "active_clients": len(self.active_connections),
            "last_mutation_time": self.last_mutation_time,
            "mutation_counter": self.mutation_counter
        }

# Global Singleton Instance
realtime_manager = RealtimeConnectionManager()

import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { JwtService } from "../utils/jwt";
import { userRoom, ADMIN_ROOM } from "./rooms";

let io: Server;

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
  : "*";

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
    },
  });

  // Authenticate every socket via the same JWT used by the REST API.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, "");

    if (!token) {
      return next(new Error("Unauthorized - Missing token"));
    }

    try {
      const payload = JwtService.verify(token);
      if (!payload?.userId) {
        return next(new Error("Unauthorized - Invalid token"));
      }
      socket.data.user = {
        userId: payload.userId,
        telegramId: String(payload.telegramId ?? ""),
        role: payload.role ?? "USER",
      };
      return next();
    } catch {
      return next(new Error("Unauthorized - Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.user?.userId;
    if (userId) {
      socket.join(userRoom(userId));
      console.log(`[Socket] Client connected: ${socket.id} (user: ${userId})`);
    } else {
      console.log(`[Socket] Client connected: ${socket.id}`);
    }

    // Legacy manual room join kept for backwards compatibility.
    socket.on("join_user_room", (requestedUserId: string) => {
      if (socket.data.user?.userId && requestedUserId === socket.data.user.userId) {
        socket.join(userRoom(requestedUserId));
      }
    });

    socket.on("join_admin_room", () => {
      const role = socket.data.user?.role;
      if (role === "ADMIN" || role === "SUPERADMIN") {
        socket.join(ADMIN_ROOM);
      }
    });

    socket.on("disconnect", () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error("Socket.IO not initialized. Call initSocket() first.");
  }
  return io;
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  try {
    getIO().to(userRoom(userId)).emit(event, payload);
  } catch {}
}

export function emitToAdmin(event: string, payload: unknown): void {
  try {
    getIO().to(ADMIN_ROOM).emit(event, payload);
  } catch {}
}

export function emitBroadcast(event: string, payload: unknown): void {
  try {
    getIO().emit(event, payload);
  } catch {}
}

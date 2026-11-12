import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { JwtService } from "../utils/jwt";
import { userRoom, ADMIN_ROOM } from "./rooms";
import { LiveKenoEngine } from "../services/live-keno.service";

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

  // ==========================================
  // 1. LIVE KENO NAMESPACE: /gamesocket
  // Used by the Atlas V / World Bingo Keno Frontend
  // ==========================================
  const gameSocket = io.of("/gamesocket");
  const engine = LiveKenoEngine.getInstance();
  engine.attachNamespace(gameSocket);

  gameSocket.on("connection", (socket: Socket) => {
    let currentUserId: string = "demo_player";

    console.log(`[GameSocket] Client connected: ${socket.id}`);

    const broadcastOnline = () => {
      const count = gameSocket.sockets ? gameSocket.sockets.size : 1;
      gameSocket.emit("message", {
        status: "roomevent",
        data: {
          status: "online",
          count,
        },
      });
    };

    broadcastOnline();

    socket.on("message", async (payload: any) => {
      if (!payload) return;

      try {
        if (payload.status === "login") {
          currentUserId = String(payload.id || payload.token || "demo_player");
          socket.data.userId = currentUserId;

          // Fetch fresh login snapshot
          await engine.getUserBalance(currentUserId);
          const snapshot = engine.getLoginSnapshot(currentUserId, socket.id);

          socket.emit("message", {
            status: "eventresp",
            data: snapshot,
          });

          broadcastOnline();
        } else if (payload.status === "event" && payload.data) {
          const eventData = payload.data;

          if (eventData.status === "betset") {
            const bet = Number(eventData.bet);
            const numbers = eventData.numbers;

            const result = await engine.placeBet(currentUserId, bet, numbers);

            if (!result.success) {
              socket.emit("message", {
                status: "eventresp",
                data: {
                  status: "betclosed",
                  error: result.error || "Bet rejected",
                  credit: result.balance,
                },
              });
            } else {
              socket.emit("message", {
                status: "eventresp",
                data: {
                  status: "ticketsset",
                  ticket: {
                    t: result.ticket!.id,
                    b: result.ticket!.bet,
                    n: result.ticket!.numbers,
                  },
                  credit: result.balance,
                  total_count: engine.currentRound.totalTickets,
                  free_bets: [],
                },
              });

              // Broadcast new ticket to other players in room
              socket.broadcast.emit("message", {
                status: "roomevent",
                data: {
                  status: "ticketsset",
                  user: currentUserId,
                  tickets: [
                    {
                      t: result.ticket!.id,
                      b: result.ticket!.bet,
                      n: result.ticket!.numbers,
                    },
                  ],
                  total_count: engine.currentRound.totalTickets,
                },
              });
            }
          } else if (eventData.status === "chat_message") {
            const text = String(eventData.text || "").trim();
            if (text) {
              const msg = engine.addChatMessage(currentUserId, text);
              gameSocket.emit("message", {
                status: "roomevent",
                data: {
                  status: "chat",
                  message: {
                    id: msg.id,
                    username: msg.user,
                    text: msg.text,
                    createdAt: msg.timestamp,
                    likes: msg.likes,
                  },
                },
              });
            }
          } else if (eventData.status === "chat_rain") {
            const amount = Number(eventData.amount);
            const players = Number(eventData.players);
            const rainRes = await engine.createRain(currentUserId, amount, players);
            if (rainRes.success && rainRes.message) {
              const rm = rainRes.message;
              gameSocket.emit("message", {
                status: "roomevent",
                data: {
                  status: "chat",
                  message: {
                    id: rm.id,
                    username: rm.user,
                    createdAt: rm.timestamp,
                    likes: rm.likes,
                    kind: "rain",
                    meta: rm.rain
                      ? {
                          amount: rm.rain.amount,
                          playerCount: rm.rain.players,
                          claimedCount: rm.rain.claimedBy.length,
                          expiresAt: rm.rain.expiresAt,
                          status: "open",
                        }
                      : undefined,
                  },
                },
              });
              const newBal = await engine.getUserBalance(currentUserId);
              socket.emit("message", {
                status: "eventresp",
                data: {
                  status: "balance",
                  credit: newBal,
                },
              });
            } else {
              socket.emit("message", {
                status: "eventresp",
                data: {
                  status: "chat_error",
                  error: rainRes.error || "Could not send rain",
                },
              });
            }
          } else if (eventData.status === "chat_rain_claim") {
            const messageId = Number(eventData.messageId);
            const claimRes = await engine.claimRain(currentUserId, messageId);
            if (claimRes.success) {
              gameSocket.emit("message", {
                status: "roomevent",
                data: {
                  status: "chat_rain_update",
                  messageId,
                },
              });
              const newBal = await engine.getUserBalance(currentUserId);
              socket.emit("message", {
                status: "eventresp",
                data: {
                  status: "balance",
                  credit: newBal,
                },
              });
            }
          } else if (eventData.status === "chat_reaction") {
            const messageId = Number(eventData.messageId);
            const likes = engine.toggleLike(messageId);
            gameSocket.emit("message", {
              status: "roomevent",
              data: {
                status: "chat_reaction",
                messageId,
                likes,
              },
            });
          }
        }
      } catch (err: any) {
        console.error("[GameSocket Error]", err);
      }
    });

    socket.on("disconnect", () => {
      console.log(`[GameSocket] Client disconnected: ${socket.id}`);
      broadcastOnline();
    });
  });

  // ==========================================
  // 2. ROOT NAMESPACE: / (Legacy & Admin Socket)
  // ==========================================
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
      console.log(`[Socket] Root client connected: ${socket.id} (user: ${userId})`);
    }

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
      console.log(`[Socket] Root client disconnected: ${socket.id}`);
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

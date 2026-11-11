"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSocket = initSocket;
exports.getIO = getIO;
exports.emitToUser = emitToUser;
exports.emitToAdmin = emitToAdmin;
exports.emitBroadcast = emitBroadcast;
const socket_io_1 = require("socket.io");
const jwt_1 = require("../utils/jwt");
const rooms_1 = require("./rooms");
const live_keno_service_1 = require("../services/live-keno.service");
let io;
const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
    : "*";
function initSocket(httpServer) {
    io = new socket_io_1.Server(httpServer, {
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
    const engine = live_keno_service_1.LiveKenoEngine.getInstance();
    engine.attachNamespace(gameSocket);
    gameSocket.on("connection", (socket) => {
        let currentUserId = "demo_player";
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
        socket.on("message", async (payload) => {
            if (!payload)
                return;
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
                }
                else if (payload.status === "event" && payload.data) {
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
                        }
                        else {
                            socket.emit("message", {
                                status: "eventresp",
                                data: {
                                    status: "ticketsset",
                                    ticket: {
                                        t: result.ticket.id,
                                        b: result.ticket.bet,
                                        n: result.ticket.numbers,
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
                                            t: result.ticket.id,
                                            b: result.ticket.bet,
                                            n: result.ticket.numbers,
                                        },
                                    ],
                                    total_count: engine.currentRound.totalTickets,
                                },
                            });
                        }
                    }
                    else if (eventData.status === "chat_message") {
                        const text = String(eventData.text || "").trim();
                        if (text) {
                            const msg = engine.addChatMessage(currentUserId, text);
                            gameSocket.emit("message", {
                                status: "roomevent",
                                data: {
                                    status: "chat",
                                    id: msg.id,
                                    user: msg.user,
                                    text: msg.text,
                                    timestamp: msg.timestamp,
                                    likes: msg.likes,
                                },
                            });
                        }
                    }
                    else if (eventData.status === "chat_rain") {
                        const amount = Number(eventData.amount);
                        const players = Number(eventData.players);
                        const rainRes = await engine.createRain(currentUserId, amount, players);
                        if (rainRes.success && rainRes.message) {
                            gameSocket.emit("message", {
                                status: "roomevent",
                                data: {
                                    status: "chat",
                                    ...rainRes.message,
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
                        else {
                            socket.emit("message", {
                                status: "eventresp",
                                data: {
                                    status: "chat_error",
                                    error: rainRes.error || "Could not send rain",
                                },
                            });
                        }
                    }
                    else if (eventData.status === "chat_rain_claim") {
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
                    }
                    else if (eventData.status === "chat_reaction") {
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
            }
            catch (err) {
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
            const payload = jwt_1.JwtService.verify(token);
            if (!payload?.userId) {
                return next(new Error("Unauthorized - Invalid token"));
            }
            socket.data.user = {
                userId: payload.userId,
                telegramId: String(payload.telegramId ?? ""),
                role: payload.role ?? "USER",
            };
            return next();
        }
        catch {
            return next(new Error("Unauthorized - Invalid or expired token"));
        }
    });
    io.on("connection", (socket) => {
        const userId = socket.data.user?.userId;
        if (userId) {
            socket.join((0, rooms_1.userRoom)(userId));
            console.log(`[Socket] Root client connected: ${socket.id} (user: ${userId})`);
        }
        socket.on("join_user_room", (requestedUserId) => {
            if (socket.data.user?.userId && requestedUserId === socket.data.user.userId) {
                socket.join((0, rooms_1.userRoom)(requestedUserId));
            }
        });
        socket.on("join_admin_room", () => {
            const role = socket.data.user?.role;
            if (role === "ADMIN" || role === "SUPERADMIN") {
                socket.join(rooms_1.ADMIN_ROOM);
            }
        });
        socket.on("disconnect", () => {
            console.log(`[Socket] Root client disconnected: ${socket.id}`);
        });
    });
    return io;
}
function getIO() {
    if (!io) {
        throw new Error("Socket.IO not initialized. Call initSocket() first.");
    }
    return io;
}
function emitToUser(userId, event, payload) {
    try {
        getIO().to((0, rooms_1.userRoom)(userId)).emit(event, payload);
    }
    catch { }
}
function emitToAdmin(event, payload) {
    try {
        getIO().to(rooms_1.ADMIN_ROOM).emit(event, payload);
    }
    catch { }
}
function emitBroadcast(event, payload) {
    try {
        getIO().emit(event, payload);
    }
    catch { }
}

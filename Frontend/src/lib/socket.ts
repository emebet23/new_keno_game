import { io, Socket } from "socket.io-client";
import { API_BASE } from "./api";

const SOCKET_EVENTS = {
  WALLET_UPDATED: "wallet:updated",
  NEW_DEPOSIT: "deposit:new",
  NEW_TICKET: "ticket:new",
  GAME_STARTED: "game:started",
  GAME_SETTLED: "game:settled",
  DRAW_NUMBERS: "draw:numbers",
} as const;

export type LiveSettledTicket = {
  ticketId: string;
  selectedNumbers: number[];
  drawNumbers: number[];
  matches: number;
  multiplier: number;
  betAmount: number;
  payout: number;
  won: boolean;
};

export type LiveSettledEvent = {
  gameId: string;
  roundNumber: number;
  drawNumbers: number[];
  totalTickets: number;
  totalPayout: number;
  serverSeed?: string;
  serverSeedHash?: string;
  tickets: LiveSettledTicket[];
  playerPayout: number;
};

export type DrawNumbersEvent = {
  gameId: string;
  roundNumber: number;
  drawNumbers: number[];
};

export type GameStartedEvent = {
  gameId: string;
  roundNumber: number;
};

export type WalletUpdatedEvent = {
  balance: number;
  playBalance: number;
};

function getToken(): string | null {
  return localStorage.getItem("keno_token");
}

export function createSocket(): Socket {
  const socket = io(API_BASE, {
    autoConnect: false,
    transports: ["websocket", "polling"],
    auth: (cb) => cb({ token: getToken() }),
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });

  // Re-auth with a fresh token after a transient failure / reconnect.
  socket.on("connect_error", (err: any) => {
    if (err?.message?.includes("expired") || err?.message?.includes("Invalid")) {
      socket.auth = { token: getToken() };
    }
  });

  return socket;
}

export { SOCKET_EVENTS };

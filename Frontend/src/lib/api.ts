import axios from "axios";

export const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
});

// Auto inject JWT token from localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("keno_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// If the backend rejects our token (expired/invalid/secret rotated),
// clear it so the NEXT request goes through ensureAuth() and re-logs in
// via Telegram instead of retrying with the same dead token forever.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("keno_token");
      localStorage.removeItem("keno_user");
    }
    return Promise.reject(error);
  }
);

const saveAuth = (data: { token: string; user: any }) => {
  localStorage.setItem("keno_token", data.token);
  if (data.user) {
    localStorage.setItem("keno_user", JSON.stringify(data.user));
  }
};

// Real Telegram user exposed by the WebApp SDK (bot "Play" deep link opens us here).
export function getTelegramProfile(): {
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  initData?: string;
} | null {
  try {
    const tg = (window as any)?.Telegram?.WebApp;
    if (!tg?.initDataUnsafe?.user?.id) return null;
    tg.ready?.();
    const user = tg.initDataUnsafe.user;
    return {
      telegramId: user.id,
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
      initData: tg.initData || undefined,
    };
  } catch {
    return null;
  }
}

export const authApi = {
  loginTelegram: async (data: {
    telegramId: number | string;
    username?: string;
    firstName?: string;
    lastName?: string;
    initData?: string;
  }) => {
    const res = await axios.post(`${API_BASE}/auth/telegram`, {
      telegramId: Number(data.telegramId),
      username: data.username || undefined,
      firstName: data.firstName || undefined,
      lastName: data.lastName || undefined,
      initData: data.initData || undefined,
    });

    if (res.data.success && res.data.data.token) {
      saveAuth(res.data.data);
    }
    return res.data.data;
  },

  loginDev: async (data: {
    telegramId?: number | string;
    username?: string;
    firstName?: string;
    role?: "USER" | "ADMIN" | "SUPERADMIN";
  }) => {
    const res = await axios.post(`${API_BASE}/auth/dev-login`, data);

    if (res.data.success && res.data.data.token) {
      saveAuth(res.data.data);
    }
    return res.data.data;
  },
};

// Auto authentication helper
export async function ensureAuth(role: "USER" | "ADMIN" | "SUPERADMIN" = "USER") {
  const existingToken = localStorage.getItem("keno_token");
  const telegram = getTelegramProfile();

  // Real Telegram Mini App user: prefer their identity and drop any stale token
  // from a different (e.g. default/dev) account so the bot-registered name shows.
  if (telegram && role === "USER") {
    const cached: any = (() => {
      try {
        return JSON.parse(localStorage.getItem("keno_user") || "null");
      } catch {
        return null;
      }
    })();
    const sameUser = cached && Number(cached.telegramId) === telegram.telegramId;
    if (!existingToken || !sameUser) {
      try {
        return (await authApi.loginTelegram(telegram)).token;
      } catch (err) {
        console.error("Telegram login failed:", err);
      }
    }
    return existingToken;
  }

  if (existingToken) return existingToken;

  try {
    if (role === "ADMIN") {
      return (await authApi.loginDev({
        username: "admin_keno",
        firstName: "Admin",
        role: "ADMIN",
      })).token;
    }

    return (await authApi.loginTelegram({
      telegramId: 123456789,
      username: "player_one",
      firstName: "Player",
      lastName: "One",
    })).token;
  } catch (err) {
    console.error("Auto auth failed:", err);
  }
  return null;
}

export interface Wallet {
  id: string;
  userId: string;
  playBalance: number;
  mainBalance: number;
  totalBalance: number;
  currency: string;
}

export interface Ticket {
  id: string;
  gameId: string;
  roundNumber: number;
  betAmount: number;
  selectedNumbers: number[];
  drawNumbers: number[];
  matches: number;
  multiplier: number;
  payout: number;
  status: "WON" | "LOST" | "PENDING";
  mode: "INSTANT" | "CLASSIC";
  createdAt: string;
}

export interface PlayResponse {
  gameId: string;
  roundNumber: number;
  mode: "INSTANT" | "CLASSIC";
  drawNumbers: number[];
  totalTickets: number;
  settledTickets: {
    ticketId: string;
    selectedNumbers: number[];
    drawNumbers: number[];
    matches: number;
    multiplier: number;
    betAmount: number;
    payout: number;
    won: boolean;
  }[];
  totalPayout: number;
  fairness?: {
    serverSeedHash: string;
    serverSeed?: string;
    clientSeed: string;
    nonce: number;
  };
  ticketId?: string;
  status?: string;
}

export interface CurrentRound {
  gameId: string;
  roundNumber: number;
  mode: string;
  status: string;
  startedAt: string;
  drawIntervalSec?: number;
  minBet?: number;
  maxBet?: number;
  serverSeedHash?: string;
  clientSeed?: string;
  nonce?: number;
}

export interface ProvablyFairInfo {
  gameId: string;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

export const walletApi = {
  get: async () => {
    await ensureAuth();
    const res = await api.get("/wallet");
    return res.data.data as Wallet;
  },
  deposit: async (amount: number, reference?: string) => {
    await ensureAuth();
    const res = await api.post("/wallet/deposit", { amount, reference });
    return res.data.data as Wallet;
  },
  withdraw: async (amount: number, reference?: string) => {
    await ensureAuth();
    const res = await api.post("/wallet/withdraw", { amount, reference });
    return res.data.data as Wallet;
  },
  transactions: async (page = 1, limit = 10) => {
    await ensureAuth();
    const res = await api.get("/wallet/transactions", { params: { page, limit } });
    return res.data.data;
  },
};

export const gameApi = {
  current: async () => {
    await ensureAuth();
    const res = await api.get("/games/keno/current");
    return res.data.data as CurrentRound;
  },
  play: async (selectedNumbers: number[], betAmount: number, mode: "INSTANT" | "CLASSIC" = "INSTANT", clientSeed?: string) => {
    await ensureAuth();
    const res = await api.post("/games/keno/play", {
      mode,
      bet: betAmount,
      selectedNumbers,
      ...(clientSeed && { clientSeed }),
    });
    return res.data.data as PlayResponse;
  },
  settledGames: async () => {
    await ensureAuth();
    const res = await api.get("/games/keno/settled-games");
    return res.data.data;
  },
  quickPick: async (count = 5) => {
    const res = await api.get("/games/keno/quick-pick", { params: { count } });
    return res.data.data.numbers as number[];
  },
  history: async (page = 1, limit = 10) => {
    await ensureAuth();
    const res = await api.get("/games/keno/history", { params: { page, limit } });
    return res.data.data;
  },
  result: async (id: string) => {
    await ensureAuth();
    const res = await api.get(`/games/keno/result/${id}`);
    return res.data.data;
  },
  provablyFair: async (gameId?: string) => {
    const res = await api.get("/games/keno/provably-fair", { params: { gameId } });
    return res.data.data as ProvablyFairInfo;
  },
  verify: async (serverSeed: string, clientSeed: string, nonce: number) => {
    const res = await api.get("/games/keno/provably-fair", {
      params: { serverSeed, clientSeed, nonce },
    });
    return res.data.data as { serverSeedHash: string; drawNumbers: number[] };
  },
};

export { adminApi } from "../features/admin/api";

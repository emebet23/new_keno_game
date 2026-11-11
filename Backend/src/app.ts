import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import walletRoutes from "./routes/wallet.route";
import gameRoutes from "./routes/game.routes";
import adminRoutes from "./routes/admin.routes";
import paymentWalletRoutes from "./payment/routes/wallet.routes";
import { errorHandler } from "./middleware/error.middleware";
import { LiveKenoEngine } from "./services/live-keno.service";

// Prevent BigInt serialization TypeError in JSON responses
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// === Live Keno Atlas V Endpoints ===
app.post("/gethash", (req, res) => {
  const { key, salt } = req.body || {};
  if (!key || !salt) {
    return res.status(400).json({ error: "Missing key or salt" });
  }
  const engine = LiveKenoEngine.getInstance();
  const hash = engine.verifyHash(String(key), String(salt));
  return res.json({ hash });
});

app.post("/mygamehistory", (req, res) => {
  const { player_id, token, page } = req.body || {};
  const userId = String(player_id || token || "demo_player");
  const pageNum = parseInt(page, 10) || 0;
  const engine = LiveKenoEngine.getInstance();
  const result = engine.getUserGameHistory(userId, pageNum);
  return res.json(result);
});

app.get("/", (_, res) => {
  res.json({
    name: "Keno Game API Engine",
    status: "running",
    version: "1.0.0",
    docs: {
      auth: "/auth/telegram",
      wallet: "/wallet",
      play: "/games/keno/play",
      current: "/games/keno/current",
      result: "/games/keno/result/:id",
      history: "/games/keno/history",
      provablyFair: "/games/keno/provably-fair",
      admin: "/admin/*",
    },
  });
});

app.use("/auth", authRoutes);
app.use("/", walletRoutes);
app.use("/", paymentWalletRoutes);
app.use("/games/keno", gameRoutes);
app.use("/admin", adminRoutes);

// Global Error Handler
app.use(errorHandler);

export default app;

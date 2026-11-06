import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import walletRoutes from "./routes/wallet.route";
import gameRoutes from "./routes/game.routes";
import adminRoutes from "./routes/admin.routes";
import paymentWalletRoutes from "./payment/routes/wallet.routes";
import { errorHandler } from "./middleware/error.middleware";

// Prevent BigInt serialization TypeError in JSON responses
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

const app = express();

app.use(cors());
app.use(express.json());

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

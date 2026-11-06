import dotenv from "dotenv";
dotenv.config();

import http from "http";
import app from "./app";
import { startGameScheduler } from "./scheduler/game.scheduler";
import { initSocket } from "./socket/socket";

const PORT = process.env.PORT || 5000;

const httpServer = http.createServer(app);

initSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port: http://localhost:${PORT}`);

  startGameScheduler();

  import("./bot/index").then(({ setupBot }) => {
    setupBot();
  }).catch((err) => {
    console.error("[Bot] Failed to initialize:", err?.message || err);
  });
});

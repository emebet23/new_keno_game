import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { rateLimiter } from "../middleware/rate-limiter.middleware";
import { GameController } from "../controllers/game.controller";

const router = Router();
const controller = new GameController();

router.post("/play", authenticate, rateLimiter(10, 5), controller.play);
router.get("/current", authenticate, controller.getCurrentDraw);
router.get("/result/:id", authenticate, controller.getResult);
router.get("/history", authenticate, controller.getHistory);
router.get("/provably-fair", authenticate, controller.getProvablyFair);
router.get("/settled-games", authenticate, controller.getSettledGames);
router.get("/quick-pick", controller.getQuickPick);
router.post("/settle", authenticate, controller.settle);

export default router;

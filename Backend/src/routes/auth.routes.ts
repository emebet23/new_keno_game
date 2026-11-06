import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";

const router = Router();

const controller = new AuthController();

router.post("/telegram", controller.telegramLogin);
router.post("/dev-login", controller.devLogin);

export default router;

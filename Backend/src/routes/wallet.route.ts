import { Router } from "express";
import { WalletController } from "../controllers/wallet.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();
const controller = new WalletController();

router.get("/wallet", authenticate, controller.getWallet);
router.get("/wallet/transactions", authenticate, controller.getTransactions);
router.post("/wallet/deposit", authenticate, controller.deposit);
router.post("/wallet/withdraw", authenticate, controller.withdraw);

export default router;

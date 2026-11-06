import { Router, Request, Response } from "express";
import { authenticateAdmin } from "../../middleware/auth.middleware";
import { PaymentService } from "../services/payment.service";

const router = Router();

router.get(
  "/deposits",
  authenticateAdmin,
  async (req: Request, res: Response) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const result = await PaymentService.getAllDeposits(page, limit);
      res.json({ success: true, ...result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

export default router;

import { Router, Request, Response } from "express";
import { authenticateAdmin } from "../../middleware/auth.middleware";
import { WithdrawalService } from "../services/withdrawal.service";

const router = Router();

router.get(
  "/withdrawals/pending",
  authenticateAdmin,
  async (_req: Request, res: Response) => {
    try {
      const withdrawals = await WithdrawalService.getPendingWithdrawals();
      res.json({ success: true, withdrawals });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

router.post(
  "/withdrawals/:withdrawalId/approve",
  authenticateAdmin,
  async (req: Request, res: Response) => {
    try {
      const withdrawalId = req.params.withdrawalId as string;
      const adminId = req.user!.userId;

      const result = await WithdrawalService.approveWithdrawal(withdrawalId, adminId);

      if (!result.success) {
        return res.status(400).json({ success: false, error: result.error });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

router.post(
  "/withdrawals/:withdrawalId/reject",
  authenticateAdmin,
  async (req: Request, res: Response) => {
    try {
      const withdrawalId = req.params.withdrawalId as string;
      const { reason } = req.body;
      const adminId = req.user!.userId;

      const result = await WithdrawalService.rejectWithdrawal(withdrawalId, adminId, reason);

      if (!result.success) {
        return res.status(400).json({ success: false, error: result.error });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

export default router;

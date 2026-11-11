"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const withdrawal_service_1 = require("../services/withdrawal.service");
const router = (0, express_1.Router)();
router.get("/withdrawals/pending", auth_middleware_1.authenticateAdmin, async (_req, res) => {
    try {
        const withdrawals = await withdrawal_service_1.WithdrawalService.getPendingWithdrawals();
        res.json({ success: true, withdrawals });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.post("/withdrawals/:withdrawalId/approve", auth_middleware_1.authenticateAdmin, async (req, res) => {
    try {
        const withdrawalId = req.params.withdrawalId;
        const adminId = req.user.userId;
        const result = await withdrawal_service_1.WithdrawalService.approveWithdrawal(withdrawalId, adminId);
        if (!result.success) {
            return res.status(400).json({ success: false, error: result.error });
        }
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.post("/withdrawals/:withdrawalId/reject", auth_middleware_1.authenticateAdmin, async (req, res) => {
    try {
        const withdrawalId = req.params.withdrawalId;
        const { reason } = req.body;
        const adminId = req.user.userId;
        const result = await withdrawal_service_1.WithdrawalService.rejectWithdrawal(withdrawalId, adminId, reason);
        if (!result.success) {
            return res.status(400).json({ success: false, error: result.error });
        }
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
exports.default = router;

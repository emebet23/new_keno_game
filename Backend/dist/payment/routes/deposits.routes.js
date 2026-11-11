"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const payment_service_1 = require("../services/payment.service");
const router = (0, express_1.Router)();
router.get("/deposits", auth_middleware_1.authenticateAdmin, async (req, res) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;
        const result = await payment_service_1.PaymentService.getAllDeposits(page, limit);
        res.json({ success: true, ...result });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
exports.default = router;

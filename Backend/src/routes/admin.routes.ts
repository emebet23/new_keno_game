import { Router } from "express";
import { AdminController } from "../controllers/admin.controller";
import { authenticateAdmin, authenticateSuperAdmin } from "../middleware/auth.middleware";

const router = Router();
const controller = new AdminController();

router.use(authenticateAdmin);

router.get("/settings", controller.getSettings);
router.put("/settings", controller.updateSettings);

router.get("/analytics", controller.getFinancialAnalytics);

router.get("/users", controller.getUsers);
router.patch("/users/:id/status", controller.updateUserStatus);
router.patch("/users/:id/role", authenticateSuperAdmin, controller.updateUserRole);

router.get("/reports", controller.getReports);

export default router;

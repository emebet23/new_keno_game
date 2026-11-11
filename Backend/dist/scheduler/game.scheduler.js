"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startGameScheduler = startGameScheduler;
const node_cron_1 = __importDefault(require("node-cron"));
const scheduler_service_1 = require("../services/scheduler.service");
const scheduler = new scheduler_service_1.SchedulerService();
function startGameScheduler() {
    node_cron_1.default.schedule("*/30 * * * * *", async () => {
        console.log("Running Keno scheduler...");
        try {
            await scheduler.run();
        }
        catch (error) {
            console.error("Scheduler error:", error);
        }
    });
}

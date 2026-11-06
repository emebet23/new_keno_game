import cron from "node-cron";
import { SchedulerService } from "../services/scheduler.service";

const scheduler = new SchedulerService();

export function startGameScheduler(): void {
  cron.schedule("*/30 * * * * *", async () => {
    console.log("Running Keno scheduler...");

    try {
      await scheduler.run();
    } catch (error) {
      console.error("Scheduler error:", error);
    }
  });
}

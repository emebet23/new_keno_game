"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayoutService = void 0;
const settings_repository_1 = require("../repositories/settings.repository");
class PayoutService {
    settingsRepository = new settings_repository_1.SettingsRepository();
    async getMultiplier(selectedCount, matchesCount) {
        const settings = await this.settingsRepository.getSettings();
        const table = settings.payoutTable || settings_repository_1.DEFAULT_PAYOUT_TABLE;
        const selectedRow = table[String(selectedCount)];
        if (!selectedRow)
            return 0;
        const multiplier = selectedRow[String(matchesCount)];
        return multiplier !== undefined ? Number(multiplier) : 0;
    }
    multiplierSync(selectedCount, matchesCount, customTable) {
        const table = customTable || settings_repository_1.DEFAULT_PAYOUT_TABLE;
        const selectedRow = table[String(selectedCount)];
        if (!selectedRow)
            return 0;
        const multiplier = selectedRow[String(matchesCount)];
        return multiplier !== undefined ? Number(multiplier) : 0;
    }
}
exports.PayoutService = PayoutService;

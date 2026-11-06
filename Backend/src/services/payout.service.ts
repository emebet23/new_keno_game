import { SettingsRepository, DEFAULT_PAYOUT_TABLE, PayoutTable } from "../repositories/settings.repository";

export class PayoutService {
  private settingsRepository = new SettingsRepository();

  async getMultiplier(selectedCount: number, matchesCount: number): Promise<number> {
    const settings = await this.settingsRepository.getSettings();
    const table = (settings.payoutTable as unknown as PayoutTable) || DEFAULT_PAYOUT_TABLE;

    const selectedRow = table[String(selectedCount)];
    if (!selectedRow) return 0;

    const multiplier = selectedRow[String(matchesCount)];
    return multiplier !== undefined ? Number(multiplier) : 0;
  }

  multiplierSync(selectedCount: number, matchesCount: number, customTable?: PayoutTable): number {
    const table: PayoutTable = customTable || DEFAULT_PAYOUT_TABLE;
    const selectedRow = table[String(selectedCount)];
    if (!selectedRow) return 0;

    const multiplier = selectedRow[String(matchesCount)];
    return multiplier !== undefined ? Number(multiplier) : 0;
  }
}

export class WalletNotFoundError extends Error {
  constructor() {
    super("Wallet not found");
  }
}

export class InsufficientBalanceError extends Error {
  constructor() {
    super("Insufficient balance");
  }
}

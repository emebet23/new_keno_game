import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { WalletNotFoundError, InsufficientBalanceError } from "../utils/errors";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error("[ErrorHandler]", err);

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: "Validation Error",
      errors: err.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  if (err instanceof WalletNotFoundError) {
    return res.status(404).json({
      success: false,
      message: err.message,
    });
  }

  if (err instanceof InsufficientBalanceError) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  if (err instanceof Error) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  return res.status(500).json({
    success: false,
    message: "Internal Server Error",
  });
}

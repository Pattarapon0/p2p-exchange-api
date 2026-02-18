import { AppError } from "./errors.js";

export function toPositiveAmount(value: number, fieldName = "amount"): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new AppError(400, `${fieldName} must be a positive number`);
  }
  return Number(value.toFixed(8));
}

export function toAmountOrZero(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new AppError(400, "amount must be >= 0");
  }
  return Number(value.toFixed(8));
}

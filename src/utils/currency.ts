export function formatPKR(amount: number): string {
  if (!Number.isFinite(amount)) return "PKR --";
  return `PKR ${amount.toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

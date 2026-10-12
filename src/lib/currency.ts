export function convertPrice(amountPln: number, rate: number): number {
  return Math.round((amountPln * rate + Number.EPSILON) * 100) / 100;
}

export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount).replace(/\u00a0/g, " ");
}

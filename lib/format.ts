/** Country code to flag emoji ("JP" -> 🇯🇵). */
export function flag(countryCode: string): string {
  return countryCode
    .toUpperCase()
    .replace(/[A-Z]/g, (c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65));
}

/** A stable colour per city, used for card headers instead of a photo. */
export function cityGradient(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `linear-gradient(135deg, hsl(${h} 55% 38%), hsl(${(h + 40) % 360} 60% 52%))`;
}

export function money(n: number, currency: "EUR" | "USD"): string {
  return new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

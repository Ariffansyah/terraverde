export const SDG_TARGETS = ["SDG 12", "SDG 13", "SDG 15"];

// Commonly cited average: one mature tree absorbs ~21 kg CO2 per year.
const KG_CO2_PER_TREE_YEAR = 21;

const idr = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

export const formatIDR = (amount: number) => idr.format(amount);
export const formatKg = (kg: number) => `${kg.toLocaleString("id-ID", { maximumFractionDigits: 1 })} kg`;
export const treesEquivalent = (kgCo2: number) => Math.round((kgCo2 / KG_CO2_PER_TREE_YEAR) * 10) / 10;

export const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

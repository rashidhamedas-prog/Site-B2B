export type ColorStockRow = { wholesale?: number; retail?: number };
export type ColorStockPlan = Map<string, ColorStockRow>;

export type ColorStockInput = {
  wholesaleStock?: number;
  retailStock?: number;
  stock?: number;
  sizes?: Array<{
    size: string;
    wholesaleStock?: number;
    retailStock?: number;
    stock?: number;
  }>;
};

function absInt(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Math.max(0, Math.floor(Number(value)));
  return Number.isFinite(n) ? n : Number.NaN;
}

export function pickVariantStocks(input: {
  wholesaleStock?: number;
  retailStock?: number;
  stock?: number;
}): { wholesale?: number; retail?: number } {
  const wholesale = absInt(input.wholesaleStock);
  const retail = absInt(input.retailStock);
  if (wholesale !== undefined && Number.isNaN(wholesale)) {
    throw new Error('INVALID_WHOLESALE_STOCK');
  }
  if (retail !== undefined && Number.isNaN(retail)) {
    throw new Error('INVALID_RETAIL_STOCK');
  }
  return { wholesale, retail };
}

export function parseColorStockPlan(data: ColorStockInput, productSizes: string[]): ColorStockPlan {
  const perSize: ColorStockPlan = new Map();
  if (Array.isArray(data.sizes) && data.sizes.length > 0) {
    for (const row of data.sizes) {
      const label = String(row.size ?? '').trim();
      if (!label) continue;
      const stocks = pickVariantStocks(row);
      perSize.set(label, stocks);
    }
    return perSize;
  }
  const stocks = pickVariantStocks(data);
  for (let i = 0; i < productSizes.length; i++) {
    perSize.set(productSizes[i], {
      wholesale: stocks.wholesale === undefined ? undefined : i === 0 ? stocks.wholesale : 0,
      retail: stocks.retail === undefined ? undefined : i === 0 ? stocks.retail : 0,
    });
  }
  return perSize;
}

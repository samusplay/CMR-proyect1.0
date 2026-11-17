// Una línea ya con precio: lo único que necesita el cálculo
export interface PricedLine {
  quantity: number;
  unitPrice: number; // pesos COP, entero
}

export interface OfferTotals {
  subtotal: number; // suma de los totales de las líneas
  aiu: number; // subtotal × porcentaje de AIU
  iva: number; // IVA sobre (subtotal + AIU)
  total: number; // subtotal + AIU + IVA
}

// Total de una línea, en pesos enteros. El PDF muestra este mismo número, así que las líneas suman exacto
export const calculateLineTotal = (line: PricedLine): number => Math.round(line.quantity * line.unitPrice);

// Los porcentajes son fracciones: 0.15 = 15 %.
// IMPORTANTE: aquí se asume que el IVA se aplica sobre (subtotal + AIU). Si contabilidad define otra base
// (por ejemplo, IVA solo sobre la utilidad), este es el único lugar que hay que cambiar.
export function calculateOfferTotals(
  lines: PricedLine[],
  aiuPercentage: number,
  ivaPercentage: number,
): OfferTotals {
  const subtotal = lines.reduce((sum, line) => sum + calculateLineTotal(line), 0);
  const aiu = Math.round(subtotal * aiuPercentage);
  const iva = Math.round((subtotal + aiu) * ivaPercentage);

  return { subtotal, aiu, iva, total: subtotal + aiu + iva };
}

// Una oferta con alguna línea en precio 0 no debe enviarse al cliente
export const hasUnpricedLines = (lines: PricedLine[]): boolean => lines.some((line) => line.unitPrice <= 0);
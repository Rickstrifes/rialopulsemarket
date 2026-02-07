import * as anchor from "@coral-xyz/anchor";

export const formatPythPrice = (price: anchor.BN | null | undefined): string => {
    if (!price) return "-";
    const val = price.toNumber();
    const humanVal = val * Math.pow(10, -8);
    return formatCurrency(humanVal);
};

export const formatCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return "-";

    const isLarge = value >= 50.0;

    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: isLarge ? 2 : 4,
        maximumFractionDigits: isLarge ? 2 : 4,
    }).format(value);
};

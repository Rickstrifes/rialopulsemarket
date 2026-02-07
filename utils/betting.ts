import * as anchor from "@coral-xyz/anchor";

/**
 * USDC has 6 decimal places
 */
export const USDC_DECIMALS = 6;

/**
 * Multiplier to convert USDC float to u64 integer (10^6)
 */
export const USDC_MULTIPLIER = 1_000_000;

/**
 * Preset bet amounts in USDC
 */
export const BET_PRESETS = [5, 10, 25] as const;

/**
 * Regex pattern for valid bet input: only positive numbers with optional single decimal
 * Allows: "5", "10.5", "0.123", ".5", ""
 * Blocks: "-5", "5e10", "abc", "5-", "5.5.5"
 */
export const BET_INPUT_REGEX = /^\d*\.?\d*$/;

/**
 * Validates if the input string is a valid bet amount format.
 * Only allows positive numbers with optional single decimal point.
 * 
 * @param value - The input string to validate
 * @returns true if the format is valid
 */
export function isValidBetFormat(value: string): boolean {
    return BET_INPUT_REGEX.test(value);
}

/**
 * Checks if the bet amount is valid for placing a bet.
 * Must be a valid format AND parse to a positive number.
 * 
 * @param value - The input string to validate
 * @returns true if the bet can be placed
 */
export function isValidBetAmount(value: string): boolean {
    if (!isValidBetFormat(value)) return false;
    if (value === "" || value === ".") return false;

    const parsed = parseFloat(value);
    return !isNaN(parsed) && parsed > 0;
}

/**
 * Converts a USDC amount string to a BN value scaled for the smart contract.
 * USDC has 6 decimals, so 5.5 USDC becomes 5500000.
 * 
 * @param input - The bet amount as a string (e.g., "5.5")
 * @returns anchor.BN scaled to 6 decimals, or null if invalid
 */
export function parseUsdcAmount(input: string): anchor.BN | null {
    if (!isValidBetAmount(input)) return null;

    const floatValue = parseFloat(input);
    const scaledValue = Math.round(floatValue * USDC_MULTIPLIER);

    return new anchor.BN(scaledValue);
}

/**
 * Formats a scaled USDC amount (u64) back to display format.
 * 
 * @param amount - The scaled amount (e.g., 5500000)
 * @returns Formatted string (e.g., "5.50")
 */
export function formatUsdcAmount(amount: number | anchor.BN): string {
    const value = typeof amount === "number" ? amount : amount.toNumber();
    return (value / USDC_MULTIPLIER).toFixed(2);
}

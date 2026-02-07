/**
 * Anchor Error Parsing Utility
 * Converts raw Anchor error messages into user-friendly messages
 */

export interface ParsedError {
    code: number;
    name: string;
    message: string;
}

/**
 * Error code to user-friendly message mapping
 * Based on the pulse_market program errors
 */
const ERROR_MESSAGES: Record<number, { name: string; message: string }> = {
    6000: {
        name: "MarketEnded",
        message: "This market has already ended. You can no longer place bets."
    },
    6001: {
        name: "WrongPosition",
        message: "You've already bet on the opposite position. You can only add to your existing bet direction."
    },
    6002: {
        name: "MarketNotEndedYet",
        message: "The market hasn't ended yet. Please wait until the timer expires."
    },
    6003: {
        name: "AlreadyResolved",
        message: "This market has already been resolved."
    },
    6004: {
        name: "MarketNotResolved",
        message: "The market hasn't been resolved yet. Please wait."
    },
    6005: {
        name: "YouLost",
        message: "Sorry, you lost this bet. Better luck next time!"
    },
    6006: {
        name: "AlreadyClaimed",
        message: "You've already claimed your rewards for this market."
    },
    6007: {
        name: "FaucetCooldown",
        message: "Faucet is on cooldown. Please wait 24 hours between claims."
    },
    6008: {
        name: "InvalidPriceFeed",
        message: "Price feed error. Please try again later."
    },
    6009: {
        name: "Unauthorized",
        message: "Unauthorized action. Only admins can perform this."
    },
    6010: {
        name: "InputPriceRequired",
        message: "Manual price input is required for Devnet mode."
    },
    6011: {
        name: "MarketTimeInPast",
        message: "Market end time must be in the future."
    },
    6012: {
        name: "PriceTooOld",
        message: "Price data is stale. Please try again."
    }
};

/**
 * Parses an Anchor error and returns a user-friendly message
 * 
 * @param error - The error object from a failed transaction
 * @returns ParsedError with code, name, and friendly message
 */
export function parseAnchorError(error: any): ParsedError {
    // Default fallback
    const defaultError: ParsedError = {
        code: -1,
        name: "Unknown",
        message: "An unexpected error occurred. Please try again."
    };

    if (!error) return defaultError;

    // Try to extract error code from different error formats
    let errorCode: number | null = null;

    // Format 1: error.error.errorCode.number (Anchor v0.29+)
    if (error?.error?.errorCode?.number) {
        errorCode = error.error.errorCode.number;
    }
    // Format 2: Direct logs parsing
    else if (error?.logs) {
        const errorLog = error.logs.find((log: string) =>
            log.includes("Error Code:") || log.includes("Error Number:")
        );
        if (errorLog) {
            const codeMatch = errorLog.match(/Error Number: (\d+)/);
            if (codeMatch) {
                errorCode = parseInt(codeMatch[1], 10);
            }
        }
    }
    // Format 3: error.message contains the error info
    else if (error?.message) {
        const codeMatch = error.message.match(/Error Code: (\w+).*Error Number: (\d+)/);
        if (codeMatch) {
            errorCode = parseInt(codeMatch[2], 10);
        }
        // Also try just the number
        const numMatch = error.message.match(/custom program error: 0x([0-9a-fA-F]+)/);
        if (numMatch) {
            errorCode = parseInt(numMatch[1], 16);
        }
    }
    // Format 4: InstructionError format
    else if (error?.InstructionError) {
        const instructionError = error.InstructionError[1];
        if (instructionError?.Custom !== undefined) {
            errorCode = instructionError.Custom;
        }
    }

    // Look up the friendly message
    if (errorCode !== null && ERROR_MESSAGES[errorCode]) {
        return {
            code: errorCode,
            ...ERROR_MESSAGES[errorCode]
        };
    }

    // If we found a code but don't have a mapping
    if (errorCode !== null) {
        return {
            code: errorCode,
            name: "ProgramError",
            message: `Transaction failed with error code ${errorCode}.`
        };
    }

    // Check for common wallet/network errors
    if (error?.message) {
        if (error.message.includes("User rejected")) {
            return {
                code: -2,
                name: "UserRejected",
                message: "Transaction was cancelled."
            };
        }
        if (error.message.includes("insufficient funds") || error.message.includes("Insufficient")) {
            return {
                code: -3,
                name: "InsufficientFunds",
                message: "Insufficient funds to complete this transaction."
            };
        }
        if (error.message.includes("blockhash not found")) {
            return {
                code: -4,
                name: "BlockhashNotFound",
                message: "Network congestion. Please try again."
            };
        }
    }

    return defaultError;
}

/**
 * Gets just the user-friendly message from an error
 * 
 * @param error - The error object from a failed transaction
 * @returns User-friendly error message string
 */
export function getErrorMessage(error: any): string {
    return parseAnchorError(error).message;
}

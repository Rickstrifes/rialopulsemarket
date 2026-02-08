/**
 * Legacy UserBet Decoder
 * 
 * This utility handles backward compatibility for old UserBet accounts
 * that have a different on-chain structure:
 * 
 * OLD STRUCTURE (81 bytes):
 * - discriminator: 8 bytes
 * - user: 32 bytes (Pubkey)
 * - market: 32 bytes (Pubkey)
 * - amount: 8 bytes (u64)
 * - is_up: 1 byte (bool)
 * 
 * NEW STRUCTURE (89 bytes):
 * - discriminator: 8 bytes
 * - user: 32 bytes (Pubkey)
 * - market: 32 bytes (Pubkey)
 * - amount_up: 8 bytes (u64)
 * - amount_down: 8 bytes (u64)
 * - claimed: 1 byte (bool)
 */

import { PublicKey, Connection } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
// @ts-ignore - bs58 doesn't have types but works fine
import bs58 from "bs58";

// UserBet discriminator (same for both old and new)
// Pre-encoded to base58 to avoid Buffer issues in browser
const USER_BET_DISCRIMINATOR_BS58 = bs58.encode(new Uint8Array([180, 131, 8, 241, 60, 243, 46, 63]));
const USER_BET_DISCRIMINATOR = new Uint8Array([180, 131, 8, 241, 60, 243, 46, 63]);

// Account sizes
const OLD_USER_BET_SIZE = 8 + 32 + 32 + 8 + 1; // 81 bytes
const NEW_USER_BET_SIZE = 8 + 32 + 32 + 8 + 8 + 1; // 89 bytes

export interface NormalizedUserBet {
    publicKey: PublicKey;
    account: {
        user: PublicKey;
        market: PublicKey;
        amountUp: anchor.BN;
        amountDown: anchor.BN;
        claimed: boolean;
        isLegacy?: boolean; // Flag to identify legacy accounts
    };
}

/**
 * Decode raw account data into normalized UserBet format
 * Handles both old (amount + is_up) and new (amount_up + amount_down) structures
 */
function decodeUserBetData(pubkey: PublicKey, data: Uint8Array): NormalizedUserBet | null {
    // Check discriminator (compare first 8 bytes)
    const dataDiscriminator = data.slice(0, 8);
    let discriminatorMatch = true;
    for (let i = 0; i < 8; i++) {
        if (dataDiscriminator[i] !== USER_BET_DISCRIMINATOR[i]) {
            discriminatorMatch = false;
            break;
        }
    }
    if (!discriminatorMatch) {
        return null;
    }

    const user = new PublicKey(data.slice(8, 40));
    const market = new PublicKey(data.slice(40, 72));

    // Determine format based on account data length
    // CRITICAL FIX: Check NEW format first because 89 bytes could be mistaken for 81+8 bytes
    if (data.length >= NEW_USER_BET_SIZE) {
        // NEW FORMAT: amount_up (u64) + amount_down (u64) + claimed (bool)
        const amountUp = new anchor.BN(data.slice(72, 80), "le");
        const amountDown = new anchor.BN(data.slice(80, 88), "le");
        const claimed = data[88] === 1;

        return {
            publicKey: pubkey,
            account: {
                user,
                market,
                amountUp,
                amountDown,
                claimed,
                isLegacy: false,
            },
        };
    } else if (data.length === OLD_USER_BET_SIZE || data.length === OLD_USER_BET_SIZE + 8) {
        // OLD FORMAT: amount (u64) + is_up (bool)
        // Only fall back to this if size is explicitly old (81) or 81+8 but LESS than new size (impossible if 81+8=89)
        // Actually, 81+8=89, so we MUST ensure we fell through the first check.

        const amount = new anchor.BN(data.slice(72, 80), "le");
        const isUp = data[80] === 1;

        // Convert old format to new normalized format
        return {
            publicKey: pubkey,
            account: {
                user,
                market,
                amountUp: isUp ? amount : new anchor.BN(0),
                amountDown: isUp ? new anchor.BN(0) : amount,
                claimed: false, // Old format didn't have claimed field, assume unclaimed
                isLegacy: true,
            },
        };
    }

    console.warn(`Unknown UserBet format, size: ${data.length}`);
    return null;
}

/**
 * Fetch all UserBet accounts for a user with backward compatibility
 * This bypasses the IDL decoder and manually parses the raw data
 */
export async function fetchUserBetsWithLegacySupport(
    connection: Connection,
    programId: PublicKey,
    userPubkey: PublicKey
): Promise<NormalizedUserBet[]> {
    try {
        // Fetch all accounts owned by the program with UserBet discriminator
        // Filter by user pubkey at offset 8 (after discriminator)
        const accounts = await connection.getProgramAccounts(programId, {
            filters: [
                {
                    memcmp: {
                        offset: 0,
                        bytes: USER_BET_DISCRIMINATOR_BS58,
                    },
                },
                {
                    memcmp: {
                        offset: 8, // After discriminator, user pubkey starts
                        bytes: userPubkey.toBase58(),
                    },
                },
            ],
        });

        const results: NormalizedUserBet[] = [];

        for (const { pubkey, account } of accounts) {
            const decoded = decodeUserBetData(pubkey, account.data);
            if (decoded) {
                results.push(decoded);
            }
        }

        return results;
    } catch (error) {
        console.error("Error fetching user bets with legacy support:", error);
        return [];
    }
}

/**
 * Try to decode a single UserBet account with backward compatibility
 */
export async function fetchSingleUserBetWithLegacySupport(
    connection: Connection,
    userBetPubkey: PublicKey
): Promise<NormalizedUserBet | null> {
    try {
        const accountInfo = await connection.getAccountInfo(userBetPubkey);
        if (!accountInfo) return null;

        return decodeUserBetData(userBetPubkey, accountInfo.data);
    } catch (error) {
        console.error("Error fetching single user bet:", error);
        return null;
    }
}

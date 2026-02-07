import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey("4TpEeWz1j7KKvYVWF2XaVhjKiEDcyYysGQfcaqRamJwp");
export const USDC_MINT = new PublicKey("6fkqCRSfs7Zo2q1hTuBATcUmpt5Wvk5mvNaXWG5NLcpx");
export const ORACLE_PUBKEY = new PublicKey("J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix");

export const HELIUS_RPC_URL = process.env.NEXT_PUBLIC_HELIUS_RPC || "https://api.devnet.solana.com";

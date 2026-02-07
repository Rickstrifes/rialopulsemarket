import { Program, AnchorProvider, Idl, setProvider } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import { PROGRAM_ID } from "./constants";
import idl from "./idl.json";

export const getProgram = (connection: Connection, wallet: AnchorWallet) => {
    const provider = new AnchorProvider(connection, wallet, {
        commitment: "confirmed",
    });
    setProvider(provider);

    // Anchor might expect the IDL to be passed differently or IDL format is not perfectly matching Idl type
    // We cast to any to suppress TS error, but the runtime error suggests structure might be issue
    // Ensure we are passing the JSON object.
    return new Program(idl as any, provider);
};

export const getProvider = (connection: Connection, wallet: AnchorWallet) => {
    return new AnchorProvider(connection, wallet, {
        commitment: "confirmed",
    });
};

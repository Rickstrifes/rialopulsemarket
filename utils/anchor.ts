import { Program, AnchorProvider, setProvider } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import idl from "./idl.json";

// For Anchor 0.32+, the IDL contains the program address directly
export const getProgram = (connection: Connection, wallet: AnchorWallet) => {
    const provider = new AnchorProvider(connection, wallet, {
        commitment: "confirmed",
    });
    setProvider(provider);

    // Anchor 0.32+ IDL format includes address directly, no need to pass PROGRAM_ID separately
    return new Program(idl as any, provider);
};

export const getProvider = (connection: Connection, wallet: AnchorWallet) => {
    return new AnchorProvider(connection, wallet, {
        commitment: "confirmed",
    });
};

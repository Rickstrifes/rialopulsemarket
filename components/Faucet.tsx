"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { getProgram } from "@/utils/anchor";
import { USDC_MINT } from "@/utils/constants";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";

import toast from "react-hot-toast";

export default function Faucet() {
    const { connection } = useConnection();
    const wallet = useWallet();
    const [loading, setLoading] = useState(false);
    // status state removed as it is now handled by toast

    const claimFaucet = async () => {
        if (!wallet.publicKey) {
            toast.error("Please connect your wallet first.");
            return;
        }

        setLoading(true);
        const toastId = toast.loading("Processing claim...");

        try {
            // @ts-ignore
            const program = getProgram(connection, wallet) as any;

            const [faucetState] = PublicKey.findProgramAddressSync(
                [Buffer.from("faucet"), wallet.publicKey.toBuffer()],
                program.programId
            );

            const [mintAuthority] = PublicKey.findProgramAddressSync(
                [Buffer.from("minter")],
                program.programId
            );

            const userTokenAccount = await getAssociatedTokenAddress(
                USDC_MINT,
                wallet.publicKey
            );

            // Create instructions array
            const instructions = [];

            // Check if ATA exists
            const accountInfo = await connection.getAccountInfo(userTokenAccount);
            if (!accountInfo) {
                toast("Creating USDC Account...", { icon: 'ℹ️' });
                instructions.push(
                    createAssociatedTokenAccountInstruction(
                        wallet.publicKey,
                        userTokenAccount,
                        wallet.publicKey,
                        USDC_MINT
                    )
                );
            }

            const tx = await program.methods.claimFaucet()
                .accounts({
                    faucetState,
                    tokenMint: USDC_MINT,
                    mintAuthority,
                    userTokenAccount,
                    user: wallet.publicKey,
                    systemProgram: SystemProgram.programId,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .preInstructions(instructions)
                .rpc();

            console.log("Tx signature:", tx);
            toast.success("20 USDC received successfully.", { id: toastId });
        } catch (error: any) {
            const msg = error.message || error.toString();

            if (msg.includes("FaucetCooldown") || msg.includes("6007")) {
                console.warn("Faucet Cooldown hit:", msg); // Warn instead of Error to avoid Next.js overlay
                toast.error("Faucet cooldown active. Please wait 24 hours.", { id: toastId });
            } else {
                console.error("Faucet error:", error); // Real error
                toast.error("Transaction failed.", { id: toastId });
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative">
            <button
                onClick={claimFaucet}
                disabled={!wallet.publicKey || loading}
                className="flex items-center gap-2 py-2 px-4 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 text-blue-400 font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm whitespace-nowrap"
            >
                {loading ? (
                    <>
                        <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                        Claiming...
                    </>
                ) : (
                    <>
                        <span>💧</span> Claim 20 USDC
                    </>
                )}
            </button>
        </div>
    );
}

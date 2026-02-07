"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";
import LivePriceTicker from "./LivePriceTicker";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { USDC_MINT } from "@/utils/constants";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";
import { formatCurrency } from "@/utils/formatting";
import Faucet from "./Faucet";

export default function Navbar() {
    const { connection } = useConnection();
    const { publicKey } = useWallet();
    const [balance, setBalance] = useState<number | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!publicKey) {
            setBalance(null);
            return;
        }

        const fetchBalance = async () => {
            try {
                // Fetch USDC Balance
                const userAta = await getAssociatedTokenAddress(USDC_MINT, publicKey);
                try {
                    const account = await getAccount(connection, userAta);
                    setBalance(Number(account.amount) / 1_000_000); // 6 decimals for USDC
                } catch (e) {
                    console.log("No USDC account found (Detail):", e);
                    setBalance(0);
                }
            } catch (error) {
                console.error("Error fetching balance:", error);
            }
        };

        fetchBalance();
        const intervalId = setInterval(fetchBalance, 10000);
        return () => clearInterval(intervalId);
    }, [publicKey, connection]);

    return (
        <nav className="flex justify-between items-center p-4 border-b border-primary/20 backdrop-blur-md sticky top-0 z-50 bg-black/20 h-20">
            <div className="flex items-center gap-4 w-1/3">
                <div className="text-2xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent neon-text shrink-0">
                    PULSE
                </div>
                <div className="h-8 w-[1px] bg-white/10 shrink-0" />
                <div className="hidden md:block w-full max-w-[200px] lg:max-w-[300px] overflow-hidden mask-linear-fade">
                    <LivePriceTicker />
                </div>
            </div>

            {/* Center: Tagline */}
            <div className="absolute left-1/2 transform -translate-x-1/2 hidden md:block">
                <span className="text-sm md:text-base uppercase tracking-[0.2em] font-bold text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-purple-600 drop-shadow-[0_0_10px_rgba(217,70,239,0.5)]">
                    Predict The Future
                </span>
            </div>

            <div className="flex items-center space-x-4">
                <div className="hidden md:block">
                    <Faucet />
                </div>

                {publicKey && (
                    <div className="hidden md:flex flex-col items-end text-sm">
                        <span className="text-gray-400 text-[10px] uppercase">Balance</span>
                        <span className="font-mono font-bold text-secondary">
                            {balance !== null ? `${formatCurrency(balance)}` : "Loading..."}
                        </span>
                    </div>
                )}
                {mounted && (
                    <WalletMultiButton className="!bg-primary/20 !text-primary !border !border-primary/50 hover:!bg-primary/40 transition-all rounded-lg !h-10 !px-4 !text-sm" />
                )}
            </div>
        </nav>
    );
}

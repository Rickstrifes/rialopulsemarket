"use client";

import { UnifiedWalletButton } from "@jup-ag/wallet-adapter";
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
        <>
        
        <nav className="flex justify-between items-center p-4 border-b border-primary/20 backdrop-blur-md sticky top-0 z-50 bg-black/20 h-20">
            <div className="flex items-center gap-4 w-1/3">
                <div className="text-2xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent neon-text shrink-0">
                    PULSE
                </div>
                <div className="h-8 w-[1px] bg-white/10 shrink-0" />
            </div>

            {/* Center: Tagline */}
           <div className="max-w-5xl my-2 mx-auto px-4">
            <LivePriceTicker />
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
                    <UnifiedWalletButton />
                )}
            </div>
        </nav>
        </> 
    );
}

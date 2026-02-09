"use client";

import { UnifiedWalletButton, useConnection, useWallet } from "@jup-ag/wallet-adapter";
import { useEffect, useState } from "react";

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
        const timer = setTimeout(() => setMounted(true), 0);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!publicKey) {
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
        
        <nav className="flex justify-between items-center p-4 border-b border-border backdrop-blur-md sticky top-0 z-50 bg-background/80 text-foreground">
            <div className="flex items-center gap-4 w-1/3">
                <div className="text-2xl font-bold tracking-tighter text-foreground shrink-0">
                    PULSE
                </div>
                <div className="h-8 w-px bg-border shrink-0" />
            </div>

            {/* Center: Tagline */}
            <div className="flex items-center space-x-4">
                <div className="hidden md:block">
                    <Faucet />
                </div>
                {publicKey && (
                    <div className="hidden md:flex flex-col items-end text-sm">
                        <span className="text-gray-400 text-[10px] uppercase">Balance</span>
                        <span className="font-mono font-bold text-foreground">
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

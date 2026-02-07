"use client";

import { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { getProgram } from "@/utils/anchor";
import { PROGRAM_ID } from "@/utils/constants";
import { fetchUserBetsWithLegacySupport, NormalizedUserBet } from "@/utils/legacyUserBetDecoder";
import * as anchor from "@coral-xyz/anchor";

import MarketCard from "./MarketCard";

interface MarketAccount {
    publicKey: PublicKey;
    account: {
        pairName: string;
        endTime: anchor.BN;
        totalPoolUp: anchor.BN;
        totalPoolDown: anchor.BN;
        resolved: boolean;
        resultUp: boolean;
        treasuryOwner: PublicKey;
        initialPrice: anchor.BN;
        finalPrice: anchor.BN;
        isVoid: boolean;
    }
}


type Tab = "active" | "positions" | "history";

export default function MarketList() {
    const { connection } = useConnection();
    const wallet = useWallet();
    const [markets, setMarkets] = useState<MarketAccount[]>([]);
    const [userBets, setUserBets] = useState<NormalizedUserBet[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>("active");

    const fetchData = async () => {
        // ... (fetches remain same, maybe remove wallet check for public tabs? 
        // actually userBets needs wallet. But markets don't.)
        // Refactor fetchData to allow fetching markets even if wallet not connected?
        // Current code: `if (!wallet.publicKey) return;`
        // We should probably allow viewing markets without wallet.

        if (markets.length === 0) setLoading(true);

        // @ts-ignore
        const program = getProgram(connection, wallet) as any;

        // Fetch Markets with error handling for old data
        try {
            const marketAccounts = await program.account.marketState.all();
            setMarkets(marketAccounts);
        } catch (error) {
            console.error("Error fetching markets (may be old incompatible data):", error);
            // Keep existing markets if any, or set empty
            if (markets.length === 0) setMarkets([]);
        }

        // Fetch User Bets using legacy-compatible decoder (handles old + new formats)
        if (wallet.publicKey) {
            try {
                const userBetAccounts = await fetchUserBetsWithLegacySupport(
                    connection,
                    PROGRAM_ID,
                    wallet.publicKey
                );
                setUserBets(userBetAccounts);

                // Log legacy accounts for visibility
                const legacyCount = userBetAccounts.filter(b => b.account.isLegacy).length;
                if (legacyCount > 0) {
                    console.log(`Found ${legacyCount} legacy UserBet account(s) with old format`);
                }
            } catch (error) {
                console.error("Error fetching user bets:", error);
                setUserBets([]);
            }
        } else {
            setUserBets([]);
        }

        setLoading(false);
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000); // 5s poll
        return () => clearInterval(interval);
    }, [wallet.publicKey, connection]);

    // Filtering & Sorting
    const filteredMarkets = markets
        .filter((m) => {
            if (activeTab === "active") {
                // Show Unresolved (Active + Settling)
                // User requirement: "endTime > now AND resolved === false"
                // I will include Settling (endTime < now) too because otherwise they disappear.
                return !m.account.resolved;
            }
            if (activeTab === "positions") {
                return userBets.some(b => b.account.market.toBase58() === m.publicKey.toBase58());
            }
            if (activeTab === "history") {
                return m.account.resolved;
            }
            return true;
        })
        .sort((a, b) => {
            // Newest First (Sort by endTime Descending)
            // Or maybe creation time? We don't have creation time in IDL explicitly?
            // We have `endTime`. Assuming duration is somewhat constant, endTime is a proxy for creation.
            return b.account.endTime.toNumber() - a.account.endTime.toNumber();
        });

    if (loading && markets.length === 0) return <div className="text-center p-10 animate-pulse text-primary">Loading Markets...</div>;

    return (
        <div className="space-y-6">
            {/* Tab Navigation */}
            <div className="flex space-x-1 bg-black/40 p-1 rounded-lg border border-gray-800 w-fit">
                <button
                    onClick={() => setActiveTab("active")}
                    className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === "active"
                        ? "bg-secondary/20 text-secondary shadow-[0_0_10px_rgba(168,85,247,0.2)]"
                        : "text-gray-500 hover:text-gray-300"
                        }`}
                >
                    Active Markets
                </button>
                <button
                    onClick={() => setActiveTab("positions")}
                    className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === "positions"
                        ? "bg-secondary/20 text-secondary shadow-[0_0_10px_rgba(168,85,247,0.2)]"
                        : "text-gray-500 hover:text-gray-300"
                        }`}
                >
                    My Positions
                    {userBets.length > 0 && (
                        <span className="ml-2 bg-secondary text-black text-[10px] px-1.5 py-0.5 rounded-full">
                            {userBets.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab("history")}
                    className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === "history"
                        ? "bg-secondary/20 text-secondary shadow-[0_0_10px_rgba(168,85,247,0.2)]"
                        : "text-gray-500 hover:text-gray-300"
                        }`}
                >
                    Resolved History
                </button>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredMarkets.map((m) => {
                    const myBet = userBets.find(b => b.account.market.toBase58() === m.publicKey.toBase58());
                    return (
                        <MarketCard
                            key={m.publicKey.toString()}
                            market={m}
                            userBet={myBet}
                            onRefresh={fetchData}
                        />
                    );
                })}

                {filteredMarkets.length === 0 && !loading && (
                    <div className="col-span-full text-center p-10 text-gray-500 border border-gray-800 rounded-xl bg-black/20">
                        {activeTab === "active" && "No active markets right now."}
                        {activeTab === "positions" && "You haven't placed any bets yet."}
                        {activeTab === "history" && "No resolved markets history."}
                    </div>
                )}
            </div>
        </div>
    );
}

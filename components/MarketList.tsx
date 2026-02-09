"use client";

import { useEffect, useState, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { getProgram } from "@/utils/anchor";
import { PROGRAM_ID } from "@/utils/constants";
import { fetchUserBetsWithLegacySupport, NormalizedUserBet } from "@/utils/legacyUserBetDecoder";
import * as anchor from "@coral-xyz/anchor";

import MarketCard from "./MarketCard";
import MarketCardSkeleton from "./MarketCardSkeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Activity, TrendingUp, History, Filter, ArrowUpDown, Inbox } from "lucide-react";

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
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<Tab>("active");
    const [historyPage, setHistoryPage] = useState(1);
    const [activePage, setActivePage] = useState(1);
    const [positionsPage, setPositionsPage] = useState(1);
    const ITEMS_PER_PAGE = 10;
    const ACTIVE_ITEMS_PER_PAGE = 6;

    const fetchData = useCallback(async () => {
        // if (markets.length === 0) setLoading(true); // Removed to avoid sync update loop

        // @ts-ignore
        const program = getProgram(connection, wallet) as any;

        // Fetch Markets with error handling for old data
        try {
            const marketAccounts = await program.account.marketState.all();
            setMarkets(marketAccounts);
        } catch (error) {
            console.error("Error fetching markets (may be old incompatible data):", error);
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
    }, [connection, wallet, markets.length]);

    useEffect(() => {
        const run = async () => {
             await fetchData();
        };
        run();
        const interval = setInterval(fetchData, 5000); // 5s poll
        return () => clearInterval(interval);
    }, [fetchData]);

    // Filtering & Sorting
    const filteredMarkets = markets
        .filter((m) => {
            if (activeTab === "active") {
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
            return b.account.endTime.toNumber() - a.account.endTime.toNumber();
        });

    return (
        <div>
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="animate-fadeIn" style={{animationDelay: `${i * 100}ms`}}>
                            <MarketCardSkeleton />
                        </div>
                    ))}
                </div>
            ) : (
                <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as Tab)} className="space-y-6">
            <TabsList className="mb-4 bg-transparent p-0 gap-2 h-auto justify-start border-none">
                <TabsTrigger 
                    value="active"
                    className="px-4 py-2 rounded-md text-sm font-bold data-[state=active]:bg-primary data-[state=active]:text-black data-[state=inactive]:bg-transparent data-[state=inactive]:text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all border-none shadow-none cursor-pointer"
                >
                    Active Markets
                </TabsTrigger>
                <TabsTrigger 
                    value="positions"
                    className="px-4 py-2 rounded-md text-sm font-bold data-[state=active]:bg-primary data-[state=active]:text-black data-[state=inactive]:bg-transparent data-[state=inactive]:text-gray-500 hover:text-gray-300 transition-all border-none shadow-none cursor-pointer"
                >
                    My Positions
                    {userBets.length > 0 && (
                        <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full transition-colors ${activeTab === "positions" 
                            ? "bg-black text-white" 
                            : "bg-gray-800 text-gray-400"
                        }`}>
                            {userBets.length}
                        </span>
                    )}
                </TabsTrigger>
                <TabsTrigger 
                    value="history"
                    className="px-4 py-2 rounded-md text-sm font-bold data-[state=active]:bg-primary data-[state=active]:text-black data-[state=inactive]:bg-transparent data-[state=inactive]:text-gray-500 hover:text-gray-300 transition-all border-none shadow-none cursor-pointer"
                >
                    Resolved History
                </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredMarkets.length === 0 ? (
                        <div className="col-span-full text-center p-16 text-gray-400 border border-gray-800 rounded-xl bg-black/20 space-y-4 animate-fadeIn">
                            <Activity className="h-16 w-16 mx-auto text-gray-600" />
                            <div>
                                <p className="text-lg font-semibold">No active markets</p>
                                <p className="text-sm text-gray-500">Create a market or wait for new markets to appear</p>
                            </div>
                        </div>
                    ) : (
                        filteredMarkets.slice((activePage - 1) * ACTIVE_ITEMS_PER_PAGE, activePage * ACTIVE_ITEMS_PER_PAGE).map((m) => {
                            const myBet = userBets.find(b => b.account.market.toBase58() === m.publicKey.toBase58());
                            return (
                                <MarketCard
                                    key={m.publicKey.toString()}
                                    market={m}
                                    userBet={myBet}
                                    onRefresh={fetchData}
                                />
                            );
                        })
                    )}
                </div>

                {/* Pagination Controls */}
                {filteredMarkets.length > 0 && (
                    <div className="flex items-center justify-between mt-6">
                        <div className="text-sm text-gray-500">
                            Page {activePage} of {Math.ceil(filteredMarkets.length / ACTIVE_ITEMS_PER_PAGE) || 1}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setActivePage(p => Math.max(1, p - 1))}
                                disabled={activePage === 1}
                                className="h-8 w-8 p-0"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setActivePage(p => Math.min(Math.ceil(filteredMarkets.length / ACTIVE_ITEMS_PER_PAGE), p + 1))}
                                disabled={activePage >= Math.ceil(filteredMarkets.length / ACTIVE_ITEMS_PER_PAGE)}
                                className="h-8 w-8 p-0"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </TabsContent>

            <TabsContent value="positions" className="mt-0">
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredMarkets.length === 0 ? (
                        <div className="col-span-full text-center p-16 text-gray-400 border border-gray-800 rounded-xl bg-black/20 mt-4 space-y-4 animate-fadeIn">
                            <TrendingUp className="h-16 w-16 mx-auto text-gray-600" />
                            <div>
                                <p className="text-lg font-semibold">No positions yet</p>
                                <p className="text-sm text-gray-500">Place a bet on a market to see your positions here!</p>
                            </div>
                        </div>
                    ) : (
                        filteredMarkets.slice((positionsPage - 1) * ACTIVE_ITEMS_PER_PAGE, positionsPage * ACTIVE_ITEMS_PER_PAGE).map((m) => {
                            const myBet = userBets.find(b => b.account.market.toBase58() === m.publicKey.toBase58());
                            return (
                                <MarketCard
                                    key={m.publicKey.toString()}
                                    market={m}
                                    userBet={myBet}
                                    onRefresh={fetchData}
                                />
                            );
                        })
                    )}
                </div>

                {/* Pagination Controls */}
                {filteredMarkets.length > 0 && (
                    <div className="flex items-center justify-between mt-6">
                        <div className="text-sm text-gray-500">
                            Page {positionsPage} of {Math.ceil(filteredMarkets.length / ACTIVE_ITEMS_PER_PAGE) || 1}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPositionsPage(p => Math.max(1, p - 1))}
                                disabled={positionsPage === 1}
                                className="h-8 w-8 p-0"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPositionsPage(p => Math.min(Math.ceil(filteredMarkets.length / ACTIVE_ITEMS_PER_PAGE), p + 1))}
                                disabled={positionsPage >= Math.ceil(filteredMarkets.length / ACTIVE_ITEMS_PER_PAGE)}
                                className="h-8 w-8 p-0"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </TabsContent>

            <TabsContent value="history" className="mt-0">
                <div className="overflow-x-auto rounded-xl border border-gray-800 bg-black/20">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-900/50 text-gray-400 uppercase font-mono text-xs">
                            <tr>
                                <th className="px-6 py-4">Market Pair</th>
                                <th className="px-6 py-4">Result</th>
                                <th className="px-6 py-4">My Bet (UP / DOWN)</th>
                                <th className="px-6 py-4">Outcome</th>
                                <th className="px-6 py-4 text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                             {filteredMarkets.length === 0 ? (
                                 <tr>
                                     <td colSpan={5} className="text-center p-16 border-none">
                                         <div className="flex flex-col items-center space-y-4 text-gray-400">
                                             <History className="h-16 w-16 text-gray-600" />
                                             <div>
                                                 <p className="text-lg font-semibold">No resolved markets</p>
                                                 <p className="text-sm text-gray-500">Markets that have been settled will appear here</p>
                                             </div>
                                         </div>
                                     </td>
                                 </tr>
                             ) : (
                                filteredMarkets.slice((historyPage - 1) * ITEMS_PER_PAGE, historyPage * ITEMS_PER_PAGE).map((m) => {
                                const myBet = userBets.find(b => b.account.market.toBase58() === m.publicKey.toBase58());
                                const ma = m.account;

                                const upAmount = myBet ? myBet.account.amountUp.toNumber() / 1_000_000 : 0;
                                const downAmount = myBet ? myBet.account.amountDown.toNumber() / 1_000_000 : 0;

                                const isVoid = ma.isVoid;
                                const resultUp = ma.resultUp;

                                let outcome = "No Bet";
                                let outcomeColor = "text-gray-500";

                                if (myBet) {
                                    if (isVoid) {
                                        outcome = "Refunded";
                                        outcomeColor = "text-yellow-500";
                                    } else {
                                        const wonUp = upAmount > 0 && resultUp;
                                        const wonDown = downAmount > 0 && !resultUp;
                                        const lostUp = upAmount > 0 && !resultUp;
                                        const lostDown = downAmount > 0 && resultUp;

                                        if (wonUp && wonDown) outcome = "Both Won (Impossible)";
                                        else if (wonUp) outcome = "WON (UP)";
                                        else if (wonDown) outcome = "WON (DOWN)";
                                        else if (lostUp && lostDown) outcome = "LOST (Both)";
                                        else if (lostUp || lostDown) outcome = "LOST";

                                        if (outcome.includes("WON")) outcomeColor = "text-retro-green font-bold";
                                        else if (outcome.includes("LOST")) outcomeColor = "text-retro-red";
                                    }
                                }

                                const claimed = myBet?.account.claimed;

                                return (
                                    <tr key={m.publicKey.toString()} className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 font-bold text-white">{ma.pairName}</td>
                                        <td className="px-6 py-4">
                                            {ma.isVoid ? (
                                                <span className="px-2 py-1 rounded bg-gray-800 text-gray-400 text-xs">VOID</span>
                                            ) : ma.resultUp ? (
                                                <span className="px-2 py-1 rounded bg-retro-green/20 text-retro-green text-xs">UP</span>
                                            ) : (
                                                <span className="px-2 py-1 rounded bg-retro-red/20 text-retro-red text-xs">DOWN</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 font-mono">
                                            {myBet ? (
                                                <div className="flex flex-col gap-1">
                                                    {upAmount > 0 && <span className="text-retro-green">UP: ${upAmount.toFixed(2)}</span>}
                                                    {downAmount > 0 && <span className="text-retro-red">DOWN: ${downAmount.toFixed(2)}</span>}
                                                </div>
                                            ) : (
                                                <span className="text-gray-600">-</span>
                                            )}
                                        </td>
                                        <td className={`px-6 py-4 ${outcomeColor}`}>{outcome}</td>
                                        <td className="px-6 py-4 text-right">
                                            {myBet ? (
                                                claimed ? (
                                                    <span className="text-retro-green text-xs border border-retro-green/30 px-2 py-1 rounded">Claimed</span>
                                                ) : outcome.includes("WON") || outcome === "Refunded" ? (
                                                    <span className="text-yellow-500 text-xs animate-pulse">Unclaimed</span>
                                                ) : (
                                                    <span className="text-gray-600 text-xs">Settled</span>
                                                )
                                            ) : (
                                                <span className="text-gray-600 text-xs">-</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {filteredMarkets.length > 0 && (
                    <div className="flex items-center justify-between mt-4">
                        <div className="text-sm text-gray-500">
                            Page {historyPage} of {Math.ceil(filteredMarkets.length / ITEMS_PER_PAGE) || 1}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                                disabled={historyPage === 1}
                                className="h-8 w-8 p-0"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setHistoryPage(p => Math.min(Math.ceil(filteredMarkets.length / ITEMS_PER_PAGE), p + 1))}
                                disabled={historyPage >= Math.ceil(filteredMarkets.length / ITEMS_PER_PAGE)}
                                className="h-8 w-8 p-0"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </TabsContent>
        </Tabs>
            )}
        </div>
    );
}

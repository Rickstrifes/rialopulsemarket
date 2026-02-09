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
import { ChevronLeft, ChevronRight, Activity, TrendingUp, History, Filter, ArrowUpDown, Inbox, ArrowUp } from "lucide-react";

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
    const [selectedAsset, setSelectedAsset] = useState<string>("ALL");
    const [sortOption, setSortOption] = useState<string>("endingSoon");
    const [showBackToTop, setShowBackToTop] = useState(false);

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

    // Scroll to Top Logic
    useEffect(() => {
        const handleScroll = () => {
             setShowBackToTop(window.scrollY > 400);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // Filtering & Sorting
    const uniqueAssets = Array.from(new Set(markets.map(m => m.account.pairName))).sort();

    const filteredMarkets = markets
        .filter((m) => {
            if (activeTab === "active") {
                if (selectedAsset !== "ALL" && m.account.pairName !== selectedAsset) return false;
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
            if (activeTab === "active") {
                if (sortOption === "endingSoon") {
                    return a.account.endTime.toNumber() - b.account.endTime.toNumber();
                } else if (sortOption === "liquidity") {
                    const poolA = a.account.totalPoolUp.add(a.account.totalPoolDown).toNumber();
                    const poolB = b.account.totalPoolUp.add(b.account.totalPoolDown).toNumber();
                    return poolB - poolA;
                } else if (sortOption === "newest") {
                    // Using furthest end time as proxy for "newest" duration
                    return b.account.endTime.toNumber() - a.account.endTime.toNumber();
                }
            }
            // Default sort for other tabs (newest/latest first)
            return b.account.endTime.toNumber() - a.account.endTime.toNumber();
        });

    // Keyboard Navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if input/textarea is focused
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes((document.activeElement?.tagName || ''))) return;

            switch (e.key) {
                case '1': setActiveTab("active"); break;
                case '2': setActiveTab("positions"); break;
                case '3': setActiveTab("history"); break;
                case 'ArrowRight':
                    if (activeTab === "active") setActivePage(p => Math.min(Math.ceil(filteredMarkets.length / ACTIVE_ITEMS_PER_PAGE), p + 1));
                    else if (activeTab === "positions") setPositionsPage(p => Math.min(Math.ceil(filteredMarkets.length / ACTIVE_ITEMS_PER_PAGE), p + 1));
                    else if (activeTab === "history") setHistoryPage(p => Math.min(Math.ceil(filteredMarkets.length / ITEMS_PER_PAGE), p + 1));
                    break;
                case 'ArrowLeft':
                    if (activeTab === "active") setActivePage(p => Math.max(1, p - 1));
                    else if (activeTab === "positions") setPositionsPage(p => Math.max(1, p - 1));
                    else if (activeTab === "history") setHistoryPage(p => Math.max(1, p - 1));
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeTab, filteredMarkets.length]);

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
            <TabsList className="mb-4 bg-transparent p-0 gap-2 h-auto flex flex-row justify-start border-none w-full overflow-x-auto no-scrollbar">
                <TabsTrigger 
                    value="active"
                    className="px-4 py-2 rounded-md text-sm font-bold data-[state=active]:bg-primary data-[state=active]:text-black data-[state=inactive]:bg-transparent data-[state=inactive]:text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all border-none shadow-none cursor-pointer shrink-0"
                >
                    <Activity className="w-4 h-4 mr-2" />
                    Active Markets
                </TabsTrigger>
                <TabsTrigger 
                    value="positions"
                    className="px-4 py-2 rounded-md text-sm font-bold data-[state=active]:bg-primary data-[state=active]:text-black data-[state=inactive]:bg-transparent data-[state=inactive]:text-gray-500 hover:text-gray-300 transition-all border-none shadow-none cursor-pointer shrink-0"
                >
                    <TrendingUp className="w-4 h-4 mr-2" />
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
                    className="px-4 py-2 rounded-md text-sm font-bold data-[state=active]:bg-primary data-[state=active]:text-black data-[state=inactive]:bg-transparent data-[state=inactive]:text-gray-500 hover:text-gray-300 transition-all border-none shadow-none cursor-pointer shrink-0"
                >
                    <History className="w-4 h-4 mr-2" />
                    Resolved History
                </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-0">
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                    {/* Filter by Asset */}
                    <Select value={selectedAsset} onValueChange={(val) => { setSelectedAsset(val); setActivePage(1); }}>
                        <SelectTrigger className="w-full sm:w-[180px] bg-black/20 border-gray-800" aria-label="Filter by Asset Pair">
                             <div className="flex items-center gap-2">
                                 <Filter className="w-4 h-4 text-gray-400" />
                                 <SelectValue placeholder="Asset Pair" />
                             </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Assets</SelectItem>
                            {uniqueAssets.map(asset => (
                                <SelectItem key={asset} value={asset}>{asset}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Sort */}
                    <Select value={sortOption} onValueChange={setSortOption}>
                        <SelectTrigger className="w-full sm:w-[180px] bg-black/20 border-gray-800" aria-label="Sort Markets">
                             <div className="flex items-center gap-2">
                                 <ArrowUpDown className="w-4 h-4 text-gray-400" />
                                 <SelectValue placeholder="Sort By" />
                             </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="endingSoon">Ending Soon</SelectItem>
                            <SelectItem value="liquidity">Highest Liquidity</SelectItem>
                            <SelectItem value="newest">Longest Duration</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

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
                    <div className="flex flex-col sm:flex-row items-center justify-between mt-6 gap-4 sm:gap-0">
                        <div className="text-sm text-gray-500">
                            Page {activePage} of {Math.ceil(filteredMarkets.length / ACTIVE_ITEMS_PER_PAGE) || 1}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setActivePage(p => Math.max(1, p - 1))}
                                disabled={activePage === 1}
                                className="h-9 w-9 p-0"
                                aria-label="Previous Page"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setActivePage(p => Math.min(Math.ceil(filteredMarkets.length / ACTIVE_ITEMS_PER_PAGE), p + 1))}
                                disabled={activePage >= Math.ceil(filteredMarkets.length / ACTIVE_ITEMS_PER_PAGE)}
                                className="h-9 w-9 p-0"
                                aria-label="Next Page"
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
                    <div className="flex flex-col sm:flex-row items-center justify-between mt-6 gap-4 sm:gap-0">
                        <div className="text-sm text-gray-500">
                            Page {positionsPage} of {Math.ceil(filteredMarkets.length / ACTIVE_ITEMS_PER_PAGE) || 1}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPositionsPage(p => Math.max(1, p - 1))}
                                disabled={positionsPage === 1}
                                className="h-9 w-9 p-0"
                                aria-label="Previous Page"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPositionsPage(p => Math.min(Math.ceil(filteredMarkets.length / ACTIVE_ITEMS_PER_PAGE), p + 1))}
                                disabled={positionsPage >= Math.ceil(filteredMarkets.length / ACTIVE_ITEMS_PER_PAGE)}
                                className="h-9 w-9 p-0"
                                aria-label="Next Page"
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
                    <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-4 sm:gap-0">
                        <div className="text-sm text-gray-500">
                            Page {historyPage} of {Math.ceil(filteredMarkets.length / ITEMS_PER_PAGE) || 1}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                                disabled={historyPage === 1}
                                className="h-9 w-9 p-0"
                                aria-label="Previous Page"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setHistoryPage(p => Math.min(Math.ceil(filteredMarkets.length / ITEMS_PER_PAGE), p + 1))}
                                disabled={historyPage >= Math.ceil(filteredMarkets.length / ITEMS_PER_PAGE)}
                                className="h-9 w-9 p-0"
                                aria-label="Next Page"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </TabsContent>
        </Tabs>
        )}

        {showBackToTop && (
            <Button
                onClick={scrollToTop}
                className="fixed bottom-8 right-8 z-50 rounded-full h-12 w-12 p-3 shadow-xl shadow-primary/20 bg-primary text-primary-foreground hover:scale-110 transition-all border-none animate-fadeIn cursor-pointer"
                title="Back to Top"
                aria-label="Back to Top"
            >
                <ArrowUp className="h-6 w-6" />
            </Button>
        )}
    </div>
    );
}

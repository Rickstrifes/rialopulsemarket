"use client";

import { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { getProgram } from "@/utils/anchor";
import { USDC_MINT, ORACLE_PUBKEY } from "@/utils/constants";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";


import { ArrowPathIcon } from "@heroicons/react/24/solid";

import { formatPythPrice, formatCurrency } from "@/utils/formatting";
import { getPythId } from "@/utils/pyth";

interface MarketProps {
    market: {
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
    };
    onRefresh: () => void;
    userBet?: {
        publicKey: PublicKey;
        account: {
            user: PublicKey;
            market: PublicKey;
            amount: anchor.BN;
            isUp: boolean;
            claimed: boolean;
        };
    };
}

export default function MarketCard({ market, userBet, onRefresh }: MarketProps) {
    const { connection } = useConnection();
    const wallet = useWallet();

    const [betAmount, setBetAmount] = useState<string>("5");
    const [placingBet, setPlacingBet] = useState(false);
    const [timeLeft, setTimeLeft] = useState<string>("");
    const [resolving, setResolving] = useState(false);
    const [claiming, setClaiming] = useState(false);
    const [currentPrice, setCurrentPrice] = useState<number | null>(null);

    const m = market.account;
    const isExpired = Date.now() / 1000 > m.endTime.toNumber();

    // Fetch Live Price
    useEffect(() => {
        const fetchPrice = async () => {
            const feedId = getPythId(m.pairName);
            if (!feedId) return;

            try {
                // Pyth Hermes API
                const response = await fetch(`https://hermes.pyth.network/v2/updates/price/latest?ids[]=${feedId}`);
                const data = await response.json();
                if (data && data.parsed && data.parsed.length > 0) {
                    const priceData = data.parsed[0].price;
                    const val = parseFloat(priceData.price) * Math.pow(10, priceData.expo);
                    setCurrentPrice(val);
                }
            } catch (e) {
                console.error("Price fetch error:", e);
            }
        };

        fetchPrice();
        const interval = setInterval(fetchPrice, 5000);
        return () => clearInterval(interval);
    }, [m.pairName]);

    // Determine if user won using new void logic
    // Won if: Market Resolved AND UserBet exists AND (UserBet.isUp == Market.resultUp OR Market.isVoid)
    // If market is void, everyone can claim (refund)
    const hasWon = m.resolved && userBet && (m.isVoid || userBet.account.isUp === m.resultUp);
    const canClaim = hasWon && !userBet.account.claimed;

    // Personal Outcome Status
    const isWinner = m.resolved && userBet && !m.isVoid && userBet.account.isUp === m.resultUp;
    const isLoser = m.resolved && userBet && !m.isVoid && userBet.account.isUp !== m.resultUp;
    const isRefund = m.resolved && m.isVoid;

    // Timer Logic
    useEffect(() => {
        const updateTimer = () => {
            const now = Math.floor(Date.now() / 1000);
            const end = m.endTime.toNumber();
            const diff = end - now;

            if (diff <= 0) {
                setTimeLeft("Ended");
            } else {
                const h = Math.floor(diff / 3600);
                const m = Math.floor((diff % 3600) / 60);
                const s = diff % 60;
                setTimeLeft(`${h > 0 ? h + 'h ' : ''}${m}m ${s}s`);
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [m.endTime]);


    const placeBet = async (isUp: boolean) => {
        if (!wallet.publicKey) {
            alert("Connect wallet first!");
            return;
        }

        const amountVal = parseFloat(betAmount);
        if (isNaN(amountVal) || amountVal <= 0) {
            alert("Invalid bet amount");
            return;
        }

        setPlacingBet(true);
        try {
            // @ts-ignore
            const program = getProgram(connection, wallet) as any;
            const amount = new anchor.BN(amountVal * 1_000_000); // Decimals 6

            console.log(`Betting ${amountVal} USDC (${amount.toString()} units) on ${isUp ? "UP" : "DOWN"}`);

            const [userBet] = PublicKey.findProgramAddressSync(
                [Buffer.from("bet"), market.publicKey.toBuffer(), wallet.publicKey.toBuffer()],
                program.programId
            );

            const [vaultTokenAccount] = PublicKey.findProgramAddressSync(
                [Buffer.from("vault"), market.publicKey.toBuffer()],
                program.programId
            );

            const userTokenAccount = await getAssociatedTokenAddress(USDC_MINT, wallet.publicKey);

            const tx = await program.methods.placeBet(
                amount,
                isUp
            ).accounts({
                market: market.publicKey,
                userBet,
                vaultTokenAccount,
                userTokenAccount,
                user: wallet.publicKey,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
            }).rpc();

            console.log("Bet placed:", tx);
            alert(`Bet Placed! Tx: ${tx}`);
            setBetAmount(""); // Clear input
            onRefresh();
        } catch (error: any) {
            console.error("Bet error:", error);
            alert("Error placing bet: " + error.message);
        } finally {
            setPlacingBet(false);
        }
    };

    // resolveMarket function removed as resolution is handled by off-chain cron job



    const claimWinnings = async () => {
        if (!wallet.publicKey || !userBet) return;
        setClaiming(true);
        try {
            // @ts-ignore
            const program = getProgram(connection, wallet) as any;

            const [vaultTokenAccount] = PublicKey.findProgramAddressSync(
                [Buffer.from("vault"), market.publicKey.toBuffer()],
                program.programId
            );

            const userTokenAccount = await getAssociatedTokenAddress(USDC_MINT, wallet.publicKey);

            const tx = await program.methods.claimRewards()
                .accounts({
                    market: market.publicKey,
                    userBet: userBet.publicKey,
                    vaultTokenAccount,
                    userTokenAccount,
                    user: wallet.publicKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .rpc();

            console.log("Claimed:", tx);
            alert(m.isVoid ? "Refund Claimed!" : "Winnings Claimed!");
            onRefresh();
        } catch (error: any) {
            console.error("Claim error:", error);
            alert("Error claiming: " + error.message);
        } finally {
            setClaiming(false);
        }
    }

    const totalUp = m.totalPoolUp.toNumber() / 1_000_000;
    const totalDown = m.totalPoolDown.toNumber() / 1_000_000;

    // Verify Data from Smart Contract


    return (
        <div className="glass-panel rounded-xl p-6 border border-gray-800 hover:border-accent/50 transition-all flex flex-col relative overflow-hidden">
            {isExpired && !m.resolved && (
                <div className="absolute top-0 right-0 bg-blue-500/20 text-blue-400 text-xs px-2 py-1 rounded-bl-lg border-b border-l border-blue-500/20 animate-pulse flex items-center gap-1">
                    <ArrowPathIcon className="w-3 h-3 animate-spin" /> Settling Market...
                </div>
            )}

            {m.resolved && (
                <div className={`absolute top-0 right-0 text-xs px-2 py-1 rounded-bl-lg border-b border-l ${m.isVoid ? 'bg-gray-500/20 text-gray-400 border-gray-500/20' :
                    m.resultUp ? 'bg-green-500/20 text-green-400 border-green-500/20' : 'bg-red-500/20 text-red-400 border-red-500/20'
                    }`}>
                    {m.isVoid ? "VOIDED - NO OPPONENT" : `Winner: ${m.resultUp ? "UP" : "DOWN"}`}
                </div>
            )}

            {userBet && (
                <div className="absolute top-0 left-0 bg-primary/20 text-primary text-xs px-2 py-1 rounded-br-lg border-b border-r border-primary/20 font-mono">
                    My Bet: <span className="font-sans font-bold">{userBet.account.isUp ? "UP" : "DOWN"}</span> ({userBet.account.amount.toNumber() / 1_000_000} USDC)
                </div>
            )}

            <div className="flex justify-between items-start mb-4 mt-6">
                <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                        {m.pairName}
                    </h3>
                    <span className="text-[10px] font-mono text-gray-500 bg-gray-900 border border-gray-800 px-1.5 py-0.5 rounded opacity-50 hover:opacity-100 transition-opacity cursor-help" title={`Market ID: ${market.publicKey.toString()}`}>
                        #{market.publicKey.toString().slice(0, 4)}...{market.publicKey.toString().slice(-4)}
                    </span>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-bold ${isExpired ? 'bg-gray-500/20 text-gray-400' : 'bg-green-500/20 text-green-400'}`}>
                    {isExpired ? (m.resolved ? 'FINISHED' : 'ENDED') : timeLeft}
                </span>
            </div>

            {/* Price Display */}
            <div className="flex justify-between text-xs mb-4 bg-black/20 p-2 rounded border border-gray-800">
                <div className="text-center">
                    <div className="text-gray-500">Strike Price</div>
                    <p className="text-white font-mono">
                        {formatPythPrice(m.initialPrice)}
                    </p>
                </div>
                {!isExpired && (
                    <div className="text-center">
                        <div className="text-gray-500">Current Price</div>

                        <div className={`font-mono ${currentPrice && m.initialPrice ? (currentPrice > (m.initialPrice.toNumber() / 100000000) ? 'text-green-400' : 'text-red-400') : 'text-gray-400'}`}>
                            {currentPrice ? formatCurrency(currentPrice) : "Loading..."}
                        </div>
                    </div>
                )}
                {m.resolved && (
                    <div className="text-center">
                        <div className="text-gray-500">Settlement</div>
                        <div className={`font-mono ${m.resultUp ? 'text-green-400' : 'text-red-400'}`}>
                            {formatPythPrice(m.finalPrice)}
                        </div>
                    </div>
                )}
            </div>

            {/* Personal Outcome Banner */}
            {m.resolved && userBet && (
                <div className="mb-4">
                    {isWinner && (
                        <div className="w-full py-2 bg-green-500/20 border border-green-500 text-green-400 text-center font-bold tracking-wider rounded uppercase shadow-[0_0_15px_rgba(34,197,94,0.3)] animate-pulse">
                            You Won
                        </div>
                    )}
                    {isLoser && (
                        <div className="w-full py-2 bg-red-500/20 border border-red-500 text-red-400 text-center font-bold tracking-wider rounded uppercase">
                            You Lost
                        </div>
                    )}
                    {isRefund && (
                        <div className="w-full py-2 bg-yellow-500/20 border border-yellow-500 text-yellow-400 text-center font-bold tracking-wider rounded uppercase">
                            Market Refunded
                        </div>
                    )}
                </div>
            )}

            <div className="flex justify-between mb-6 text-sm">
                <div className="text-center">
                    <div className="text-gray-400 mb-1">Pool UP</div>
                    <div className="text-green-400 font-mono text-lg">${totalUp.toFixed(2)}</div>
                </div>
                <div className="text-center">
                    <div className="text-gray-400 mb-1">Pool DOWN</div>
                    <div className="text-red-400 font-mono text-lg">${totalDown.toFixed(2)}</div>
                </div>
            </div>

            <div className="mt-auto space-y-3">
                {/* Betting Inputs */}
                {!isExpired && (
                    <>
                        <div className="flex items-center bg-black/40 rounded border border-gray-700 p-1">
                            <span className="text-gray-400 text-xs pl-2">$</span>
                            <input
                                type="number"
                                step="0.1"
                                value={betAmount}
                                onChange={(e) => setBetAmount(e.target.value)}
                                className="w-full bg-transparent text-right pr-2 text-white outline-none text-sm font-mono"
                                placeholder="Amount"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => placeBet(true)}
                                disabled={isExpired || placingBet}
                                className="py-2 rounded bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20 disabled:opacity-50 transition-colors relative"
                            >
                                {placingBet ? <ArrowPathIcon className="w-5 h-5 animate-spin mx-auto" /> : "BET UP"}
                            </button>
                            <button
                                onClick={() => placeBet(false)}
                                disabled={isExpired || placingBet}
                                className="py-2 rounded bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 disabled:opacity-50 transition-colors relative"
                            >
                                {placingBet ? <ArrowPathIcon className="w-5 h-5 animate-spin mx-auto" /> : "BET DOWN"}
                            </button>
                        </div>
                    </>
                )}

                {/* Resolve Button Removed: Handled by Cron Job */}
                {/* isExpired && !m.resolved && ( ... ) */}

                {/* Claim Winnings Button */}
                {canClaim && (
                    <button
                        onClick={claimWinnings}
                        disabled={claiming}
                        className="w-full py-2 bg-green-500 text-black font-bold rounded shadow-lg shadow-green-500/20 hover:scale-105 transition-all text-sm animate-bounce-subtle"
                    >
                        {claiming ? "Claiming..." : m.isVoid ? "⚠️ CLAIM REFUND ⚠️" : "💰 CLAIM WINNINGS 💰"}
                    </button>
                )}

                {hasWon && userBet.account.claimed && (
                    <div className="text-center text-xs text-green-500 font-mono border border-green-500/20 bg-green-500/5 py-2 rounded">
                        {m.isVoid ? "Refund Claimed" : "Winnings Claimed"}
                    </div>
                )}
            </div>
        </div>
    );
}

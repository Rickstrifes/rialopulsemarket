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
import {
    BET_PRESETS,
    isValidBetFormat,
    isValidBetAmount,
    parseUsdcAmount,
    USDC_MULTIPLIER
} from "@/utils/betting";
import { getErrorMessage } from "@/utils/errorParser";
import { showBetSuccessToast, notify } from "@/utils/notifications";

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
            amountUp: anchor.BN;
            amountDown: anchor.BN;
            claimed: boolean;
        };
    };
}

export default function MarketCard({ market, userBet, onRefresh }: MarketProps) {
    const { connection } = useConnection();
    const wallet = useWallet();

    const [betAmount, setBetAmount] = useState<string>("");
    const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
    const [placingBet, setPlacingBet] = useState(false);
    const [timeLeft, setTimeLeft] = useState<string>("");
    const [resolving, setResolving] = useState(false);
    const [claiming, setClaiming] = useState(false);
    const [localClaimed, setLocalClaimed] = useState(false);
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

    // Determine if user won using void logic
    // With amountUp/amountDown: amountUp > 0 means bet UP, amountDown > 0 means bet DOWN
    const userBetIsUp = userBet ? userBet.account.amountUp.toNumber() > 0 : false;
    const userBetIsDown = userBet ? userBet.account.amountDown.toNumber() > 0 : false;
    const userTotalBet = userBet ? (userBet.account.amountUp.toNumber() + userBet.account.amountDown.toNumber()) : 0;

    // Won if: Market Resolved AND UserBet exists AND (User bet direction matches result OR Market.isVoid)
    const hasWon = m.resolved && userBet && (m.isVoid || (userBetIsUp && m.resultUp) || (userBetIsDown && !m.resultUp));
    const canClaim = hasWon && !userBet.account.claimed && !localClaimed;

    // Personal Outcome Status
    const isWinner = m.resolved && userBet && !m.isVoid && ((userBetIsUp && m.resultUp) || (userBetIsDown && !m.resultUp));
    const isLoser = m.resolved && userBet && !m.isVoid && ((userBetIsUp && !m.resultUp) || (userBetIsDown && m.resultUp));
    const isRefund = m.resolved && m.isVoid;
    const isHedged = userBetIsUp && userBetIsDown;

    // Calculate Estimated Payout for UI
    const calculateEstimatedPayout = () => {
        if (!userBet || !m.resolved || m.isVoid) return 0;
        const upAmt = userBet.account.amountUp.toNumber();
        const downAmt = userBet.account.amountDown.toNumber();
        const poolUp = m.totalPoolUp.toNumber();
        const poolDown = m.totalPoolDown.toNumber();

        let payout = 0;
        if (m.resultUp && upAmt > 0 && poolUp > 0) {
            // share = upAmt / poolUp
            // win = share * poolDown
            // total = upAmt + win
            payout = upAmt + (upAmt * poolDown / poolUp);
        } else if (!m.resultUp && downAmt > 0 && poolDown > 0) {
            payout = downAmt + (downAmt * poolUp / poolDown);
        }
        return payout / 1_000_000;
    };
    const estimatedPayout = calculateEstimatedPayout();

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

    // Betting input validation
    const isBetValid = isValidBetAmount(betAmount);

    const handleBetInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        // Only update if the format is valid (allows digits and single decimal)
        if (isValidBetFormat(value)) {
            setBetAmount(value);
            // Clear preset selection if user types a custom amount
            const numValue = parseFloat(value);
            if (!BET_PRESETS.includes(numValue as typeof BET_PRESETS[number])) {
                setSelectedPreset(null);
            } else {
                setSelectedPreset(numValue);
            }
        }
    };

    const handleBetKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        // Block invalid characters: -, +, e, E
        if (['-', '+', 'e', 'E'].includes(e.key)) {
            e.preventDefault();
        }
    };

    const handlePresetClick = (amount: number) => {
        setBetAmount(amount.toString());
        setSelectedPreset(amount);
    };


    const placeBet = async (isUp: boolean) => {
        if (!wallet.publicKey) {
            notify.error("Connect wallet first!");
            return;
        }

        const amount = parseUsdcAmount(betAmount);
        if (!amount) {
            notify.error("Invalid bet amount. Please enter a positive number.");
            return;
        }

        const displayAmount = parseFloat(betAmount);
        console.log(`Betting ${displayAmount} USDC → ${amount.toString()} units (BN) on ${isUp ? "UP" : "DOWN"}`);

        setPlacingBet(true);
        try {
            // @ts-ignore
            const program = getProgram(connection, wallet) as any;

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
                userBet: userBet,
                vaultTokenAccount: vaultTokenAccount,
                userTokenAccount: userTokenAccount,
                user: wallet.publicKey,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
            }).rpc();

            console.log("Bet placed:", tx);
            showBetSuccessToast(tx);
            setBetAmount(""); // Clear input
            onRefresh();
        } catch (error: any) {
            console.error("Bet error:", error);
            notify.error(getErrorMessage(error));
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
                    vaultTokenAccount: vaultTokenAccount,
                    userTokenAccount: userTokenAccount,
                    user: wallet.publicKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .rpc();

            console.log("Claimed:", tx);
            notify.success(m.isVoid ? "Refund Claimed!" : "Winnings Claimed!");
            setLocalClaimed(true); // Optimistic update
            onRefresh();
        } catch (error: any) {
            console.error("Claim error:", error);
            const errMsg = getErrorMessage(error);

            if (errMsg.includes("AlreadyClaimed") || errMsg.includes("6006") || JSON.stringify(error).includes("6006")) {
                notify.error("You have already claimed this reward.");
                setLocalClaimed(true); // Disable button immediately
                // Force refresh to update state
                onRefresh();
            } else {
                notify.error(errMsg);
            }
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
                <div className="absolute top-0 left-0 bg-primary/20 text-primary text-xs px-2 py-1 rounded-br-lg border-b border-r border-primary/20 font-mono flex gap-2">
                    {userBetIsUp && (
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            UP: ${(userBet.account.amountUp.toNumber() / 1_000_000).toFixed(2)}
                        </span>
                    )}
                    {userBetIsUp && userBetIsDown && <span className="text-gray-500">|</span>}
                    {userBetIsDown && (
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-red-500"></span>
                            DOWN: ${(userBet.account.amountDown.toNumber() / 1_000_000).toFixed(2)}
                        </span>
                    )}
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
                    {/* HEDGED VIEW */}
                    {isHedged && !m.isVoid ? (
                        <div className="bg-gray-900/80 rounded-lg p-3 border border-gray-700 text-sm">
                            <div className="text-gray-400 text-xs mb-2 text-center uppercase tracking-wide">Position Summary</div>

                            {/* UP ROW */}
                            <div className="flex justify-between items-center mb-1">
                                <div className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                    <span className="text-green-400 font-bold">UP</span>
                                </div>
                                <div className={m.resultUp ? "text-green-400 font-bold" : "text-gray-500"}>
                                    ${(userBet.account.amountUp.toNumber() / 1_000_000).toFixed(2)}
                                    {m.resultUp ? " (WON)" : " (LOST)"}
                                </div>
                            </div>

                            {/* DOWN ROW */}
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                    <span className="text-red-400 font-bold">DOWN</span>
                                </div>
                                <div className={!m.resultUp ? "text-green-400 font-bold" : "text-gray-500"}>
                                    ${(userBet.account.amountDown.toNumber() / 1_000_000).toFixed(2)}
                                    {!m.resultUp ? " (WON)" : " (LOST)"}
                                </div>
                            </div>

                            {/* TOTAL PAYOUT */}
                            <div className="border-t border-gray-700 pt-2 flex justify-between items-center">
                                <span className="text-gray-300 font-bold">Total Payout:</span>
                                <span className="text-yellow-400 font-mono font-bold text-lg">
                                    ✨ ${estimatedPayout.toFixed(2)}
                                </span>
                            </div>
                        </div>
                    ) : (
                        /* SINGLE SIDE VIEW (Original) */
                        <>
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
                        </>
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
                        {/* Amount Input */}
                        <div className="flex items-center bg-black/40 rounded border border-gray-700 p-1">
                            <span className="text-gray-400 text-xs pl-2">$</span>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={betAmount}
                                onChange={handleBetInputChange}
                                onKeyDown={handleBetKeyDown}
                                className="w-full bg-transparent text-right pr-2 text-white outline-none text-sm font-mono"
                                placeholder="Enter amount"
                            />
                            <span className="text-gray-500 text-xs pr-2">USDC</span>
                        </div>

                        {/* Quick Select Presets */}
                        <div className="flex gap-2">
                            {BET_PRESETS.map((preset) => (
                                <button
                                    key={preset}
                                    onClick={() => handlePresetClick(preset)}
                                    className={`flex-1 py-1.5 rounded text-xs font-mono transition-all ${selectedPreset === preset
                                        ? 'bg-accent/20 text-accent border border-accent/50'
                                        : 'bg-gray-800/50 text-gray-400 border border-gray-700 hover:border-gray-600 hover:text-gray-300'
                                        }`}
                                >
                                    {preset} USDC
                                </button>
                            ))}
                        </div>

                        {/* Bet Buttons */}
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => placeBet(true)}
                                disabled={isExpired || placingBet || !isBetValid}
                                className="py-2 rounded bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors relative"
                            >
                                {placingBet ? <ArrowPathIcon className="w-5 h-5 animate-spin mx-auto" /> : "BET UP"}
                            </button>
                            <button
                                onClick={() => placeBet(false)}
                                disabled={isExpired || placingBet || !isBetValid}
                                className="py-2 rounded bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors relative"
                            >
                                {placingBet ? <ArrowPathIcon className="w-5 h-5 animate-spin mx-auto" /> : "BET DOWN"}
                            </button>
                        </div>
                    </>
                )}

                {/* Resolve Button Removed: Handled by Cron Job */}
                {/* isExpired && !m.resolved && ( ... ) */}

                {/* Claim Winnings Button */}
                {/* Logic: Show active claim button ONLY if won, not claimed, and not locally claimed */}
                {canClaim && (
                    <button
                        onClick={claimWinnings}
                        disabled={claiming}
                        className="w-full py-2 bg-green-500 text-black font-bold rounded shadow-lg shadow-green-500/20 hover:scale-105 transition-all text-sm animate-bounce-subtle"
                    >
                        {claiming ? "Claiming..." : m.isVoid ? "⚠️ CLAIM REFUND ⚠️" : "💰 CLAIM WINNINGS 💰"}
                    </button>
                )}

                {/* Show Disabled 'Claimed' Button if definitely claimed */}
                {(hasWon && (userBet.account.claimed || localClaimed)) && (
                    <button
                        disabled
                        className="w-full py-2 bg-gray-800 text-gray-500 font-bold rounded border border-gray-700 cursor-not-allowed text-sm flex items-center justify-center gap-2"
                    >
                        <span>✅</span>
                        {m.isVoid ? "Refund Claimed" : "Winnings Claimed"}
                    </button>
                )}
            </div>
        </div>
    );
}

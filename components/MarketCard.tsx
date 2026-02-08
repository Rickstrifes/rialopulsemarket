"use client";

import { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { getProgram } from "@/utils/anchor";
import { USDC_MINT, ORACLE_PUBKEY } from "@/utils/constants";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";


import { ArrowPathIcon } from "@heroicons/react/24/solid";
import { Check, Trophy } from "lucide-react";

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

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupText, InputGroupInput } from "@/components/ui/input-group";
import { Badge } from "@/components/ui/badge";

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

    return (
        <Card className="glass-panel border-secondary/30 relative overflow-hidden transition-all hover:border-secondary/50">
             {isExpired && !m.resolved && (
                <Badge variant="outline" className="absolute top-0 right-0 rounded-bl-lg rounded-tr-lg border-b border-l bg-blue-500/20 text-blue-400 border-blue-500/20 animate-pulse flex items-center gap-1 z-10">
                    <ArrowPathIcon className="w-3 h-3 animate-spin" /> Settling...
                </Badge>
            )}

            {m.resolved && (
                <div className={`absolute top-0 right-0 px-3 py-1 font-bold font-mono text-xs uppercase tracking-wider flex items-center gap-1 z-20 shadow-lg ${
                    m.isVoid 
                        ? 'bg-gray-800 text-gray-400 border-b border-l border-gray-700 rounded-bl-xl' 
                        : m.resultUp 
                            ? 'bg-retro-green text-black border-b border-l border-retro-green shadow-[0_0_15px_rgba(34,197,94,0.4)] rounded-bl-xl' 
                            : 'bg-retro-red text-white border-b border-l border-retro-red shadow-[0_0_15px_rgba(239,68,68,0.4)] rounded-bl-xl'
                }`}>
                    {!m.isVoid && <Trophy className="w-3 h-3" />}
                    {m.isVoid ? "VOIDED" : `${m.resultUp ? "UP" : "DOWN"} WINS`}
                </div>
            )}

            {userBet && (
                <div className={`absolute top-0 left-0 text-xs px-2 py-1 rounded-br-lg border-b border-r font-mono flex gap-2 z-10 ${
                    userBetIsUp && !userBetIsDown
                        ? 'bg-retro-green/20 text-retro-green border-retro-green/20'
                        : userBetIsDown && !userBetIsUp
                        ? 'bg-retro-red/20 text-retro-red border-retro-red/20'
                        : 'bg-primary/10 border-primary/20 text-gray-300' 
                }`}>
                    {userBetIsUp && (
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-retro-green"></span>
                            <span className={userBetIsUp && userBetIsDown ? "text-retro-green font-bold" : ""}>
                                UP: ${(userBet.account.amountUp.toNumber() / 1_000_000).toFixed(2)}
                            </span>
                        </span>
                    )}
                    {userBetIsUp && userBetIsDown && <span className="text-gray-600">|</span>}
                    {userBetIsDown && (
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-retro-red"></span>
                            <span className={userBetIsUp && userBetIsDown ? "text-retro-red font-bold" : ""}>
                                DOWN: ${(userBet.account.amountDown.toNumber() / 1_000_000).toFixed(2)}
                            </span>
                        </span>
                    )}
                </div>
            )}

            <CardHeader className="mt-6 pb-2">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                        <CardTitle className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                            {m.pairName}
                        </CardTitle>
                        <span className="text-[10px] font-mono text-gray-500 bg-gray-900 border border-gray-800 px-1.5 py-0.5 rounded opacity-50 hover:opacity-100 transition-opacity cursor-help" title={`Market ID: ${market.publicKey.toString()}`}>
                             #{market.publicKey.toString().slice(0, 4)}...{market.publicKey.toString().slice(-4)}
                        </span>
                    </div>
                     <Badge variant={isExpired ? "secondary" : "default"} className={`${isExpired ? 'bg-gray-500/20 text-gray-400 border-none' : 'bg-retro-green/20 text-retro-green border-none'}`}>
                        {isExpired ? (m.resolved ? 'FINISHED' : 'ENDED') : timeLeft}
                    </Badge>
                </div>
            </CardHeader>
            
            <CardContent>
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
                            <div className={`font-mono ${currentPrice && m.initialPrice ? (currentPrice > (m.initialPrice.toNumber() / 100000000) ? 'text-retro-green' : 'text-retro-red') : 'text-gray-400'}`}>
                                {currentPrice ? formatCurrency(currentPrice) : "Loading..."}
                            </div>
                        </div>
                    )}
                    {m.resolved && (
                        <div className="text-center">
                            <div className="text-gray-500">Settlement</div>
                            <div className={`font-mono ${m.resultUp ? 'text-retro-green' : 'text-retro-red'}`}>
                                {formatPythPrice(m.finalPrice)}
                            </div>
                        </div>
                    )}
                </div>

                {/* Personal Outcome Banner */}
                 {m.resolved && userBet && (
                    <div className="mb-4">
                        {isHedged && !m.isVoid ? (
                             <div className="bg-gray-900/80 rounded-lg p-3 border border-gray-700 text-sm">
                                <div className="text-gray-400 text-xs mb-2 text-center uppercase tracking-wide">Position Summary</div>
                                {/* UP ROW */}
                                <div className="flex justify-between items-center mb-1">
                                    <div className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-retro-green"></span>
                                        <span className="text-retro-green font-bold">UP</span>
                                    </div>
                                    <div className={m.resultUp ? "text-retro-green font-bold" : "text-gray-500"}>
                                        ${(userBet.account.amountUp.toNumber() / 1_000_000).toFixed(2)}
                                        {m.resultUp ? " (WON)" : " (LOST)"}
                                    </div>
                                </div>
                                {/* DOWN ROW */}
                                <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-retro-red"></span>
                                        <span className="text-retro-red font-bold">DOWN</span>
                                    </div>
                                    <div className={!m.resultUp ? "text-retro-green font-bold" : "text-gray-500"}>
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
                             <>
                                {isWinner && (
                                    <div className="w-full py-2 bg-retro-green/20 border border-retro-green text-retro-green text-center font-bold tracking-wider rounded uppercase shadow-[0_0_15px_rgba(34,197,94,0.3)] animate-pulse">
                                        You Won
                                    </div>
                                )}
                                {isLoser && (
                                    <div className="w-full py-2 bg-retro-red/20 border border-retro-red text-retro-red text-center font-bold tracking-wider rounded uppercase">
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
                        <div className="text-retro-green font-mono text-lg">${totalUp.toFixed(2)}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-gray-400 mb-1">Pool DOWN</div>
                        <div className="text-retro-red font-mono text-lg">${totalDown.toFixed(2)}</div>
                    </div>
                </div>

                <div className="space-y-3">
                     {!isExpired && (
                        <>
                             {/* Amount Input */}
                            <InputGroup>
                                <InputGroupAddon align="inline-start">
                                    <InputGroupText>$</InputGroupText>
                                </InputGroupAddon>
                                <InputGroupInput
                                    type="text"
                                    inputMode="decimal"
                                    value={betAmount}
                                    onChange={handleBetInputChange}
                                    onKeyDown={handleBetKeyDown}
                                    className="text-right font-mono pb-2"
                                    placeholder="Enter amount"
                                />
                                <InputGroupAddon align="inline-end">
                                    <InputGroupText>USDC</InputGroupText>
                                </InputGroupAddon>
                            </InputGroup>

                            {/* Quick Select Presets */}
                            <div className="flex gap-2">
                                {BET_PRESETS.map((preset) => (
                                    <Button
                                        key={preset}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handlePresetClick(preset)}
                                        className={`flex-1 text-xs font-mono h-8 border focus-visible:ring-0 focus-visible:ring-offset-0 cursor-pointer ${
                                            selectedPreset === preset
                                                ? "bg-retro-green/20 text-retro-green border-retro-green font-bold shadow-[0_0_10px_rgba(34,197,94,0.2)]"
                                                : "bg-gray-900 text-gray-400 border-gray-800 hover:bg-gray-800 hover:text-gray-200"
                                        }`}
                                    >
                                        {preset} USDC
                                    </Button>
                                ))}
                            </div>

                             {/* Bet Buttons */}
                            <div className="grid grid-cols-2 gap-4">
                                <Button
                                    onClick={() => placeBet(true)}
                                    disabled={isExpired || placingBet || !isBetValid}
                                    className="bg-retro-green/10 text-retro-green border border-retro-green/30 hover:bg-retro-green/20 cursor-pointer"
                                >
                                     {placingBet ? <ArrowPathIcon className="w-5 h-5 animate-spin mx-auto" /> : "BET UP"}
                                </Button>
                                <Button
                                    onClick={() => placeBet(false)}
                                    disabled={isExpired || placingBet || !isBetValid}
                                    className="bg-retro-red/10 text-retro-red border border-retro-red/30 hover:bg-retro-red/20 cursor-pointer"
                                >
                                    {placingBet ? <ArrowPathIcon className="w-5 h-5 animate-spin mx-auto" /> : "BET DOWN"}
                                </Button>
                            </div>
                        </>
                     )}

                     {canClaim && (
                        <Button
                            onClick={claimWinnings}
                            disabled={claiming}
                            className="w-full bg-retro-green text-black font-bold shadow-lg shadow-retro-green/20 hover:scale-105 transition-all text-sm animate-bounce-subtle hover:bg-retro-green cursor-pointer"
                        >
                            {claiming ? "Claiming..." : m.isVoid ? "⚠️ CLAIM REFUND ⚠️" : "💰 CLAIM WINNINGS 💰"}
                        </Button>
                    )}


                    {(hasWon && (userBet.account.claimed || localClaimed)) && (() => {
                        if (m.isVoid) {
                            return (
                                <Button
                                    disabled
                                    className="w-full bg-gray-900 border border-gray-800 text-gray-400 cursor-not-allowed hover:bg-gray-900"
                                >
                                    <Check className="w-4 h-4 mr-2" />
                                    Refund Claimed
                                </Button>
                            );
                        }
                        
                        const totalBetUSDC = userTotalBet / 1_000_000;
                        const profit = estimatedPayout - totalBetUSDC;
                        const profitPercentage = totalBetUSDC > 0 ? ((profit / totalBetUSDC) * 100) : 0;
                        
                        return (
                            <Button
                                disabled
                                className="w-full bg-gray-900 border border-gray-800 text-gray-400 cursor-not-allowed hover:bg-gray-900"
                            >
                                <Check className="w-4 h-4 mr-2" />
                                Claimed ${estimatedPayout.toFixed(2)} (Profit: +${profit.toFixed(2)}, +{profitPercentage.toFixed(1)}%)
                            </Button>
                        );
                    })()}
                </div>
            </CardContent>
        </Card>
    );
}

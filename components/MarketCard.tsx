"use client";

import { useState, useEffect, useRef } from "react";
import { useConnection, useWallet, AnchorWallet } from "@jup-ag/wallet-adapter";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { getProgram } from "@/utils/anchor";
import { USDC_MINT } from "@/utils/constants";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";


import { ArrowPathIcon } from "@heroicons/react/24/solid";
import { Check, Trophy, Flame, Clock, ArrowUp, ArrowDown } from "lucide-react";

import { formatPythPrice, formatCurrency } from "@/utils/formatting";
import { getPythId } from "@/utils/pyth";
import {
    BET_PRESETS,
    isValidBetFormat,
    isValidBetAmount,
    parseUsdcAmount
} from "@/utils/betting";
import { getErrorMessage } from "@/utils/errorParser";
import { showBetSuccessToast, notify } from "@/utils/notifications";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import CryptoIcon from "./CryptoIcon";
import { Button } from "@/components/ui/button";

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

    const [claiming, setClaiming] = useState(false);
    const [localClaimed, setLocalClaimed] = useState(false);
    const [currentPrice, setCurrentPrice] = useState<number | null>(null);
    const prevPriceRef = useRef<number | null>(null);
    const [priceDirection, setPriceDirection] = useState<'up' | 'down' | 'neutral'>('neutral');

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
                    
                    if (prevPriceRef.current !== null && val !== prevPriceRef.current) {
                        if (val > prevPriceRef.current) setPriceDirection('up');
                        else if (val < prevPriceRef.current) setPriceDirection('down');
                        
                        // Reset direction after animation
                        setTimeout(() => setPriceDirection('neutral'), 2000);
                    }
                    prevPriceRef.current = val;
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
            const program = getProgram(connection, wallet as AnchorWallet);

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
        } catch (error: unknown) {
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
            const program = getProgram(connection, wallet as AnchorWallet);

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
        } catch (error: unknown) {
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

    const isEndingSoon = !isExpired && (m.endTime.toNumber() - Date.now() / 1000 < 3600);
    const isHot = (totalUp + totalDown) > 500;

    return (
        <Card className={`glass-panel border-2 relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 ${
            priceDirection === 'up' ? 'border-retro-green/50 shadow-retro-green/10' : 
            priceDirection === 'down' ? 'border-retro-red/50 shadow-retro-red/10' : 
            'border-secondary/20 hover:border-secondary/50'
        }`}>
             {isExpired && !m.resolved && (
                <Badge variant="outline" className="absolute top-0 right-0 rounded-bl-lg rounded-tr-lg border-b border-l bg-blue-500/20 text-blue-400 border-blue-500/20 animate-pulse flex items-center gap-1 z-10">
                    <ArrowPathIcon className="w-3 h-3 animate-spin" /> Settling...
                </Badge>
            )}

            {!isExpired && isEndingSoon && (
                <div className="absolute top-0 right-0 px-2 py-0.5 rounded-bl-lg bg-orange-500/20 text-orange-400 border-b border-l border-orange-500/20 flex items-center gap-1 text-[10px] font-bold z-10">
                    <Clock className="w-3 h-3" /> ENDING SOON
                </div>
            )}

            {!isExpired && !isEndingSoon && isHot && (
                 <div className="absolute top-0 right-0 px-2 py-0.5 rounded-bl-lg bg-retro-red/20 text-retro-red border-b border-l border-retro-red/20 flex items-center gap-1 text-[10px] font-bold z-10">
                    <Flame className="w-3 h-3" /> HOT
                </div>
            )}

            {m.resolved && (
                <div className={`absolute top-0 right-0 px-3 py-1 font-bold font-mono text-xs uppercase tracking-wider flex items-center gap-1 z-20 shadow-lg ${
                    m.isVoid 
                        ? 'bg-gray-800 text-gray-400 border-b border-l border-gray-700 rounded-bl-xl' 
                        : m.resultUp 
                            ? 'bg-retro-green text-black border-b border-l border-retro-green rounded-bl-xl' 
                            : 'bg-retro-red text-white border-b border-l border-retro-red rounded-bl-xl'
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
                        <CryptoIcon symbol={m.pairName} size={28} />
                        <CardTitle className="text-xl font-bold bg-clip-text text-transparent bg-linear-to-r from-foreground to-muted-foreground">
                            {m.pairName}
                        </CardTitle>
                        <span className="text-[10px] font-mono text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded opacity-50 hover:opacity-100 transition-opacity cursor-help" title={`Market ID: ${market.publicKey.toString()}`}>
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
                <div className="flex justify-between text-xs mb-4 bg-muted/50 p-2 rounded border border-border">
                    <div className="text-center">
                        <div className="text-muted-foreground">Strike Price</div>
                        <p className="text-foreground font-mono">
                            {formatPythPrice(m.initialPrice)}
                        </p>
                    </div>
                    {!isExpired && (
                        <div className="text-center">
                            <div className="text-muted-foreground">Current Price</div>
                            <div className={`font-mono flex items-center gap-1 ${
                                currentPrice && m.initialPrice ? (currentPrice > (m.initialPrice.toNumber() / 100000000) ? 'text-retro-green' : 'text-retro-red') : 'text-muted-foreground'
                            }`}>
                                {currentPrice ? (
                                    <>
                                        {formatCurrency(currentPrice)}
                                        {priceDirection === 'up' && <ArrowUp className="w-3 h-3 animate-bounce" />}
                                        {priceDirection === 'down' && <ArrowDown className="w-3 h-3 animate-bounce" />}
                                    </>
                                ) : "Loading..."}
                            </div>
                        </div>
                    )}
                    {m.resolved && (
                        <div className="text-center">
                            <div className="text-muted-foreground">Settlement</div>
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
                             <div className="bg-card rounded-lg p-3 border border-border text-sm">
                                <div className="text-muted-foreground text-xs mb-2 text-center uppercase tracking-wide">Position Summary</div>
                                {/* UP ROW */}
                                <div className="flex justify-between items-center mb-1">
                                    <div className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-retro-green"></span>
                                        <span className="text-retro-green font-bold">UP</span>
                                    </div>
                                    <div className={m.resultUp ? "text-retro-green font-bold" : "text-muted-foreground"}>
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
                                    <div className={!m.resultUp ? "text-retro-green font-bold" : "text-muted-foreground"}>
                                        ${(userBet.account.amountDown.toNumber() / 1_000_000).toFixed(2)}
                                        {!m.resultUp ? " (WON)" : " (LOST)"}
                                    </div>
                                </div>
                                {/* TOTAL PAYOUT */}
                                <div className="border-t border-border pt-2 flex justify-between items-center">
                                    <span className="text-muted-foreground font-bold">Total Payout:</span>
                                    <span className="text-yellow-400 font-mono font-bold text-lg">
                                        ✨ ${estimatedPayout.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        ) : (
                             <>
                                {isWinner && (
                                    <div className="w-full py-3 bg-linear-to-r from-retro-green/10 via-retro-green/20 to-retro-green/10 border border-retro-green/50 text-retro-green text-center font-bold tracking-wider rounded uppercase animate-pulse shadow-[0_0_15px_rgba(34,197,94,0.2)] flex items-center justify-center gap-2">
                                        <Trophy className="w-5 h-5" /> You Won!
                                    </div>
                                )}
                                {isLoser && (
                                    <div className="w-full py-3 bg-red-500/5 border border-red-500/20 text-red-500 text-center font-bold tracking-wider rounded uppercase flex items-center justify-center gap-2">
                                        You Lost
                                    </div>
                                )}
                            </>
                        )}
                        {isRefund && (
                            <div className="w-full py-3 bg-linear-to-r from-yellow-500/10 via-yellow-500/20 to-yellow-500/10 border border-yellow-500/50 text-yellow-500 text-center font-bold tracking-wider rounded uppercase flex items-center justify-center gap-2">
                                <ArrowPathIcon className="w-5 h-5" /> Market Refunded
                            </div>
                        )}
                    </div>
                 )}

                <div className="flex justify-between mb-6 text-sm">
                    <div className="text-center">
                        <div className="text-muted-foreground mb-1">Pool UP</div>
                        <div className="text-retro-green font-mono text-lg">${totalUp.toFixed(2)}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-muted-foreground mb-1">Pool DOWN</div>
                        <div className="text-retro-red font-mono text-lg">${totalDown.toFixed(2)}</div>
                    </div>
                </div>

                <div className="space-y-3">
                     {!isExpired && (
                        <>
                             {/* Amount Input */}
                            <InputGroup className="bg-secondary/20 border border-border rounded-lg mb-3">
                                <InputGroupAddon align="inline-start">
                                    <InputGroupText className="text-muted-foreground">$</InputGroupText>
                                </InputGroupAddon>
                                <InputGroupInput
                                    type="text"
                                    inputMode="decimal"
                                    value={betAmount}
                                    onChange={handleBetInputChange}
                                    onKeyDown={handleBetKeyDown}
                                    className="text-right font-mono pb-2 text-foreground placeholder:text-muted-foreground focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 border-none outline-none shadow-none bg-transparent"
                                    placeholder="Enter amount"
                                />
                                <InputGroupAddon align="inline-end">
                                    <InputGroupText className="text-muted-foreground">USDC</InputGroupText>
                                </InputGroupAddon>
                            </InputGroup>

                            {/* Quick Select Presets */}
                            <div className="flex gap-2 mb-4">
                                {BET_PRESETS.map((preset) => (
                                    <Button
                                        key={preset}
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handlePresetClick(preset)}
                                        className={`flex-1 text-xs font-mono h-8 border-none cursor-pointer transition-all ${
                                            selectedPreset === preset
                                                ? "bg-secondary text-secondary-foreground font-bold"
                                                : "bg-secondary/30 text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
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
                                    className="bg-retro-green text-black font-bold hover:bg-retro-green/90 transition-all cursor-pointer border-none h-12 text-lg"
                                >
                                     {placingBet ? <ArrowPathIcon className="w-5 h-5 animate-spin mx-auto" /> : "BET UP"}
                                </Button>
                                <Button
                                    onClick={() => placeBet(false)}
                                    disabled={isExpired || placingBet || !isBetValid}
                                    className="bg-retro-red text-white font-bold hover:bg-retro-red/90 transition-all cursor-pointer border-none h-12 text-lg"
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
                            className={`w-full h-14 text-lg font-bold shadow-lg transition-all hover:scale-[1.02] cursor-pointer border-none ${
                                m.isVoid 
                                ? "bg-linear-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-white shadow-orange-500/20" 
                                : "bg-linear-to-r from-retro-green via-green-400 to-retro-green hover:from-green-400 hover:via-retro-green hover:to-green-400 text-black shadow-retro-green/30 animate-pulse"
                            }`}
                        >
                            {claiming ? (
                                <ArrowPathIcon className="w-6 h-6 animate-spin" /> 
                            ) : (
                                <div className="flex flex-col items-center leading-tight">
                                    <span className="uppercase tracking-widest">{m.isVoid ? "CLAIM REFUND" : "CLAIM WINNINGS"}</span>
                                    {!m.isVoid && <span className="text-xs opacity-80 font-normal">Total: ${estimatedPayout.toFixed(2)}</span>}
                                </div>
                            )}
                        </Button>
                    )}


                    {(hasWon && (userBet.account.claimed || localClaimed)) && (() => {
                        if (m.isVoid) {
                            return (
                                <div className="w-full py-2 bg-secondary/10 border border-dashed border-gray-700 rounded-lg text-center">
                                    <span className="text-gray-500 flex items-center justify-center gap-2 text-sm">
                                        <Check className="w-4 h-4" /> Refund Claimed
                                    </span>
                                </div>
                            );
                        }
                        
                        const totalBetUSDC = userTotalBet / 1_000_000;
                        const profit = estimatedPayout - totalBetUSDC;
                        const profitPercentage = totalBetUSDC > 0 ? ((profit / totalBetUSDC) * 100) : 0;
                        
                        return (
                            <div className="w-full py-3 bg-retro-green/5 border border-dashed border-retro-green/30 rounded-lg text-center">
                                <div className="text-retro-green font-bold flex items-center justify-center gap-2 mb-1">
                                    <Check className="w-5 h-5" /> Claimed: ${estimatedPayout.toFixed(2)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    Profit: <span className="text-retro-green">+${profit.toFixed(2)} (+{profitPercentage.toFixed(1)}%)</span>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </CardContent>
        </Card>
    );
}

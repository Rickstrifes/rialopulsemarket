"use client";

import { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { getProgram } from "@/utils/anchor";
import { USDC_MINT } from "@/utils/constants";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import { ASSET_PAIRS } from "@/utils/pyth";
import { formatCurrency } from "@/utils/formatting";

import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { formatDistanceToNow } from "date-fns";
import toast from "react-hot-toast";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function CreateMarket() {
    const { connection } = useConnection();
    const wallet = useWallet();
    const [loading, setLoading] = useState(false);
    const [selectedPair, setSelectedPair] = useState(ASSET_PAIRS[0]);
    const [selectedPreset, setSelectedPreset] = useState<number | null>(60); // Default to 1h

    // Default to 1 hour from now
    const [selectedDate, setSelectedDate] = useState<Date>(new Date(Date.now() + 60 * 60 * 1000));
    const [countdown, setCountdown] = useState<string>("");

    const [previewPrice, setPreviewPrice] = useState<number | null>(null);
    const [fetchingPrice, setFetchingPrice] = useState(false);

    // Live Price Watcher
    useEffect(() => {
        const fetchPreviewPrice = async () => {
            setFetchingPrice(true);
            try {
                const response = await fetch(`https://hermes.pyth.network/v2/updates/price/latest?ids[]=${selectedPair.id}`);
                const data = await response.json();
                if (data && data.parsed && data.parsed.length > 0) {
                    const priceData = data.parsed[0].price;
                    const priceVal = parseFloat(priceData.price) * Math.pow(10, priceData.expo);
                    setPreviewPrice(priceVal);
                } else {
                    setPreviewPrice(null);
                }
            } catch (err) {
                console.error("Preview price fetch error:", err);
                setPreviewPrice(null);
            } finally {
                setFetchingPrice(false);
            }
        };

        fetchPreviewPrice();
        const interval = setInterval(fetchPreviewPrice, 10000);
        return () => clearInterval(interval);
    }, [selectedPair]);

    // Countdown Timer
    useEffect(() => {
        const updateCountdown = () => {
            if (selectedDate > new Date()) {
                setCountdown(formatDistanceToNow(selectedDate, { addSuffix: false }));
            } else {
                setCountdown("Expired");
            }
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000); // 1s
        return () => clearInterval(interval);
    }, [selectedDate]);

    const handlePreset = (minutes: number) => {
        setSelectedDate(new Date(Date.now() + minutes * 60 * 1000));
        setSelectedPreset(minutes);
    };

    const createMarket = async () => {
        if (!wallet.publicKey) {
            toast.error("Please connect your wallet first.");
            return;
        }
        if (previewPrice === null) {
            toast.error("Waiting for price data...");
            return;
        }

        if (selectedDate.getTime() / 1000 <= Math.floor(Date.now() / 1000)) {
            toast.error("Market end time must be in the future.");
            return;
        }

        setLoading(true);
        const toastId = toast.loading("Initializing market on Solana...");

        try {
            // @ts-ignore
            const program = getProgram(connection, wallet) as any;

            const marketKeypair = anchor.web3.Keypair.generate();

            const [vaultTokenAccount] = PublicKey.findProgramAddressSync(
                [Buffer.from("vault"), marketKeypair.publicKey.toBuffer()],
                program.programId
            );

            // End time in seconds (Unix Timestamp)
            const endTime = Math.floor(selectedDate.getTime() / 1000);

            // Use the ALREADY FETCHED preview price
            // Convert to 8 decimals for contract (i64)
            const rawPrice = Math.floor(previewPrice * 100_000_000);
            const manualPriceBN = new anchor.BN(rawPrice);

            console.log(`Creating Market for ${selectedPair.name} at Strike Price: ${previewPrice}`);

            const tx = await program.methods.initializeMarket(
                selectedPair.name,
                new anchor.BN(endTime),
                300, // fee_bps: 3%
                manualPriceBN // manual_price
            )
                .accounts({
                    market: marketKeypair.publicKey,
                    tokenMint: USDC_MINT,
                    vaultTokenAccount: vaultTokenAccount,
                    signer: wallet.publicKey,
                    systemProgram: SystemProgram.programId,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    rent: SYSVAR_RENT_PUBKEY,
                })
                .signers([marketKeypair])
                .rpc();

            console.log("Market initialized:", tx);
            toast.success("Market initialized successfully.", { id: toastId });
        } catch (error: any) {
            console.error(error);
            const msg = error.message || error.toString();
            // Suppress overlay for common user rejections if desired, 
            // but for now just show valid toast error.

            // Check for user rejection
            if (msg.includes("User rejected")) {
                toast.error("Transaction cancelled.", { id: toastId });
            } else {
                toast.error("Failed to initialize market.", { id: toastId });
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="glass-panel border-secondary/30">
            <CardHeader>
                <CardTitle className="text-xl font-bold text-secondary">
                    Create Market
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label className="mb-2 block">Asset Pair</Label>
                        <Select
                            value={selectedPair.name}
                            onValueChange={(val) => {
                                const pair = ASSET_PAIRS.find(p => p.name === val);
                                if (pair) {
                                    setSelectedPair(pair);
                                    setPreviewPrice(null); // Reset while fetching new pair
                                }
                            }}
                        >
                            <SelectTrigger className="w-full bg-[#13141f] border-gray-700 text-white">
                                <SelectValue placeholder="Select Pair" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#13141f] border-gray-700 text-white">
                                {ASSET_PAIRS.map((pair) => (
                                    <SelectItem key={pair.id} value={pair.name} className="focus:bg-gray-800 focus:text-white cursor-pointer">
                                        {pair.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Strike Price Preview Dashboard */}
                    <div className="bg-black/40 border border-gray-800 rounded-lg p-3 flex justify-between items-center">
                        <span className="text-sm text-gray-400">Starting Strike Price</span>
                        <div className="text-right min-w-[120px] min-h-[3rem] flex flex-col justify-center">
                            {fetchingPrice ? (
                                <span className="text-xs text-yellow-500 animate-pulse ml-auto">Scanning...</span>
                            ) : (
                                <div className="flex flex-col items-end">
                                    <span className={`text-lg font-mono tabular-nums font-bold ${previewPrice ? 'text-retro-green' : 'text-gray-500'}`}>
                                        {formatCurrency(previewPrice)}
                                    </span>
                                    <span className="text-[10px] text-gray-600 uppercase tracking-wider">LIVE DATA</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-4 space-y-4">
                        <div>
                            <Label className="block mb-2">Market Duration</Label>
                            <div className="w-full relative">
                                <DatePicker
                                    selected={selectedDate}
                                    onChange={(date: Date | null) => {
                                        if (date) {
                                            setSelectedDate(date);
                                            setSelectedPreset(null);
                                        }
                                    }}
                                    showTimeSelect
                                    timeFormat="HH:mm"
                                    timeIntervals={15}
                                    dateFormat="MMM d, yyyy - h:mm aa"
                                    minDate={new Date()}
                                    // If selected day is today, restrict time to now. Else, allow all day.
                                    minTime={
                                        selectedDate && selectedDate.toDateString() === new Date().toDateString()
                                            ? new Date()
                                            : new Date(new Date().setHours(0, 0, 0, 0))
                                    }
                                    maxTime={new Date(new Date().setHours(23, 59, 59, 999))}
                                    className="w-full bg-black/40 border border-gray-700 rounded-lg p-2 text-white focus:border-secondary outline-none font-mono cursor-pointer caret-transparent h-10 text-sm"
                                    wrapperClassName="w-full"
                                    placeholderText="Select Market End Time"
                                    onKeyDown={(e) => e.preventDefault()}
                                    autoComplete="off"
                                />
                            </div>
                        </div>

                        {/* Duration Presets */}
                        <div className="grid grid-cols-6 gap-2">
                            {[
                                { label: "1m", val: 1 },
                                { label: "5m", val: 5 },
                                { label: "15m", val: 15 },
                                { label: "1h", val: 60 },
                                { label: "4h", val: 240 },
                                { label: "1d", val: 1440 },
                            ].map((preset) => (
                                <Button
                                    key={preset.label}
                                    variant={selectedPreset === preset.val ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => handlePreset(preset.val)}
                                    className={`h-8 text-xs border cursor-pointer ${selectedPreset === preset.val 
                                        ? "bg-retro-green text-black border-retro-green hover:bg-retro-green/90 font-bold" 
                                        : "bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700 hover:text-white"}`}
                                >
                                    {preset.label}
                                </Button>
                            ))}
                        </div>

                        {/* Countdown Preview */}
                        <div className="flex justify-between items-center text-xs p-3 bg-primary/10 rounded-lg border border-primary/20">
                            <span className="text-gray-400">Duration Breakdown:</span>
                            <div className="text-right">
                                <div className="text-gray-500 mb-1">Closes in:</div>
                                <div className={`font-mono font-bold ${selectedDate <= new Date() ? 'text-retro-red' : 'text-secondary'}`}>
                                    {selectedDate <= new Date() ? "Invalid Time" : countdown}
                                </div>
                            </div>
                        </div>
                    </div>

                    <Button
                        onClick={createMarket}
                        disabled={!wallet.publicKey || loading || !previewPrice}
                        className="w-full font-bold mt-4 cursor-pointer"
                        variant="secondary"
                        size="lg"
                    >
                        {loading ? "Creating..." : "Initialize Market"}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

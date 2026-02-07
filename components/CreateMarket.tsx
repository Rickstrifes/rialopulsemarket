"use client";

import { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { getProgram } from "@/utils/anchor";
import { USDC_MINT, ORACLE_PUBKEY } from "@/utils/constants";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import { ASSET_PAIRS } from "@/utils/pyth";
import { formatCurrency } from "@/utils/formatting";

import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { formatDistanceToNow } from "date-fns";
import toast from "react-hot-toast";

export default function CreateMarket() {
    const { connection } = useConnection();
    const wallet = useWallet();
    const [loading, setLoading] = useState(false);
    const [selectedPair, setSelectedPair] = useState(ASSET_PAIRS[0]);

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
        <div className="p-6 rounded-xl glass-panel border-secondary/30 border">
            <h2 className="text-xl font-bold mb-4 text-secondary neon-text">
                Create Market
            </h2>

            <div className="space-y-4">
                <label className="block text-sm text-gray-400 mb-1">Asset Pair</label>
                <select
                    value={selectedPair.name}
                    onChange={(e) => {
                        const pair = ASSET_PAIRS.find(p => p.name === e.target.value);
                        if (pair) {
                            setSelectedPair(pair);
                            setPreviewPrice(null); // Reset while fetching new pair
                        }
                    }}
                    className="w-full bg-[#13141f] border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all shadow-inner"
                >
                    {ASSET_PAIRS.map((pair) => (
                        <option key={pair.id} value={pair.name} className="bg-[#13141f] text-white py-2">
                            {pair.name}
                        </option>
                    ))}
                </select>

                {/* Strike Price Preview Dashboard */}
                <div className="bg-black/40 border border-gray-800 rounded-lg p-3 flex justify-between items-center">
                    <span className="text-sm text-gray-400">Starting Strike Price</span>
                    <div className="text-right min-w-[120px] min-h-[3rem] flex flex-col justify-center">
                        {fetchingPrice ? (
                            <span className="text-xs text-yellow-500 animate-pulse ml-auto">Scanning...</span>
                        ) : (
                            <div className="flex flex-col items-end">
                                <span className={`text-lg font-mono tabular-nums font-bold ${previewPrice ? 'text-green-400' : 'text-gray-500'}`}>
                                    {formatCurrency(previewPrice)}
                                </span>
                                <span className="text-[10px] text-gray-600 uppercase tracking-wider">LIVE DATA</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-4 space-y-4">
                <div>
                    <label className="block text-sm text-gray-400 mb-2">Market Duration</label>
                    <div className="w-full relative">
                        <DatePicker
                            selected={selectedDate}
                            onChange={(date: Date | null) => date && setSelectedDate(date)}
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
                            className="w-full bg-black/40 border border-gray-700 rounded-lg p-3 text-white focus:border-secondary outline-none font-mono cursor-pointer caret-transparent"
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
                        <button
                            key={preset.label}
                            onClick={() => handlePreset(preset.val)}
                            className="bg-gray-800 hover:bg-gray-700 hover:text-white text-gray-400 text-xs py-2 rounded border border-gray-700 transition-colors"
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>

                {/* Countdown Preview */}
                <div className="flex justify-between items-center text-xs p-3 bg-primary/10 rounded-lg border border-primary/20">
                    <span className="text-gray-400">Duration Breakdown:</span>
                    <div className="text-right">
                        <div className="text-gray-500 mb-1">Closes in:</div>
                        <div className={`font-mono font-bold ${selectedDate <= new Date() ? 'text-red-400' : 'text-secondary'}`}>
                            {selectedDate <= new Date() ? "Invalid Time" : countdown}
                        </div>
                    </div>
                </div>
            </div>

            <button
                onClick={createMarket}
                disabled={!wallet.publicKey || loading || !previewPrice}
                className="w-full py-3 bg-secondary/20 hover:bg-secondary/30 border border-secondary/50 text-secondary font-bold rounded-lg transition-all mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading ? "Creating..." : "Initialize Market"}
            </button>
        </div>
    );
}

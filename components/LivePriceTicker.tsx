"use client";

import { useEffect, useState } from "react";
import { ASSET_PAIRS } from "@/utils/pyth";
import { formatCurrency } from "@/utils/formatting";

export default function LivePriceTicker() {
    const [prices, setPrices] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);

    const fetchPrices = async () => {
        try {
            // Construct query parameters for all assets
            const queryParams = ASSET_PAIRS.map(pair => `ids[]=${pair.id}`).join("&");
            const response = await fetch(`https://hermes.pyth.network/v2/updates/price/latest?${queryParams}`);
            const data = await response.json();

            if (data && data.parsed && data.parsed.length > 0) {
                const newPrices: Record<string, number> = {};
                data.parsed.forEach((item: any) => {
                    const priceData = item.price;
                    const val = parseFloat(priceData.price) * Math.pow(10, priceData.expo);

                    // Find matching asset name by ID
                    // Note: Pyth returns IDs with '0x' prefix usually, but let's match carefully
                    // The Item ID from response usually matches the requested ID.
                    const asset = ASSET_PAIRS.find(p => p.id === `0x${item.id}` || p.id === item.id);
                    if (asset) {
                        newPrices[asset.name] = val;
                    }
                });
                setPrices(newPrices);
            }
        } catch (error) {
            console.error("Error fetching Pyth prices:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPrices();
        const interval = setInterval(fetchPrices, 10000); // 10s poll to avoid rate limits with many assets
        return () => clearInterval(interval);
    }, []);

    if (loading) return <div className="text-gray-500 text-xs animate-pulse">Loading Market Data...</div>;

    return (
        <div className="md:w-full overflow-hidden relative bg-black/40 border border-white/10 backdrop-blur-md p-2 flex items-center">
            {/* Gradient Masks */}
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-black/80 to-transparent z-10 pointer-events-none"></div>
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-black/80 to-transparent z-10 pointer-events-none"></div>

            <div className="flex items-center space-x-6 animate-marquee whitespace-nowrap">
                {/* Duplicating array to ensure smooth seamless loop */}
                {[...ASSET_PAIRS, ...ASSET_PAIRS].map((asset, index) => {
                    const price = prices[asset.name];
                    return (
                        <div key={`${asset.name}-${index}`} className="flex items-center space-x-2">
                            <span className="text-xs text-gray-400 font-bold">{asset.name.split('/')[0]}</span>

                            <span className="text-xs font-mono tabular-nums font-bold text-primary">
                                {price ? formatCurrency(price) : "---"}
                            </span>
                        </div>
                    );
                })}
            </div>

            <style jsx>{`
                @keyframes marquee {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .animate-marquee {
                    animation: marquee 30s linear infinite;
                }
            `}</style>
        </div>
    );
}

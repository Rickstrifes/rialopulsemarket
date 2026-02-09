import Image from "next/image";

interface CryptoIconProps {
    symbol: string;
    size?: number;
    className?: string;
}

// Map pair names to cryptocurrency-icons symbols
const CRYPTO_SYMBOL_MAP: Record<string, string> = {
    "SOL": "sol",
    "BTC": "btc",
    "ETH": "eth",
    "BNB": "bnb",
    "SUI": "sui",
    "AVAX": "avax",
    "DOT": "dot",
    "XRP": "xrp",
    "ADA": "ada",
    "DOGE": "doge",
    "USD": "usd" // For display purposes
};

export default function CryptoIcon({ symbol, size = 24, className = "" }: CryptoIconProps) {
    // Extract base symbol (e.g., "SOL" from "SOL/USD")
    const baseSymbol = symbol.includes("/") ? symbol.split("/")[0] : symbol;
    const iconSymbol = CRYPTO_SYMBOL_MAP[baseSymbol] || baseSymbol.toLowerCase();
    
    // Use local SUI icon
    if (baseSymbol === "SUI") {
        return (
            <Image
                src="/sui.svg"
                alt="SUI"
                width={size}
                height={size}
                className={className}
            />
        );
    }
    
    return (
        <Image
            src={`https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/svg/color/${iconSymbol}.svg`}
            alt={baseSymbol}
            width={size}
            height={size}
            className={className}
            onError={(e) => {
                // Fallback to a generic icon if the specific one doesn't exist
                e.currentTarget.src = `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/svg/color/generic.svg`;
            }}
            unoptimized // Required for external images
        />
    );
}

"use client";

import { FC, ReactNode, useMemo } from "react";
import { ConnectionProvider } from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { UnifiedWalletProvider } from "@jup-ag/wallet-adapter";
import { HELIUS_RPC_URL } from "@/utils/constants";

export const WalletContextProvider: FC<{ children: ReactNode }> = ({ children }) => {
    // You can also provide a custom RPC endpoint.
    const endpoint = useMemo(() => HELIUS_RPC_URL, []);

    const wallets = useMemo(
        () => [
            new PhantomWalletAdapter(),
            new SolflareWalletAdapter(),
        ],
        []
    );

    return (
        <ConnectionProvider endpoint={endpoint}>
            <UnifiedWalletProvider
                wallets={wallets}
                config={{
                    autoConnect: true,
                    env: 'devnet',
                    metadata: {
                        name: 'Pulse',
                        description: 'Predict the Future on Solana',
                        url: 'https://pulse.markets',
                        iconUrls: ['https://avatars.githubusercontent.com/u/124594214?s=200&v=4'],
                    },
                    theme: 'dark',
                }}
            >
                {children}
            </UnifiedWalletProvider>
        </ConnectionProvider>
    );
};

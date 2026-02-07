export const ASSET_PAIRS = [
    { name: "SOL/USD", id: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d" },
    { name: "BTC/USD", id: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43" },
    { name: "ETH/USD", id: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace" },
    { name: "BNB/USD", id: "0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f" },
    { name: "SUI/USD", id: "0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744" },
    { name: "AVAX/USD", id: "0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7" },
    { name: "DOT/USD", id: "0xca3eed9b267293f6595901c734c7525ce8ef49adafe8284606ceb307afa2ca5b" },
    { name: "XRP/USD", id: "0xec5d399846a9209f3fe5881d70aae9268c94339ff9817e8d18ff19fa05eea1c8" },
    { name: "ADA/USD", id: "0x2a01deaec9e51a579277b34b122399984d0bbf57e2458a7e42fecd2829867a0d" },
    { name: "DOGE/USD", id: "0xdcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c" }
];

export const getPythId = (pairName: string): string | undefined => {
    return ASSET_PAIRS.find((p) => p.name === pairName)?.id;
};

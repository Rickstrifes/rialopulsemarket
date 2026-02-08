
import toast from "react-hot-toast";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";

/**
 * Shows a custom success toast for placed bets
 * @param txSignature The transaction signature to link to Solscan
 */
export const showBetSuccessToast = (txSignature: string) => {
    const shortTx = `${txSignature.slice(0, 4)}...${txSignature.slice(-4)}`;
    const explorerUrl = `https://solscan.io/tx/${txSignature}?cluster=devnet`;

    toast.custom((t) => (
        <div
            className={`${t.visible ? 'animate-enter' : 'animate-leave'
                } max-w-md w-full bg-[#13141f] border border-green-500/30 shadow-lg shadow-green-500/10 rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
        >
            <div className="flex-1 w-0 p-4">
                <div className="flex items-start">
                    <div className="flex-shrink-0 pt-0.5">
                        <CheckCircleIcon className="h-10 w-10 text-green-500" />
                    </div>
                    <div className="ml-3 flex-1">
                        <p className="text-sm font-medium text-white">
                            Bet Placed Successfully!
                        </p>
                        <p className="mt-1 text-sm text-gray-400">
                            Transaction confirmed on Solana.
                        </p>
                        <div className="mt-2 text-sm text-green-400">
                            <a
                                href={explorerUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 hover:text-green-300 transition-colors font-mono underline decoration-green-500/30 underline-offset-2"
                            >
                                Tx: {shortTx}
                                <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                            </a>
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex border-l border-gray-800">
                <button
                    onClick={() => toast.dismiss(t.id)}
                    className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-gray-400 hover:text-white focus:outline-none"
                >
                    Close
                </button>
            </div>
        </div>
    ), {
        duration: 5000,
        position: "bottom-right",
    });
};

/**
 * Helper for generic success/error if needed, though react-hot-toast has built-ins.
 * This ensures consistent styling if we want to wrap them later.
 */
export const notify = {
    success: (msg: string) => toast.success(msg, {
        style: {
            background: "#13141f",
            color: "#fff",
            border: "1px solid rgba(34, 197, 94, 0.3)", // Green border
        },
        iconTheme: {
            primary: "#22c55e",
            secondary: "#13141f",
        }
    }),
    error: (msg: string) => toast.error(msg, {
        style: {
            background: "#13141f",
            color: "#fff",
            border: "1px solid rgba(239, 68, 68, 0.3)", // Red border
        },
        iconTheme: {
            primary: "#ef4444",
            secondary: "#13141f",
        }
    })
};

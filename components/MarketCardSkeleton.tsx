import { Skeleton } from "@/components/ui/skeleton";

export default function MarketCardSkeleton() {
    return (
        <div className="glass-panel border-border/30 rounded-xl p-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-5 w-20" />
            </div>

            {/* Price */}
            <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-40" />
            </div>

            {/* Pool Info */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-5 w-24" />
                </div>
                <div className="space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-5 w-28" />
                </div>
            </div>

            {/* Buttons */}
            <div className="grid grid-cols-2 gap-3 mt-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
        </div>
    );
}

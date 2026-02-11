import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingHero() {
  return (
    <div className="relative overflow-hidden py-20 sm:py-32 lg:pb-32 xl:pb-36 text-center">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl bg-clip-text text-transparent bg-linear-to-b from-primary to-primary/60">
            Predict the Future on <span className="text-white">Pulse</span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-primary/80">
            The decentralized prediction market built on Solana. Trade on real-world events with minimal fees and instant settlement.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link href="/markets">
              <Button size="lg" className="text-lg px-8 py-6 rounded-full bg-primary hover:bg-primary/90 text-background font-bold shadow-[0_0_20px_rgba(232,227,213,0.3)] hover:shadow-[0_0_30px_rgba(232,227,213,0.5)] transition-all duration-300">
                Launch App
              </Button>
            </Link>
          </div>
        </div>
      </div>
      
      {/* Background Elements */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-linear-to-r from-primary to-primary/50 rounded-full blur-[100px] animate-pulse-slow"></div>
      </div>
    </div>
  );
}

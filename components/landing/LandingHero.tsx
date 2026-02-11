import Link from "next/link";
import Image from "next/image";
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
              <Button size="lg" className="cursor-pointer text-lg text-primary hover:text-black px-8 py-6 rounded-full
               bg-black border-primary hover:border-black border-3 hover:bg-primary/90 
               font-bold shadow-[0_0_20px_rgba(232,227,213,0.3)] hover:shadow-[0_0_30px_rgba(232,227,213,0.5)] transition-all duration-300">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </div>
      
      {/* Background Elements */}
      <div className="absolute inset-0 -z-10 opacity-30 select-none pointer-events-none">
        <Image
          src="/banner.svg"
          alt="Pulse Banner"
          fill
          className="object-cover object-center"
          priority
        />
        <div className="absolute inset-0 bg-linear-to-b from-background/80 via-transparent to-background/80" />
      </div>
    </div>
  );
}

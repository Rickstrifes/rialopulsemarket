import CreateMarket from "@/components/CreateMarket";
import MarketList from "@/components/MarketList";

export default function Home() {
  return (
    <div className="min-h-screen space-y-8">
      {/* Navbar handles the Ticker now */}
      <div className="max-w-7xl mx-auto px-4 space-y-12 pb-20 pt-8">

        {/* Top Section: Create Market */}
        <section className="flex justify-center mt-8">
          <div className="w-full max-w-2xl relative z-10">
            <CreateMarket />
          </div>
        </section>

        {/* Market List */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-8 bg-secondary rounded-full shadow-[0_0_10px_#a855f7]" />
            <h2 className="text-2xl font-bold text-white">Active Markets</h2>
          </div>
          <MarketList />
        </section>
      </div>
    </div>
  );
}

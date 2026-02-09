import MarketList from "@/components/MarketList";
import LivePriceTicker from "@/components/LivePriceTicker";

export default function Home() {
  return (
    <div className="min-h-screen space-y-8 text-white">
      <div className="max-w-7xl mx-auto px-4 space-y-12 pb-20 pt-8">
        {/* Market List */}
        <section className="space-y-6">
          <div className="max-w-full my-5 mx-auto px-4">
            <LivePriceTicker />
          </div>
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-2xl font-bold text-white">Markets</h2>
          </div>
          <MarketList />
        </section>
      </div>
    </div>
  );
}

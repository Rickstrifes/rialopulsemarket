import LandingHero from "@/components/landing/LandingHero";
import LandingFeatures from "@/components/landing/LandingFeatures";

export default function Home() {
  return (
    <div className="min-h-screen">
      <LandingHero />
      <LandingFeatures />
    </div>
  );
}

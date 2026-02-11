import { Zap, Shield, Globe } from "lucide-react";

const features = [
  {
    name: 'Instant Settlement',
    description: 'Trades are settled instantly on the Solana blockchain with sub-second finality.',
    icon: Zap,
  },
  {
    name: 'Decentralized & Secure',
    description: 'Your funds are always in your control. Smart contracts handle all market resolutions.',
    icon: Shield,
  },
  {
    name: 'Global Access',
    description: 'Access prediction markets from anywhere in the world without restrictions.',
    icon: Globe,
  },
];

export default function LandingFeatures() {
  return (
    <div className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:text-center">
          <h2 className="text-base font-semibold leading-7 text-primary">Why Pulse?</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Everything you need to trade events
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-400">
            Experience the future of prediction markets with our cutting-edge platform built for speed and reliability.
          </p>
        </div>
        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.name} className="flex flex-col bg-card/10 backdrop-blur-sm p-8 rounded-2xl border border-white/5 hover:border-primary/20 transition-all duration-300">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-white">
                  <feature.icon className="h-5 w-5 flex-none text-primary" aria-hidden="true" />
                  {feature.name}
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-400">
                  <p className="flex-auto">{feature.description}</p>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}

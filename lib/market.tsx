'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { INSTRUMENTS } from './instruments';
import { SimulatedBroker } from './broker/simulated';
import type { BrokerAdapter, Quote } from './broker/types';

// Swap this for a real platform adapter (e.g. new TradeLockerBroker(credentials)) once one exists.
const broker: BrokerAdapter = new SimulatedBroker();

interface Market {
  broker: BrokerAdapter;
  quotes: Record<string, Quote>;
}

const MarketContext = createContext<Market | null>(null);

export function MarketProvider({ children }: { children: ReactNode }) {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});

  useEffect(() => {
    return broker.subscribe(INSTRUMENTS.map(i => i.symbol), q => {
      setQuotes(prev => ({ ...prev, [q.symbol]: q }));
    });
  }, []);

  return <MarketContext.Provider value={{ broker, quotes }}>{children}</MarketContext.Provider>;
}

export function useMarket(): Market {
  const ctx = useContext(MarketContext);
  if (!ctx) throw new Error('useMarket must be used within MarketProvider');
  return ctx;
}

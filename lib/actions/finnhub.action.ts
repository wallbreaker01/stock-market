'use server';

import { getDateRange, validateArticle, formatArticle } from '@/lib/utils';
import { POPULAR_STOCK_SYMBOLS } from '@/lib/constants';
import { cache } from 'react';

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';
const NEXT_PUBLIC_FINNHUB_API_KEY = process.env.NEXT_PUBLIC_FINNHUB_API_KEY ?? '';

async function fetchJSON<T>(url: string, revalidateSeconds?: number, retries = 3): Promise<T> {
    const options: RequestInit & { next?: { revalidate?: number } } = revalidateSeconds
        ? { cache: 'force-cache', next: { revalidate: revalidateSeconds } }
        : { cache: 'no-store' };

    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const res = await fetch(url, options);
            if (!res.ok) {
                // Handle rate limiting with exponential backoff
                if (res.status === 429 && attempt < retries - 1) {
                    const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                const text = await res.text().catch(() => '');
                throw new Error(`Fetch failed ${res.status}: ${text}`);
            }
            return (await res.json()) as T;
        } catch (error) {
            if (attempt === retries - 1) throw error;
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    throw new Error('Max retries reached');
}

export { fetchJSON };

export async function getNews(symbols?: string[]): Promise<MarketNewsArticle[]> {
    try {
        const range = getDateRange(5);
        const token = process.env.FINNHUB_API_KEY ?? NEXT_PUBLIC_FINNHUB_API_KEY;
        if (!token) {
            throw new Error('FINNHUB API key is not configured');
        }
        const cleanSymbols = (symbols || [])
            .map((s) => s?.trim().toUpperCase())
            .filter((s): s is string => Boolean(s));

        const maxArticles = 6;

        // If we have symbols, try to fetch company news per symbol and round-robin select
        if (cleanSymbols.length > 0) {
            const perSymbolArticles: Record<string, RawNewsArticle[]> = {};

            await Promise.all(
                cleanSymbols.map(async (sym) => {
                    try {
                        const url = `${FINNHUB_BASE_URL}/company-news?symbol=${encodeURIComponent(sym)}&from=${range.from}&to=${range.to}&token=${token}`;
                        const articles = await fetchJSON<RawNewsArticle[]>(url, 300);
                        perSymbolArticles[sym] = (articles || []).filter(validateArticle);
                    } catch (e) {
                        console.error('Error fetching company news for', sym, e);
                        perSymbolArticles[sym] = [];
                    }
                })
            );

            const collected: MarketNewsArticle[] = [];
            // Round-robin up to 6 picks
            for (let round = 0; round < maxArticles; round++) {
                for (let i = 0; i < cleanSymbols.length; i++) {
                    const sym = cleanSymbols[i];
                    const list = perSymbolArticles[sym] || [];
                    if (list.length === 0) continue;
                    const article = list.shift();
                    if (!article || !validateArticle(article)) continue;
                    collected.push(formatArticle(article, true, sym, round));
                    if (collected.length >= maxArticles) break;
                }
                if (collected.length >= maxArticles) break;
            }

            if (collected.length > 0) {
                // Sort by datetime desc
                collected.sort((a, b) => (b.datetime || 0) - (a.datetime || 0));
                return collected.slice(0, maxArticles);
            }
            // If none collected, fall through to general news
        }

        // General market news fallback or when no symbols provided
        const generalUrl = `${FINNHUB_BASE_URL}/news?category=general&token=${token}`;
        const general = await fetchJSON<RawNewsArticle[]>(generalUrl, 300);

        const seen = new Set<string>();
        const unique: RawNewsArticle[] = [];
        for (const art of general || []) {
            if (!validateArticle(art)) continue;
            const key = `${art.id}-${art.url}-${art.headline}`;
            if (seen.has(key)) continue;
            seen.add(key);
            unique.push(art);
            if (unique.length >= 20) break; // cap early before final slicing
        }

        const formatted = unique.slice(0, maxArticles).map((a, idx) => formatArticle(a, false, undefined, idx));
        return formatted;
    } catch (err) {
        console.error('getNews error:', err);
        throw new Error('Failed to fetch news');
    }
}

export async function getWatchlistData(symbols: string[]): Promise<StockWithData[]> {
    try {
        const token = process.env.FINNHUB_API_KEY ?? NEXT_PUBLIC_FINNHUB_API_KEY;
        if (!token) {
            console.error('FINNHUB API key is not configured');
            return [];
        }

        if (!symbols || symbols.length === 0) return [];

        // Process symbols in smaller batches to avoid rate limits
        const batchSize = 5;
        const stocksData: (StockWithData | null)[] = [];

        for (let i = 0; i < symbols.length; i += batchSize) {
            const batch = symbols.slice(i, i + batchSize);
            
            const batchResults = await Promise.all(
                batch.map(async (symbol) => {
                    try {
                        // Use longer cache times to reduce API calls
                        const [quoteRes, profileRes, financialsRes] = await Promise.all([
                            fetchJSON<QuoteData>(`${FINNHUB_BASE_URL}/quote?symbol=${encodeURIComponent(symbol)}&token=${token}`, 300).catch(() => ({ c: 0, dp: 0 })),
                            fetchJSON<ProfileData>(`${FINNHUB_BASE_URL}/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${token}`, 7200).catch(() => ({ name: symbol, marketCapitalization: 0 })),
                            fetchJSON<FinancialsData>(`${FINNHUB_BASE_URL}/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${token}`, 7200).catch(() => ({ metric: {} })),
                        ]);

                        const currentPrice = quoteRes.c || 0;
                        const changePercent = quoteRes.dp || 0;
                        const company = profileRes.name || symbol;
                        const marketCapInMillions = profileRes.marketCapitalization || 0;
                        const metrics: Record<string, number> = (financialsRes.metric as Record<string, number>) || {};
                        const peRatio = metrics['peBasicExclExtraTTM'] || metrics['peNormalizedAnnual'] || 0;

                        // Format market cap
                        let marketCap = 'N/A';
                        if (marketCapInMillions >= 1000) {
                            marketCap = `$${(marketCapInMillions / 1000).toFixed(2)}T`;
                        } else if (marketCapInMillions >= 1) {
                            marketCap = `$${marketCapInMillions.toFixed(2)}B`;
                        }

                        const stockData: StockWithData = {
                            userId: '',
                            symbol,
                            company,
                            addedAt: new Date(),
                            currentPrice,
                            changePercent,
                            priceFormatted: currentPrice ? `$${currentPrice.toFixed(2)}` : 'N/A',
                            changeFormatted: `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`,
                            marketCap,
                            peRatio: peRatio ? peRatio.toFixed(1) : 'N/A',
                        };

                        return stockData;
                    } catch (e) {
                        console.error(`Error fetching data for ${symbol}:`, e);
                        // Return basic stock info even if API fails
                        return {
                            userId: '',
                            symbol,
                            company: symbol,
                            addedAt: new Date(),
                            currentPrice: 0,
                            changePercent: 0,
                            priceFormatted: 'N/A',
                            changeFormatted: 'N/A',
                            marketCap: 'N/A',
                            peRatio: 'N/A',
                        };
                    }
                })
            );

            stocksData.push(...batchResults);
            
            // Add a small delay between batches to avoid rate limiting
            if (i + batchSize < symbols.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        return stocksData.filter((stock): stock is StockWithData => stock !== null);
    } catch (err) {
        console.error('getWatchlistData error:', err);
        return [];
    }
}

type QuoteSnapshotData = QuoteData & {
    h?: number;
    l?: number;
    o?: number;
    pc?: number;
};

export type StockSnapshot = {
    symbol: string;
    price: number;
    changePercent: number;
    high: number;
    low: number;
    open: number;
    previousClose: number;
};

export async function getStockSnapshots(symbols: string[]): Promise<StockSnapshot[]> {
    try {
        const token = process.env.FINNHUB_API_KEY ?? NEXT_PUBLIC_FINNHUB_API_KEY;
        if (!token) {
            console.error('FINNHUB API key is not configured');
            return [];
        }

        if (!symbols || symbols.length === 0) return [];

        const batchSize = 8;
        const snapshots: StockSnapshot[] = [];

        for (let i = 0; i < symbols.length; i += batchSize) {
            const batch = symbols.slice(i, i + batchSize);
            const batchResults = await Promise.all(
                batch.map(async (symbol) => {
                    try {
                        const quote = await fetchJSON<QuoteSnapshotData>(
                            `${FINNHUB_BASE_URL}/quote?symbol=${encodeURIComponent(symbol)}&token=${token}`,
                            300
                        );

                        return {
                            symbol,
                            price: quote.c || 0,
                            changePercent: quote.dp || 0,
                            high: quote.h || 0,
                            low: quote.l || 0,
                            open: quote.o || 0,
                            previousClose: quote.pc || 0,
                        } as StockSnapshot;
                    } catch (e) {
                        console.error(`Error fetching quote for ${symbol}:`, e);
                        return null;
                    }
                })
            );

            batchResults.forEach((item) => {
                if (item) snapshots.push(item);
            });

            if (i + batchSize < symbols.length) {
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        }

        return snapshots;
    } catch (err) {
        console.error('getStockSnapshots error:', err);
        return [];
    }
}

export const searchStocks = cache(async (query?: string): Promise<StockWithWatchlistStatus[]> => {
    try {
        const token = process.env.FINNHUB_API_KEY ?? NEXT_PUBLIC_FINNHUB_API_KEY;
        if (!token) {
            // If no token, log and return empty to avoid throwing per requirements
            console.error('Error in stock search:', new Error('FINNHUB API key is not configured'));
            return [];
        }

        const trimmed = typeof query === 'string' ? query.trim() : '';

        let results: FinnhubSearchResult[] = [];

        if (!trimmed) {
            // Fetch top 10 popular symbols' profiles sequentially to avoid rate limits
            const top = POPULAR_STOCK_SYMBOLS.slice(0, 10);
            const profiles: { sym: string; profile: any }[] = [];
            
            for (const sym of top) {
                try {
                    const url = `${FINNHUB_BASE_URL}/stock/profile2?symbol=${encodeURIComponent(sym)}&token=${token}`;
                    // Revalidate every hour
                    const profile = await fetchJSON<any>(url, 3600);
                    profiles.push({ sym, profile });
                    // Small delay between requests to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (e: any) {
                    // Only log non-rate-limit errors
                    if (!e?.message?.includes('429')) {
                        console.error('Error fetching profile2 for', sym, e);
                    }
                    profiles.push({ sym, profile: null });
                }
            }

            results = profiles
                .map(({ sym, profile }) => {
                    const symbol = sym.toUpperCase();
                    const name: string | undefined = profile?.name || profile?.ticker || undefined;
                    const exchange: string | undefined = profile?.exchange || undefined;
                    if (!name) return undefined;
                    const r: FinnhubSearchResult = {
                        symbol,
                        description: name,
                        displaySymbol: symbol,
                        type: 'Common Stock',
                    };
                    // We don't include exchange in FinnhubSearchResult type, so carry via mapping later using profile
                    // To keep pipeline simple, attach exchange via closure map stage
                    // We'll reconstruct exchange when mapping to final type
                    (r as any).__exchange = exchange; // internal only
                    return r;
                })
                .filter((x): x is FinnhubSearchResult => Boolean(x));
        } else {
            const url = `${FINNHUB_BASE_URL}/search?q=${encodeURIComponent(trimmed)}&token=${token}`;
            const data = await fetchJSON<FinnhubSearchResponse>(url, 1800);
            results = Array.isArray(data?.result) ? data.result : [];
        }

        const mapped: StockWithWatchlistStatus[] = results
            .map((r) => {
                const upper = (r.symbol || '').toUpperCase();
                const name = r.description || upper;
                const exchangeFromDisplay = (r.displaySymbol as string | undefined) || undefined;
                const exchangeFromProfile = (r as any).__exchange as string | undefined;
                const exchange = exchangeFromDisplay || exchangeFromProfile || 'US';
                const type = r.type || 'Stock';
                const item: StockWithWatchlistStatus = {
                    symbol: upper,
                    name,
                    exchange,
                    type,
                    isInWatchlist: false,
                };
                return item;
            })
            .slice(0, 15);

        return mapped;
    } catch (err) {
        console.error('Error in stock search:', err);
        return [];
    }
});

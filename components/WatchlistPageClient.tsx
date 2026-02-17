'use client';

import WatchlistTable from '@/components/WatchlistTable';
import AddStockDialog from '@/components/AddStockDialog';
import { useState, useEffect } from 'react';
import { getWatchlistData } from '@/lib/actions/finnhub.action';
import { getWatchlistByUserId } from '@/lib/actions/watchlist.action';
import { getAlertSymbolsByUserId } from '@/lib/actions/alert.action';
import { Loader2 } from 'lucide-react';

export default function WatchlistPageClient({
    userId
}: {
    userId?: string;
}) {
    const [addStockOpen, setAddStockOpen] = useState(false);
    const [watchlistData, setWatchlistData] = useState<StockWithData[]>([]);
    const [loading, setLoading] = useState(true);
    const [alertSymbols, setAlertSymbols] = useState<string[]>([]);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        const fetchWatchlist = async () => {
            if (!userId) {
                setWatchlistData([]);
                setAlertSymbols([]);
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                // Get user's watchlist from database
                const userWatchlist = await getWatchlistByUserId(userId);

                if (userWatchlist.length === 0) {
                    setWatchlistData([]);
                    setAlertSymbols([]);
                    return;
                }

                // Get symbols from user's watchlist
                const symbols = userWatchlist.map(item => item.symbol);

                // Fetch real-time data for those symbols
                const data = await getWatchlistData(symbols);
                setWatchlistData(data);

                const alerts = await getAlertSymbolsByUserId(userId);
                setAlertSymbols(alerts);
            } catch (error) {
                console.error('Error fetching watchlist:', error);
                setWatchlistData([]);
                setAlertSymbols([]);
            } finally {
                setLoading(false);
            }
        };

        fetchWatchlist();
    }, [userId, refreshKey]);

    const refreshData = () => {
        setRefreshKey(prev => prev + 1);
    };

    if (loading) {
        return (
            <div className="container mx-auto py-10 px-4">
                <div className="flex items-center justify-center min-h-[400px]">
                    <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="container mx-auto py-10 px-4">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-3xl font-bold text-gray-100">Watchlist</h1>
                    <button
                        onClick={() => setAddStockOpen(true)}
                        className="px-4 py-2 bg-yellow-500 text-yellow-900 rounded-md font-medium hover:bg-yellow-400 transition-colors"
                    >
                        Add Stock
                    </button>
                </div>
                <WatchlistTable
                    data={watchlistData}
                    userId={userId}
                    onStockRemoved={refreshData}
                    onAlertUpdated={refreshData}
                    alertSymbols={alertSymbols}
                />
            </div>

            <AddStockDialog
                open={addStockOpen}
                setOpen={setAddStockOpen}
                userId={userId}
                onStockAdded={refreshData}
            />
        </>
    );
}

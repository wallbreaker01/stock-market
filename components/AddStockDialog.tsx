'use client';

import { useState, useEffect, useTransition } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Plus } from 'lucide-react';
import { searchStocks } from '@/lib/actions/finnhub.action';
import { addToWatchlist } from '@/lib/actions/watchlist.action';
import { toast } from 'sonner';

export default function AddStockDialog({ 
    open, 
    setOpen, 
    userId,
    onStockAdded 
}: { 
    open: boolean; 
    setOpen: (open: boolean) => void; 
    userId?: string;
    onStockAdded?: () => void;
}) {
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [stocks, setStocks] = useState<StockWithWatchlistStatus[]>([]);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        if (!open) {
            setSearchTerm('');
            setStocks([]);
        }
    }, [open]);

    useEffect(() => {
        const debounceTimer = setTimeout(() => {
            const fetchStocks = async () => {
                if (!searchTerm.trim()) {
                    // Fetch popular stocks when no search term
                    setLoading(true);
                    try {
                        const results = await searchStocks('');
                        setStocks(results);
                    } catch (error) {
                        setStocks([]);
                    } finally {
                        setLoading(false);
                    }
                    return;
                }

                setLoading(true);
                try {
                    const results = await searchStocks(searchTerm.trim());
                    setStocks(results);
                } catch (error) {
                    setStocks([]);
                } finally {
                    setLoading(false);
                }
            };

            if (open) {
                fetchStocks();
            }
        }, 500);

        return () => clearTimeout(debounceTimer);
    }, [searchTerm, open]);

    const handleAddStock = (stock: StockWithWatchlistStatus) => {
        if (!userId) {
            toast.error('Please sign in to add stocks');
            return;
        }

        startTransition(async () => {
            const result = await addToWatchlist(userId, stock.symbol, stock.name);
            if (result.success) {
                toast.success(result.message);
                setOpen(false);
                if (onStockAdded) onStockAdded();
            } else {
                toast.error(result.message);
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="bg-gray-900 border-gray-800 max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="text-gray-100">Add Stock to Watchlist</DialogTitle>
                    <DialogDescription className="text-gray-400">
                        Search for stocks and add them to your watchlist
                    </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                    <input
                        type="text"
                        placeholder="Search stocks by name or symbol..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-md text-gray-100 placeholder-gray-500 focus:outline-none focus:border-yellow-500"
                    />

                    <div className="max-h-[400px] overflow-y-auto space-y-2">
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                            </div>
                        ) : stocks.length === 0 ? (
                            <div className="text-center py-8 text-gray-400">
                                <p>No stocks found</p>
                            </div>
                        ) : (
                            stocks.map((stock) => (
                                <div
                                    key={stock.symbol}
                                    className="flex items-center justify-between p-3 bg-gray-800/50 rounded-md hover:bg-gray-800 transition-colors"
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-gray-100">{stock.symbol}</span>
                                            <span className="text-xs text-gray-500">{stock.exchange}</span>
                                        </div>
                                        <p className="text-sm text-gray-400 truncate">{stock.name}</p>
                                    </div>
                                    <button
                                        onClick={() => handleAddStock(stock)}
                                        disabled={isPending}
                                        className="flex items-center gap-1 px-3 py-1 bg-yellow-500 text-yellow-900 rounded text-sm hover:bg-yellow-400 transition-colors disabled:opacity-50"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Add
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

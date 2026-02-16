'use client';

import { useState, useEffect } from 'react';
import {
    CommandDialog,
    CommandEmpty,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import { Label } from 'radix-ui';
import { Button } from './ui/button';
import { Loader, Loader2, Star, TrendingUp } from 'lucide-react';
import { isSea } from 'node:sea';
import Link from 'next/link';
import { searchStocks } from '@/lib/actions/finnhub.action';
import { set } from 'mongoose';
import { useDebounce } from '@/hooks/useDebounce';

export default function SearchCommand({ renderAs = 'button', label = 'Add Stock', initialStocks }: SearchCommandProps) {
    const [open, setOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [stocks, setStocks] = useState<StockWithWatchlistStatus[]>(initialStocks);

    const isSearchMode = !!searchTerm.trim();
    const displayastocks = isSearchMode ? stocks : stocks.slice(0, 10);

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setOpen((prev) => !prev);
            }
        };

        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, []);

    const handleSearch = async () => {
        if (!searchTerm.trim()) return setStocks(initialStocks);

        setLoading(true);
        try {
            const results = await searchStocks(searchTerm.trim());
            setStocks(results);
        } catch (error) {
            setStocks([]);
        } finally {
            setLoading(false);
        }
    }

    const debouncedSearch = useDebounce(handleSearch, 300);

    useEffect(() => {
        debouncedSearch();
    }, [searchTerm]);

    const handleSelectStock = (symbol: string) => {
        setOpen(false);
        setSearchTerm('');
        setStocks(initialStocks);
    };

    return (
        <>
            {renderAs === 'text' ? (
                <span onClick={() => setOpen(true)} className="search-text">
                    {label}
                </span>
            ) : (
                <Button onClick={() => setOpen(true)} className="search-btn">
                    {label}
                </Button>
            )}

            <CommandDialog open={open} onOpenChange={setOpen} className='search-dialog'>
                <div className='search-field'>
                    <CommandInput placeholder="Search stocks..." value={searchTerm} onValueChange={setSearchTerm} disabled={loading} className='search-input' />
                    {loading && <Loader2 className='loading-spinner' />}
                </div>
                <CommandList className='search-list'>
                    {loading ? (
                        <CommandEmpty className='search-list-empty'>Loading stocks...</CommandEmpty>
                    ) : displayastocks?.length === 0 ? (
                        <div className='search-list-indicator'>
                            {isSearchMode ? 'No results found.' : 'No stocks available.'}
                        </div>
                    ) : (
                        <ul>
                            <div className='search-count'>
                                {isSearchMode ? 'Search Results' : 'Top Stocks'}
                                {` `}({displayastocks?.length || 0})
                            </div>
                            {displayastocks.map((stock, index) => (
                                <li key={stock.symbol} className='search-item'>
                                    <Link href={`/stocks/${stock.symbol}`} onClick={() => handleSelectStock(stock.symbol)} className='search-item-list'>
                                        <TrendingUp className='h-4 w-4 text-gray-500' />
                                        <div className='flex-1'>
                                            <div className='search-item-name'>
                                                {stock.name}
                                            </div>
                                            <div className='text-sm text-gray-500'>
                                                {stock.symbol} | {stock.exchange} | {stock.type}
                                            </div>
                                        </div>
                                    {/* <Star /> */}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </CommandList>
            </CommandDialog>
        </>
    );
}

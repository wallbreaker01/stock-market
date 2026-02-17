'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { WATCHLIST_TABLE_HEADER } from '@/lib/constants';
import { Star, Trash2 } from 'lucide-react';
import { useTransition } from 'react';
import { removeFromWatchlist } from '@/lib/actions/watchlist.action';
import { addAlert, removeAlert } from '@/lib/actions/alert.action';
import { toast } from 'sonner';

export default function WatchlistTable({
  data,
  userId,
  onStockRemoved,
  onAlertUpdated,
  alertSymbols,
}: {
  data: StockWithData[];
  userId?: string;
  onStockRemoved?: () => void;
  onAlertUpdated?: () => void;
  alertSymbols?: string[];
}) {
  const [isPending, startTransition] = useTransition();

  const handleRemove = (symbol: string) => {
    if (!userId) {
      toast.error('Please sign in to remove stocks');
      return;
    }

    startTransition(async () => {
      const result = await removeFromWatchlist(userId, symbol);
      if (result.success) {
        toast.success(result.message);
        if (onStockRemoved) onStockRemoved();
      } else {
        toast.error(result.message);
      }
    });
  };

  const handleAddAlert = (stock: StockWithData) => {
    if (!userId) {
      toast.error('Please sign in to enable alerts');
      return;
    }

    startTransition(async () => {
      const result = await addAlert(userId, stock.symbol, stock.company);
      if (result.success) {
        toast.success(result.message);
        if (onAlertUpdated) onAlertUpdated();
      } else {
        toast.error(result.message);
      }
    });
  };

  const handleRemoveAlert = (symbol: string) => {
    if (!userId) {
      toast.error('Please sign in to manage alerts');
      return;
    }

    startTransition(async () => {
      const result = await removeAlert(userId, symbol);
      if (result.success) {
        toast.success(result.message);
        if (onAlertUpdated) onAlertUpdated();
      } else {
        toast.error(result.message);
      }
    });
  };

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-lg">No stocks in your watchlist yet.</p>
        <p className="text-sm mt-2">Add stocks to start tracking them.</p>
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className="border-b border-gray-800 hover:bg-transparent">
            {WATCHLIST_TABLE_HEADER.map((header) => (
              <TableHead key={header} className="text-left text-gray-400 font-normal h-12">
                {header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, index) => {
            const isPositive = row.changePercent && row.changePercent >= 0;
            const changeColor = isPositive ? 'text-green-500' : 'text-red-500';
            const isAlertActive = (alertSymbols || []).includes(row.symbol);
            
            return (
              <TableRow key={index} className="border-b border-gray-800 hover:bg-gray-900/50">
                <TableCell className="text-left">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    <span>{row.company}</span>
                  </div>
                </TableCell>
                <TableCell className="text-left text-gray-300">{row.symbol}</TableCell>
                <TableCell className="text-left">{row.priceFormatted}</TableCell>
                <TableCell className={`text-left font-medium ${changeColor}`}>{row.changeFormatted}</TableCell>
                <TableCell className="text-left text-gray-300">{row.marketCap}</TableCell>
                <TableCell className="text-left text-gray-300">{row.peRatio}</TableCell>
                <TableCell className="text-left">
                  <div className="flex flex-col items-start gap-2">
                    <span
                      className={
                        isAlertActive
                          ? 'px-2 py-1 bg-green-900/30 text-green-400 rounded text-xs'
                          : 'px-2 py-1 bg-gray-800 text-gray-400 rounded text-xs'
                      }
                    >
                      {isAlertActive ? 'Active' : 'None'}
                    </span>
                    {isAlertActive ? (
                      <button
                        onClick={() => handleRemoveAlert(row.symbol)}
                        className="px-3 py-1 bg-red-900/30 text-red-400 rounded text-sm hover:bg-red-900/50 transition-colors disabled:opacity-50"
                        disabled={isPending}
                      >
                        Remove Alert
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAddAlert(row)}
                        className="px-3 py-1 bg-orange-900/40 text-orange-400 rounded text-sm hover:bg-orange-900/60 transition-colors disabled:opacity-50"
                        disabled={isPending}
                      >
                        Add Alert
                      </button>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-left">
                  <button
                    onClick={() => handleRemove(row.symbol)}
                    className="flex items-center gap-1 px-3 py-1 text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50"
                    disabled={isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove
                  </button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

    </>
  );
}

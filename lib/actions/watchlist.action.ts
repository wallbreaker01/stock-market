'use server';

import { connectToDatabase } from '@/database/mongoose';
import { Watchlist } from '@/database/models/watchlist.model';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { auth } from '@/lib/better-auth/auth';

/**
 * Retrieve all watchlist symbols for the user with the given email.
 *
 * Returns an array of symbol strings from the user's watchlist; returns an empty array when the `email` is falsy, no matching user is found, the user has no id, or an error occurs.
 *
 * @param email - The email address of the user whose watchlist symbols should be returned
 * @returns An array of watchlist symbol strings belonging to the specified user
 */
export async function getWatchlistSymbolsByEmail(email: string): Promise<string[]> {
    if (!email) return [];

    try {
        const mongoose = await connectToDatabase();
        const db = mongoose.connection.db;
        if (!db) throw new Error('MongoDB connection not found');

        // Better Auth stores users in the "user" collection
        const user = await db.collection('user').findOne<{ _id?: unknown; id?: string; email?: string }>({ email });

        if (!user) return [];

        const userId = (user.id as string) || String(user._id || '');
        if (!userId) return [];

        const items = await Watchlist.find({ userId }, { symbol: 1 }).lean();
        return items.map((i) => String(i.symbol));
    } catch (err) {
        console.error('getWatchlistSymbolsByEmail error:', err);
        return [];
    }
}

/**
 * Retrieve the authenticated user's watchlist items (symbol and company).
 *
 * @param userId - Ignored: this function uses the currently authenticated user's id from session instead of this parameter.
 * @returns An array of objects with `symbol` and `company` strings for each watchlist entry; returns an empty array if the caller is not authenticated or if an error occurs.
 */
export async function getWatchlistByUserId(userId: string): Promise<{ symbol: string; company: string }[]> {
    try {
        // Get session and validate user is logged in
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user?.id) {
            return [];
        }

        // Use session-derived userId, ignore the passed-in parameter
        const authenticatedUserId = session.user.id;

        await connectToDatabase();
        const items = await Watchlist.find({ userId: authenticatedUserId }, { symbol: 1, company: 1 }).lean();
        return items.map((i) => ({
            symbol: String(i.symbol),
            company: String(i.company),
        }));
    } catch (err) {
        console.error('getWatchlistByUserId error:', err);
        return [];
    }
}

/**
 * Add a stock to the authenticated user's watchlist.
 *
 * The function ignores the supplied `userId` and uses the authenticated session's user id instead.
 *
 * @param userId - Ignored; the authenticated session's user id is used for the operation
 * @param symbol - The stock ticker symbol to add (case-insensitive; stored uppercase)
 * @param company - The company name associated with the symbol
 * @returns An object with `success` and `message` describing the outcome.
 *          Possible `message` values include:
 *          - `'Missing required fields'` if `symbol` or `company` is empty
 *          - `'Unauthorized'` if no authenticated session is found
 *          - `'Stock already in watchlist'` if the symbol already exists for the user
 *          - `'Added to watchlist'` when the symbol is successfully added
 *          - `'Failed to add to watchlist'` for unexpected errors
 */
export async function addToWatchlist(userId: string, symbol: string, company: string) {
    if (!symbol || !company) {
        return { success: false, message: 'Missing required fields' };
    }

    try {
        // Get session and validate user is logged in
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user?.id) {
            return { success: false, message: 'Unauthorized' };
        }

        // Use session-derived userId, ignore the passed-in parameter
        const authenticatedUserId = session.user.id;

        await connectToDatabase();

        const existing = await Watchlist.findOne({ userId: authenticatedUserId, symbol: symbol.toUpperCase() });
        if (existing) {
            return { success: false, message: 'Stock already in watchlist' };
        }

        await Watchlist.create({
            userId: authenticatedUserId,
            symbol: symbol.toUpperCase(),
            company,
            addedAt: new Date(),
        });

        revalidatePath('/watchlist');
        return { success: true, message: 'Added to watchlist' };
    } catch (err) {
        console.error('addToWatchlist error:', err);
        return { success: false, message: 'Failed to add to watchlist' };
    }
}

/**
 * Remove a stock symbol from the authenticated user's watchlist.
 *
 * Attempts to delete the uppercase `symbol` entry for the currently authenticated user and triggers a revalidation of the `/watchlist` path on success.
 *
 * @param userId - Ignored; the function uses the authenticated user's id from the session instead of this parameter.
 * @param symbol - The stock symbol to remove (case-insensitive; normalized to uppercase).
 * @returns An object with `success` indicating whether the removal succeeded and `message` describing the outcome (`'Removed from watchlist'`, `'Missing required fields'`, `'Unauthorized'`, `'Stock not found in watchlist'`, or `'Failed to remove from watchlist'`).
 */
export async function removeFromWatchlist(userId: string, symbol: string) {
    if (!symbol) {
        return { success: false, message: 'Missing required fields' };
    }

    try {
        // Get session and validate user is logged in
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user?.id) {
            return { success: false, message: 'Unauthorized' };
        }

        // Use session-derived userId, ignore the passed-in parameter
        const authenticatedUserId = session.user.id;

        await connectToDatabase();

        const result = await Watchlist.deleteOne({ userId: authenticatedUserId, symbol: symbol.toUpperCase() });

        if (result.deletedCount === 0) {
            return { success: false, message: 'Stock not found in watchlist' };
        }

        revalidatePath('/watchlist');
        return { success: true, message: 'Removed from watchlist' };
    } catch (err) {
        console.error('removeFromWatchlist error:', err);
        return { success: false, message: 'Failed to remove from watchlist' };
    }
}
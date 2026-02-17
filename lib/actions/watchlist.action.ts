'use server';

import { connectToDatabase } from '@/database/mongoose';
import { Watchlist } from '@/database/models/watchlist.model';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { auth } from '@/lib/better-auth/auth';

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
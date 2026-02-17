'use server';

import { connectToDatabase } from '@/database/mongoose';
import { Alert } from '@/database/models/alert.model';
import { revalidatePath } from 'next/cache';

export async function addAlert(userId: string, symbol: string, company: string) {
  console.log('🔔 addAlert called with:', { userId, symbol, company });
  
  if (!userId || !symbol || !company) {
    return { success: false, message: 'Missing required fields' };
  }

  try {
    await connectToDatabase();
    console.log('✅ DB connected in addAlert');

    const existing = await Alert.findOne({ userId, symbol: symbol.toUpperCase() });
    if (existing) {
      console.log('⚠️ Alert already exists:', existing);
      return { success: false, message: 'Alert already exists for this stock' };
    }

    const newAlert = await Alert.create({
      userId,
      symbol: symbol.toUpperCase(),
      company,
      createdAt: new Date(),
      lastSentAt: null,
    });
    console.log('✅ Alert created successfully:', newAlert);

    revalidatePath('/watchlist');
    return { success: true, message: 'Hourly alert enabled' };
  } catch (err) {
    console.error('❌ addAlert error:', err);
    return { success: false, message: 'Failed to enable alert' };
  }
}

export async function removeAlert(userId: string, symbol: string) {
  if (!userId || !symbol) {
    return { success: false, message: 'Missing required fields' };
  }

  try {
    await connectToDatabase();
    const result = await Alert.deleteOne({ userId, symbol: symbol.toUpperCase() });

    if (result.deletedCount === 0) {
      return { success: false, message: 'Alert not found' };
    }

    revalidatePath('/watchlist');
    return { success: true, message: 'Alert removed' };
  } catch (err) {
    console.error('removeAlert error:', err);
    return { success: false, message: 'Failed to remove alert' };
  }
}

export async function getAlertSymbolsByUserId(userId: string): Promise<string[]> {
  if (!userId) return [];

  try {
    await connectToDatabase();
    const items = await Alert.find({ userId }, { symbol: 1 }).lean();
    return items.map((i) => String(i.symbol));
  } catch (err) {
    console.error('getAlertSymbolsByUserId error:', err);
    return [];
  }
}

type AlertUserInfo = {
  id: string;
  email: string;
  name: string;
};

type AlertGroup = {
  user: AlertUserInfo;
  alerts: Array<{ symbol: string; company: string }>;
};

export async function getAlertsForEmail(): Promise<AlertGroup[]> {
  try {
    console.log('📧 getAlertsForEmail called');
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB connection not found');

    const alerts = await Alert.find({}, { userId: 1, symbol: 1, company: 1 }).lean();
    console.log('📊 Found alerts:', alerts.length, alerts);
    
    if (!alerts || alerts.length === 0) {
      console.log('⚠️ No alerts found in database');
      return [];
    }

    const userIds = Array.from(new Set(alerts.map((a) => String(a.userId)).filter(Boolean)));
    console.log('👥 Unique user IDs:', userIds);
    if (userIds.length === 0) return [];

    // Convert string IDs to ObjectIds for MongoDB query
    const { ObjectId } = require('mongodb');
    const objectIds = userIds.map(id => {
      try {
        return new ObjectId(id);
      } catch {
        return null;
      }
    }).filter(Boolean);

    const users = await db
      .collection('user')
      .find({ _id: { $in: objectIds } }, { projection: { _id: 1, id: 1, email: 1, name: 1 } })
      .toArray();
    console.log('👤 Found users:', users.length, users);

    const userMap = new Map<string, AlertUserInfo>();
    users.forEach((u) => {
      const userId = u?.id || u?._id?.toString();
      if (userId && u?.email && u?.name) {
        userMap.set(String(userId), {
          id: String(userId),
          email: String(u.email),
          name: String(u.name),
        });
      }
    });
    console.log('🗺️ User map size:', userMap.size);

    const grouped = new Map<string, Array<{ symbol: string; company: string }>>();
    alerts.forEach((alert) => {
      const uid = String(alert.userId);
      if (!uid) return;
      const list = grouped.get(uid) || [];
      list.push({ symbol: String(alert.symbol), company: String(alert.company) });
      grouped.set(uid, list);
    });

    const result: AlertGroup[] = [];
    grouped.forEach((alertsList, uid) => {
      const user = userMap.get(uid);
      if (!user) {
        console.log('⚠️ No user found for uid:', uid);
        return;
      }
      result.push({ user, alerts: alertsList });
    });

    console.log('✅ Final result groups:', result.length);
    return result;
  } catch (err) {
    console.error('❌ getAlertsForEmail error:', err);
    return [];
  }
}

export async function markAlertsSent(userId: string, symbols: string[]): Promise<void> {
  if (!userId || !symbols || symbols.length === 0) return;

  try {
    await connectToDatabase();
    await Alert.updateMany(
      { userId, symbol: { $in: symbols.map((s) => s.toUpperCase()) } },
      { $set: { lastSentAt: new Date() } }
    );
  } catch (err) {
    console.error('markAlertsSent error:', err);
  }
}

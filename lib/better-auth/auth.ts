import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { nextCookies } from "better-auth/next-js";
import { connectToDatabase } from "@/database/mongoose";
import { get } from "http";
import next from "next";

let authInstance: ReturnType<typeof betterAuth> | null = null;

export const getAuth = async () => {
  if(authInstance) return authInstance;

  const mongoose = await connectToDatabase();
  const db = mongoose.connection.db;

  if(!db) throw new Error('Database connection is not established');

    authInstance = betterAuth({
        database: mongodbAdapter(db as any),
        secret: process.env.BETTER_AUTH_SECRET,
        baseURL: process.env.BETTER_AUTH_URL,
        emailAndPassword:{
            enabled: true,
            disableSignUp: false,
            requireEmailVerification: false,
            minPasswordLength: 8,
            maxPasswordLength: 128,
            autoSignIn: true,
        },
        plugins:[nextCookies()] // Use nextCookies plugin for cookie handling in Next.js
    });

    return authInstance;




};

export const auth = await getAuth();
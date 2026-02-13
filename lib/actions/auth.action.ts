'use server';

import { headers } from "next/headers";
import { auth } from "../better-auth/auth";
import { inngest } from "../inngest/client";

export const signUpWithEmail = async ({ email, password, fullName, country, investmentGoals, riskTolerance, preferredIndustry }: SignUpFormData) => {
    try {
        const response = await auth.api.signUpEmail({ body: { email, password, name: fullName } })
        if (response) {
            inngest.send({
                name: 'app/user.created',
                data: {
                    email, name: fullName, country, investmentGoals, riskTolerance, preferredIndustry
                }
            })
        }
        return { success: true, data: response };
    } catch (e) {
        console.error('Sign Up failed', e);
        return { success: false, error: 'Sign Up failed. Please try again.' };
    }
}

export const signInWithEmail = async ({ email, password }: SignInFormData) => {
    try {
        const response = await auth.api.signInEmail({ body: { email, password } })

        return { success: true, data: response };
    } catch (e) {
        console.error('Sign In failed', e);
        return { success: false, error: 'Sign In failed. Please try again.' };
    }
}

export const signOut = async () => {
    try {
        await auth.api.signOut({ headers: await headers() });
    } catch (e) {
        console.error('Sign Out failed', e);
        return { success: false, error: 'Sign Out failed. Please try again.' };
    }
}
import { inngest } from "@/lib/inngest/client";
import {
  NEWS_SUMMARY_EMAIL_PROMPT,
  PERSONALIZED_WELCOME_EMAIL_PROMPT,
} from "./prompts";
import { sendAlertSummaryEmail, sendNewsSummaryEmail, sendWelcomeEmail } from "../nodemailer";
import { getNews, getStockSnapshots } from "@/lib/actions/finnhub.action";
import { formatPrice, getFormattedTodayDate } from "@/lib/utils";
import { getWatchlistSymbolsByEmail } from "../actions/watchlist.action";
import { getAlertsForEmail, markAlertsSent } from "../actions/alert.action";
import { getAllUsersForNewsEmail } from "@/lib/actions/user.action";

export const sendSignUpEmail = inngest.createFunction(
  { id: "sign-up-email" },
  { event: "app/user.created" },
  async ({ event, step }) => {
    const userProfile = `
            - Country: ${event.data.country}
            - Investment goals : ${event.data.investmentGoals}
            - Risk tolerance : ${event.data.riskTolerance}
            - Preferred industries : ${event.data.preferredIndustry}
        `;

    const prompt = PERSONALIZED_WELCOME_EMAIL_PROMPT.replace(
      "{userProfile}",
      userProfile,
    );

    const response = await step.ai.infer("generate-welcome-email", {
      model: step.ai.models.gemini({ model: "gemini-2.5-flash" }),
      body: {
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
      },
    });

    await step.run("send-welcome-email", async () => {
      const part = response.candidates?.[0]?.content?.parts?.[0];
      const introText =
        (part && "text" in part ? part.text : null) ||
        "Thanks for joining Signalist. You are now have the tools to track markets and make smarter moves.";

      const {
        data: { email, name },
      } = event;
      return await sendWelcomeEmail({ email, name, intro: introText });
    });

    return {
      success: true,
      message: "Welcome email sent successfully",
    };
  },
);

export const sendDailyNewsSummary = inngest.createFunction(
  { id: "daily-news-summary" },
  [
    { event: "app/send.daily.news" },
    // { cron: "0 12 * * *" /* every day at 12:00 PM*/ },
    { cron: "* * * * *" /* every min*/ },
  ],
  async ({ step }) => {
    //1. get all users for news delivery
    const users = await step.run("get-all-users", getAllUsersForNewsEmail);
    if (!users || users.length === 0)
      return { success: false, message: "No users found for news delivery" };

    //2. fetch personalized news for each user
    const results = await step.run("fetch-user-news", async () => {
      const perUser: Array<{
        user: UserForNewsEmail;
        articles: MarketNewsArticle[];
      }> = [];
      for (const user of users as UserForNewsEmail[]) {
        try {
          const symbols = await getWatchlistSymbolsByEmail(user.email);
          let articles = await getNews(symbols);
          // Enforce max 6 articles per user
          articles = (articles || []).slice(0, 6);
          // If still empty, fallback to general
          if (!articles || articles.length === 0) {
            articles = await getNews();
            articles = (articles || []).slice(0, 6);
          }
          perUser.push({ user, articles });
        } catch (e) {
          console.error("daily-news: error preparing user news", user.email, e);
          perUser.push({ user, articles: [] });
        }
      }
      return perUser;
    });

    //3. summarize news using AI
    const userNewsSummaries: Array<{
      user: UserForNewsEmail;
      newsContent: string | null;
    }> = [];

    for (const { user, articles } of results) {
      try {
        const prompt = NEWS_SUMMARY_EMAIL_PROMPT.replace(
          "{{newsData}}",
          JSON.stringify(articles, null, 2),
        );

        const response = await step.ai.infer(`summarize-news-${user.email}`, {
          model: step.ai.models.gemini({ model: "gemini-2.5-flash" }),
          body: {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
          },
        });

        const part = response.candidates?.[0]?.content?.parts?.[0];
        const newsContent =
          (part && "text" in part ? part.text : null) || "No market news.";

        userNewsSummaries.push({ user, newsContent });
      } catch (e) {
        console.error("Failed to summarize news for : ", user.email);
        userNewsSummaries.push({ user, newsContent: null });
      }
    }

    //4. send email to users
    await step.run("send-news-emails", async () => {
      await Promise.all(
        userNewsSummaries.map(async ({ user, newsContent }) => {
          if (!newsContent) return false;

          return await sendNewsSummaryEmail({
            email: user.email,
            date: getFormattedTodayDate(),
            newsContent,
          });
        }),
      );
    });

    return {
      success: true,
      message: "Daily news summary emails sent successfully",
    };
  },
);

export const sendHourlyStockAlerts = inngest.createFunction(
  { id: "hourly-stock-alerts" },
  [
    { event: "app/send.hourly.alerts" },
    { cron: "0 * * * *" /* every hour */ },
  ],
  async ({ step }) => {
    console.log('🚀 sendHourlyStockAlerts function triggered');
    const groups = await step.run("get-alert-groups", getAlertsForEmail);
    console.log('📊 Alert groups received:', groups?.length || 0);
    if (!groups || groups.length === 0) {
      console.log('⚠️ No alert groups found, exiting');
      return { success: false, message: "No alerts found" };
    }

    const results = await step.run("build-alert-summaries", async () => {
      const perUser: Array<{
        user: UserForNewsEmail;
        symbols: string[];
        snapshots: Array<{
          symbol: string;
          price: number;
          changePercent: number;
          high: number;
          low: number;
          open: number;
          previousClose: number;
        }>;
      }> = [];

      for (const group of groups) {
        try {
          const symbols = group.alerts.map((a) => a.symbol);
          const snapshots = await getStockSnapshots(symbols);
          perUser.push({ user: group.user, symbols, snapshots });
        } catch (e) {
          console.error("hourly-alerts: snapshot error", group.user.email, e);
          perUser.push({ user: group.user, symbols: group.alerts.map((a) => a.symbol), snapshots: [] });
        }
      }

      return perUser;
    });

    const dateLabel = new Date().toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "UTC",
    });

    const emailResults = await step.run("send-alert-emails", async () => {
      return await Promise.all(
        results.map(async ({ user, symbols, snapshots }) => {
          if (!snapshots || snapshots.length === 0) {
            return { userId: user.id, symbols, sent: false };
          }

          const rows = snapshots
            .map((s) => {
              const change = `${s.changePercent >= 0 ? "+" : ""}${s.changePercent.toFixed(2)}%`;
              return `
                <tr>
                  <td style="padding:8px 0; color:#CCDADC; font-size:14px;">${s.symbol}</td>
                  <td style="padding:8px 0; color:#CCDADC; font-size:14px;">${formatPrice(s.price)}</td>
                  <td style="padding:8px 0; color:#CCDADC; font-size:14px;">${change}</td>
                  <td style="padding:8px 0; color:#CCDADC; font-size:14px;">${formatPrice(s.open)}</td>
                  <td style="padding:8px 0; color:#CCDADC; font-size:14px;">${formatPrice(s.high)}</td>
                  <td style="padding:8px 0; color:#CCDADC; font-size:14px;">${formatPrice(s.low)}</td>
                  <td style="padding:8px 0; color:#CCDADC; font-size:14px;">${formatPrice(s.previousClose)}</td>
                </tr>
              `;
            })
            .join("");

          const content = `
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse: collapse;">
              <tr>
                <th align="left" style="padding:8px 0; color:#FDD458; font-size:12px; font-weight:600;">Symbol</th>
                <th align="left" style="padding:8px 0; color:#FDD458; font-size:12px; font-weight:600;">Price</th>
                <th align="left" style="padding:8px 0; color:#FDD458; font-size:12px; font-weight:600;">Change</th>
                <th align="left" style="padding:8px 0; color:#FDD458; font-size:12px; font-weight:600;">Open</th>
                <th align="left" style="padding:8px 0; color:#FDD458; font-size:12px; font-weight:600;">High</th>
                <th align="left" style="padding:8px 0; color:#FDD458; font-size:12px; font-weight:600;">Low</th>
                <th align="left" style="padding:8px 0; color:#FDD458; font-size:12px; font-weight:600;">Prev Close</th>
              </tr>
              ${rows}
            </table>
          `;

          try {
            await sendAlertSummaryEmail({
              email: user.email,
              name: user.name,
              date: dateLabel,
              content,
            });
            return { userId: user.id, symbols, sent: true };
          } catch (e) {
            console.error("Failed to send alert email to:", user.email, e);
            return { userId: user.id, symbols, sent: false };
          }
        })
      );
    });

    await step.run("mark-alerts-sent", async () => {
      await Promise.all(
        emailResults
          .filter((result) => result.sent === true)
          .map(async (result) => {
            await markAlertsSent(result.userId, result.symbols);
          })
      );
    });

    return { success: true, message: "Hourly stock alerts sent" };
  }
);

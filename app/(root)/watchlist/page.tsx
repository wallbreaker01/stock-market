import WatchlistPageClient from '@/components/WatchlistPageClient';
import NewsSection from '@/components/NewsSection';
import { auth } from '@/lib/better-auth/auth';
import { getNews } from '@/lib/actions/finnhub.action';
import { headers } from 'next/headers';

export default async function WatchlistPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;
  const news = await getNews().catch((err) => {
    console.error('WatchlistPage: getNews failed', err);
    return [];
  });

  return (
    <>
      <WatchlistPageClient userId={userId} />
      <NewsSection news={news} />
    </>
  );
}

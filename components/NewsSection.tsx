import { formatTimeAgo } from '@/lib/utils';
import { ExternalLink, TrendingUp } from 'lucide-react';

export default function NewsSection({ news }: { news: MarketNewsArticle[] }) {
  if (!news || news.length === 0) {
    return (
      <section className="container mx-auto px-4 pb-12">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="w-6 h-6 text-yellow-500" />
          <h2 className="text-2xl font-bold text-gray-100">Market News</h2>
        </div>
        <div className="text-center py-12 bg-gray-900/50 rounded-lg border border-gray-800">
          <p className="text-gray-400">No news available at the moment.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="container mx-auto px-4 pb-12">
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="w-6 h-6 text-yellow-500" />
        <h2 className="text-2xl font-bold text-gray-100">Market News</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {news.map((article, index) => (
          <a
            key={`news-${index}`}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-gray-900/50 rounded-lg border border-gray-800 overflow-hidden hover:border-yellow-500/50 transition-all duration-300"
          >
            {article.image ? (
              <div className="relative h-48 overflow-hidden bg-gray-800">
                <img
                  src={article.image}
                  alt={article.headline}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
            ) : null}

            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500">{article.source}</span>
                <span className="text-xs text-gray-600">•</span>
                <span className="text-xs text-gray-500">
                  {formatTimeAgo(article.datetime)}
                </span>
              </div>

              <h3 className="text-base font-semibold text-gray-100 mb-2 line-clamp-2 group-hover:text-yellow-500 transition-colors">
                {article.headline}
              </h3>

              <p className="text-sm text-gray-400 line-clamp-3 mb-3">
                {article.summary}
              </p>

              <div className="flex items-center justify-between">
                {article.related ? (
                  <span className="text-xs px-2 py-1 bg-yellow-500/10 text-yellow-500 rounded">
                    {article.related}
                  </span>
                ) : (
                  <span className="text-xs text-gray-600">Finance</span>
                )}
                <ExternalLink className="w-4 h-4 text-gray-500 group-hover:text-yellow-500 transition-colors ml-auto" />
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

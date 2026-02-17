import TradingViewWidget from '@/components/TradingViewWidget'
import WatchlistButton from '@/components/WatchlistButton'
import {
  BASELINE_WIDGET_CONFIG,
  CANDLE_CHART_WIDGET_CONFIG,
  COMPANY_FINANCIALS_WIDGET_CONFIG,
  COMPANY_PROFILE_WIDGET_CONFIG,
  SYMBOL_INFO_WIDGET_CONFIG,
  TECHNICAL_ANALYSIS_WIDGET_CONFIG,
} from '@/lib/constants'
import { auth } from '@/lib/better-auth/auth'
import { headers } from 'next/headers'
import { getWatchlistByUserId } from '@/lib/actions/watchlist.action'
import { searchStocks } from '@/lib/actions/finnhub.action'

const StockDetails = async ({ params }: StockDetailsPageProps) => {
  const { symbol } = await params
  const scriptUrl = 'https://s3.tradingview.com/external-embedding/embed-widget-'
  const session = await auth.api.getSession({ headers: await headers() })
  const userId = session?.user?.id

  let isInWatchlist = false
  let company = symbol

  if (userId) {
    const items = await getWatchlistByUserId(userId)
    const matched = items.find((item) => item.symbol.toUpperCase() === symbol.toUpperCase())
    if (matched) {
      isInWatchlist = true
      company = matched.company || symbol
    }
  }

  if (!isInWatchlist) {
    const searchResults = await searchStocks(symbol)
    const match = searchResults.find((item) => item.symbol.toUpperCase() === symbol.toUpperCase())
    company = match?.name || company
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section className="flex flex-col gap-8">
        <TradingViewWidget
          title=""
          scriptUrl={`${scriptUrl}symbol-info.js`}
          config={SYMBOL_INFO_WIDGET_CONFIG(symbol)}
          height={170}
          className="custom-chart"
        />
        <TradingViewWidget
          title=""
          scriptUrl={`${scriptUrl}advanced-chart.js`}
          config={CANDLE_CHART_WIDGET_CONFIG(symbol)}
          height={600}
          className="custom-chart"
        />
        <TradingViewWidget
          title=""
          scriptUrl={`${scriptUrl}advanced-chart.js`}
          config={BASELINE_WIDGET_CONFIG(symbol)}
          height={600}
          className="custom-chart"
        />
      </section>
      <section className="flex flex-col gap-8">
        <WatchlistButton
          symbol={symbol}
          company={company}
          isInWatchlist={isInWatchlist}
          userId={userId}
        />
        <TradingViewWidget
          title=""
          scriptUrl={`${scriptUrl}technical-analysis.js`}
          config={TECHNICAL_ANALYSIS_WIDGET_CONFIG(symbol)}
          height={400}
          className="custom-chart"
        />
        <TradingViewWidget
          title=""
          scriptUrl={`${scriptUrl}company-profile.js`}
          config={COMPANY_PROFILE_WIDGET_CONFIG(symbol)}
          height={440}
          className="custom-chart"
        />
        <TradingViewWidget
          title=""
          scriptUrl={`${scriptUrl}financials.js`}
          config={COMPANY_FINANCIALS_WIDGET_CONFIG(symbol)}
          height={464}
          className="custom-chart"
        />
      </section>
    </div>
  )
}

export default StockDetails

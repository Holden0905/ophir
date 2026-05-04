// Static symbol universes used by the regime + discovery scanners.

export const SECTOR_ETFS: Array<{ symbol: string; name: string }> = [
  { symbol: "XLK", name: "Technology" },
  { symbol: "XLF", name: "Financials" },
  { symbol: "XLE", name: "Energy" },
  { symbol: "XLV", name: "Health Care" },
  { symbol: "XLI", name: "Industrials" },
  { symbol: "XLY", name: "Consumer Discretionary" },
  { symbol: "XLP", name: "Consumer Staples" },
  { symbol: "XLU", name: "Utilities" },
  { symbol: "XLB", name: "Materials" },
  { symbol: "XLRE", name: "Real Estate" },
  { symbol: "XLC", name: "Communication Services" },
];

export const BENCHMARK_SYMBOL = "SPY";

export const MACRO_SYMBOLS = {
  spx: "^GSPC",
  ndx: "^NDX",
  esFutures: "ES=F",
  nqFutures: "NQ=F",
  vix: "^VIX",
} as const;

// Discovery universe — large, liquid US names. Trimmed list to stay
// inside Yahoo rate limits during a single scan. Refresh quarterly.
export const DISCOVERY_UNIVERSE: string[] = [
  "AAPL","MSFT","NVDA","AMZN","META","GOOGL","TSLA","AVGO","ORCL","COST",
  "AMD","ADBE","CRM","NFLX","CSCO","INTC","QCOM","TXN","PLTR","SNOW",
  "SHOP","UBER","ABNB","SQ","PYPL","COIN","ROKU","SPOT","DDOG","NET",
  "CRWD","ZS","PANW","FTNT","NOW","WDAY","INTU","MDB","TEAM","ZM",
  "JPM","BAC","GS","MS","WFC","C","BLK","SCHW","V","MA",
  "JNJ","UNH","LLY","PFE","ABBV","MRK","TMO","DHR","BMY","AMGN",
  "WMT","TGT","HD","LOW","NKE","SBUX","MCD","CMG","DIS","BKNG",
  "XOM","CVX","COP","SLB","OXY","EOG","BA","LMT","RTX","CAT",
  "DE","HON","GE","UNP","UPS","FDX","NEE","DUK","SO","T",
  "VZ","CMCSA","TMUS","PEP","KO","PG","CL","KHC","MDLZ","TSM",
];

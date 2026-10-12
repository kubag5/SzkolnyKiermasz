import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, CircleHelp, Search, SlidersHorizontal } from "lucide-react";
import { Link } from "react-router-dom";
import { OfferCard } from "../components/OfferCard";
import { api, ApiError, type Currency, type Offer, type Rate } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

type OfferPage = { offers: Offer[]; meta: { page: number; limit: number; total: number } };
const currencyFallback: Currency[] = [
  { iso_code: "PLN", name: "Polski złoty", symbol: "zł" },
  { iso_code: "EUR", name: "Euro", symbol: "€" },
  { iso_code: "USD", name: "Dolar amerykański", symbol: "$" },
];

export function OffersPage() {
  const { user } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [moreLoading, setMoreLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [status, setStatus] = useState<"AVAILABLE" | "ALL">("AVAILABLE");
  const [currency, setCurrency] = useState("PLN");
  const [currencies, setCurrencies] = useState<Currency[]>(currencyFallback);
  const [rate, setRate] = useState<Rate | null>(null);
  const [rateError, setRateError] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [currencyFallbackActive, setCurrencyFallbackActive] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query.trim()), 280);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    api<Currency[]>("/api/currencies").then((items) => {
      if (active) { setCurrencies(items); setCurrencyFallbackActive(false); }
    }).catch(() => {
      if (active) setCurrencyFallbackActive(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (currency === "PLN") {
      setRate({ base: "PLN", quote: "PLN", date: new Date().toISOString().slice(0, 10), rate: 1, stale: false });
      setRateError("");
      return () => { active = false; };
    }
    setRate(null);
    setRateError("");
    api<Rate>(`/api/rates/${currency}`).then((result) => {
      if (active) setRate(result);
    }).catch((loadError) => {
      if (active) setRateError(loadError instanceof ApiError ? loadError.message : "Nie udało się pobrać kursu.");
    });
    return () => { active = false; };
  }, [currency]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: "1", status });
    if (search) params.set("search", search);
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    api<OfferPage>(`/api/offers?${params}`).then((result) => {
      if (active) { setOffers(result.offers); setTotal(result.meta.total); setPage(1); }
    }).catch((loadError) => {
      if (active) setError(loadError instanceof ApiError ? loadError.message : "Nie udało się pobrać ofert.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [search, minPrice, maxPrice, status]);

  async function loadMore() {
    if (moreLoading || offers.length >= total) return;
    setMoreLoading(true);
    const nextPage = page + 1;
    const params = new URLSearchParams({ page: String(nextPage), status });
    if (search) params.set("search", search);
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    try {
      const result = await api<OfferPage>(`/api/offers?${params}`);
      setOffers((current) => [...current, ...result.offers]);
      setPage(nextPage);
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : "Nie udało się pobrać kolejnych ofert.");
    } finally {
      setMoreLoading(false);
    }
  }

  const displayRate = currency === "PLN" ? 1 : rate?.rate ?? 1;
  const displayCurrency = currency !== "PLN" && !rate ? "PLN" : currency;
  const currencyLabel = useMemo(() => currencies.find((item) => item.iso_code === currency)?.name ?? currency, [currencies, currency]);

  return <div className="page-container offers-page">
    <section className="page-intro">
      <h1>Oferty podręczników</h1>
      <p>Przeglądaj, wyszukuj i filtruj oferty używanych książek szkolnych.</p>
      <div className="hero-actions">
        {user
          ? <Link className="button button-primary" to="/wystaw">Dodaj ofertę</Link>
          : <Link className="button button-primary" to="/rejestracja">Zarejestruj się</Link>}
      </div>
    </section>

    <section className="market-section" id="lista-ofert">
      <div className="section-heading">
        <h2>Lista ofert</h2>
        <div className="offer-count"><strong>{total}</strong> <span>wyników</span></div>
      </div>

      <div className="market-toolbar">
        <label className="search-box">
          <Search size={18} />
          <span className="visually-hidden">Szukaj książki</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Szukaj po tytule..." />
        </label>
        <button className={`filter-toggle ${showFilters ? "active" : ""}`} type="button" aria-expanded={showFilters} onClick={() => setShowFilters((shown) => !shown)}>
          <SlidersHorizontal size={16} /> Filtry
        </button>
        <label className="currency-select">
          <span>Waluta</span>
          <select aria-label="Waluta cen" value={currency} onChange={(event) => setCurrency(event.target.value)}>
            {currencies.map((item) => <option key={item.iso_code} value={item.iso_code}>{item.iso_code} - {item.name}</option>)}
          </select>
        </label>
      </div>

      {showFilters && <div className="filter-panel">
        <div className="filter-controls">
          <label className="field">
            <span>Cena od</span>
            <div className="input-wrap price-input">
              <input type="number" min="0" step="1" inputMode="decimal" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} placeholder="0" />
              <span>zł</span>
            </div>
          </label>
          <label className="field">
            <span>Cena do</span>
            <div className="input-wrap price-input">
              <input type="number" min="0" step="1" inputMode="decimal" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="bez limitu" />
              <span>zł</span>
            </div>
          </label>
          <label className="field">
            <span>Dostępność</span>
            <select className="select-control" value={status} onChange={(event) => setStatus(event.target.value as "AVAILABLE" | "ALL")}>
              <option value="AVAILABLE">Tylko dostępne</option>
              <option value="ALL">Wszystkie</option>
            </select>
          </label>
          {(minPrice || maxPrice || search || status !== "AVAILABLE") && (
            <button className="clear-filters" type="button" onClick={() => { setMinPrice(""); setMaxPrice(""); setQuery(""); setStatus("AVAILABLE"); }}>
              Wyczyść filtry
            </button>
          )}
        </div>
      </div>}

      {currencyFallbackActive && <p className="inline-note"><CircleHelp size={15} /> Lista walut niedostępna. Możesz wybrać PLN, EUR lub USD.</p>}
      {currency !== "PLN" && (
        <p className={`rate-note ${rateError ? "rate-note-error" : ""}`}>
          {rateError
            ? `${rateError} Ceny zostają w PLN.`
            : !rate
              ? "Pobieranie kursu..."
              : `Kurs PLN/${currency} z dnia ${rate.date}${rate.stale ? " (zapisany wcześniej)" : ""}.`}
          <span className="rate-source">{currencyLabel}</span>
        </p>
      )}

      {loading ? (
        <div className="page-loading" role="status">Ładowanie ofert...</div>
      ) : error ? (
        <div className="state-panel state-error" role="alert">
          <CircleHelp size={24} />
          <div><b>Nie udało się wczytać ofert</b><p>{error}</p></div>
        </div>
      ) : offers.length ? (
        <>
          <div className="offer-grid">
            {offers.map((offer, index) => (
              <OfferCard key={offer.id} offer={offer} index={index} currency={displayCurrency} rate={displayRate} />
            ))}
          </div>
          {offers.length < total && (
            <button className="button button-outline load-more" type="button" onClick={() => void loadMore()} disabled={moreLoading}>
              {moreLoading ? "Ładowanie..." : "Pokaż więcej"}
              <ArrowRight size={16} />
            </button>
          )}
        </>
      ) : (
        <div className="empty-state">
          <span className="empty-icon"><BookOpen size={21} /></span>
          <h3>{search || minPrice || maxPrice ? "Brak wyników" : "Brak ofert"}</h3>
          <p>{search || minPrice || maxPrice ? "Zmień wyszukiwanie lub filtry." : "Na razie nie ma żadnych ofert."}</p>
          <button className="button button-outline" type="button" onClick={() => { setQuery(""); setMinPrice(""); setMaxPrice(""); setStatus("AVAILABLE"); }}>
            Wyczyść filtry
          </button>
          {user && <Link className="empty-cta" to="/wystaw">Dodaj ofertę <ArrowRight size={15} /></Link>}
        </div>
      )}
    </section>
  </div>;
}

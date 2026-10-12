import { useEffect, useState } from "react";
import { ArrowLeft, BookOpen, CalendarDays, CircleHelp, Tag } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api, ApiError, type Offer, type Rate } from "../lib/api";
import { formatCurrency } from "../lib/currency";

const conditionLabels = { NEW: "Jak nowa", VERY_GOOD: "Bardzo dobry", GOOD: "Dobry", ACCEPTABLE: "Zadowalający" };

export function OfferDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [currency, setCurrency] = useState("PLN");
  const [rate, setRate] = useState<Rate | null>(null);
  const [rateLoading, setRateLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api<Offer>(`/api/offers/${id}`).then((result) => { if (active) setOffer(result); })
      .catch((loadError) => { if (active) setError(loadError instanceof ApiError ? loadError.message : "Nie udało się pobrać oferty."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    let active = true;
    if (currency === "PLN") { setRate(null); setRateLoading(false); return () => { active = false; }; }
    setRate(null);
    setRateLoading(true);
    api<Rate>(`/api/rates/${currency}`).then((result) => { if (active) setRate(result); }).catch(() => { if (active) setRate(null); }).finally(() => { if (active) setRateLoading(false); });
    return () => { active = false; };
  }, [currency]);

  async function markSold() {
    if (!offer) return;
    setActionBusy(true);
    setError("");
    try {
      const updated = await api<Offer>(`/api/offers/${offer.id}/status`, { method: "PATCH", body: JSON.stringify({ status: offer.status === "SOLD" ? "AVAILABLE" : "SOLD" }) });
      setOffer(updated);
    } catch (actionError) {
      setError(actionError instanceof ApiError ? actionError.message : "Nie udało się zmienić statusu.");
    } finally { setActionBusy(false); }
  }

  async function deleteOffer() {
    if (!offer || !window.confirm("Czy na pewno chcesz usunąć tę ofertę?")) return;
    setActionBusy(true);
    try { await api<void>(`/api/offers/${offer.id}`, { method: "DELETE" }); navigate("/moje-oferty", { replace: true }); }
    catch (actionError) { setError(actionError instanceof ApiError ? actionError.message : "Nie udało się usunąć oferty."); }
    finally { setActionBusy(false); }
  }

  if (loading) return <div className="page-loading" role="status">Ładowanie...</div>;
  if (!offer) return <section className="empty-state page-narrow">
    <span className="empty-icon"><CircleHelp size={21} /></span>
    <h1>Nie znaleziono oferty</h1>
    <p>{error || "Oferta może być już niedostępna."}</p>
    <Link className="button button-primary" to="/">Wróć do ofert</Link>
  </section>;

  const isOwner = user?.id === offer.sellerId;
  const currentRate = rate?.quote === currency ? rate : null;
  const price = currentRate ? Math.round((offer.pricePln * currentRate.rate + Number.EPSILON) * 100) / 100 : offer.pricePln;

  return <div className="page-container detail-page">
    <Link className="back-link dark-back-link" to="/"><ArrowLeft size={16} /> Wróć do ofert</Link>
    {error && <p className="form-message form-message-error" role="alert">{error}</p>}
    <div className="detail-layout">
      <div className="detail-visual">
        <div className="detail-cover">
          <BookOpen size={31} />
          <h2>{offer.title}</h2>
        </div>
      </div>
      <article className="detail-info">
        <div className="detail-pills">
          <span className={`status-pill ${offer.status === "SOLD" ? "status-pill-sold" : ""}`}>
            {offer.status === "AVAILABLE" ? "Dostępna" : "Sprzedana"}
          </span>
          <span className="condition-pill"><Tag size={12} /> {conditionLabels[offer.condition]}</span>
        </div>
        <h1>{offer.title}</h1>
        <p className="detail-description">{offer.description}</p>
        <div className="detail-price-box">
          <div>
            <span>Cena</span>
            <strong>{formatCurrency(offer.pricePln, "PLN")}</strong>
          </div>
          <label>
            <span>Pokaż w walucie</span>
            <select value={currency} onChange={(event) => setCurrency(event.target.value)} aria-label="Waluta ceny">
              <option value="PLN">PLN</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </select>
          </label>
        </div>
        {currency !== "PLN" && (
          <p className="detail-rate-note" role="status">
            {currentRate
              ? `Około ${formatCurrency(price, currency)} (kurs z ${currentRate.date}${currentRate.stale ? ", zapisany wcześniej" : ""})`
              : rateLoading
                ? `Pobieranie kursu ${currency}... Cena zostaje w PLN.`
                : `Kurs ${currency} niedostępny. Cena zostaje w PLN.`}
          </p>
        )}
        <div className="seller-card">
          <span className="avatar avatar-large">{offer.seller.nickname.slice(0, 1).toUpperCase()}</span>
          <div>
            <span>Sprzedający</span>
            <strong>{offer.seller.nickname}</strong>
          </div>
        </div>
        <div className="detail-meta">
          <span><CalendarDays size={15} /> Dodano {new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium" }).format(new Date(offer.createdAt))}</span>
        </div>
        {isOwner ? (
          <div className="owner-actions">
            <Link className="button button-outline" to={`/oferta/${offer.id}/edytuj`}>Edytuj</Link>
            <button className={`button ${offer.status === "SOLD" ? "button-outline" : "button-dark"}`} onClick={() => void markSold()} disabled={actionBusy}>
              {offer.status === "AVAILABLE" ? "Oznacz jako sprzedaną" : "Przywróć dostępność"}
            </button>
            <button className="text-danger-button" type="button" onClick={() => void deleteOffer()} disabled={actionBusy}>Usuń ofertę</button>
          </div>
        ) : offer.status === "AVAILABLE" ? (
          <p className="buyer-note">Jeśli chcesz kupić książkę, odezwij się do sprzedającego w szkole.</p>
        ) : (
          <p className="sold-notice">Ta oferta jest już sprzedana.</p>
        )}
      </article>
    </div>
  </div>;
}

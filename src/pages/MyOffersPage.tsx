import { useCallback, useEffect, useState } from "react";
import { ArrowRight, BookOpen, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { api, ApiError, type Offer } from "../lib/api";
import { formatCurrency } from "../lib/currency";

export function MyOffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<{ offers: Offer[]; meta: { page: number; limit: number; total: number } }>("/api/offers?mine=true&status=ALL&limit=48");
      setOffers(result.offers);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : "Nie udało się pobrać Twoich ofert.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function toggleStatus(offer: Offer) {
    try {
      const updated = await api<Offer>(`/api/offers/${offer.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: offer.status === "SOLD" ? "AVAILABLE" : "SOLD" }),
      });
      setOffers((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (actionError) {
      setError(actionError instanceof ApiError ? actionError.message : "Nie udało się zmienić statusu.");
    }
  }

  async function remove(offer: Offer) {
    if (!window.confirm(`Usunąć ofertę "${offer.title}"?`)) return;
    try {
      await api<void>(`/api/offers/${offer.id}`, { method: "DELETE" });
      setOffers((current) => current.filter((item) => item.id !== offer.id));
    } catch (actionError) {
      setError(actionError instanceof ApiError ? actionError.message : "Nie udało się usunąć oferty.");
    }
  }

  return <div className="page-container my-offers-page">
    <div className="page-heading-row">
      <div>
        <h1>Moje oferty</h1>
        <p>Tutaj zarządzasz swoimi ogłoszeniami.</p>
      </div>
      <Link className="button button-dark" to="/wystaw"><Plus size={16} /> Dodaj ofertę</Link>
    </div>
    {error && <p className="form-message form-message-error" role="alert">{error}</p>}
    {loading ? (
      <div className="page-loading" role="status">Ładowanie...</div>
    ) : offers.length ? (
      <div className="my-offer-list">
        {offers.map((offer, index) => (
          <article className="my-offer-row" key={offer.id}>
            <Link className={`mini-cover cover-${(index % 5) + 1}`} to={`/oferta/${offer.id}`}>
              <BookOpen size={20} />
            </Link>
            <div className="my-offer-main">
              <Link to={`/oferta/${offer.id}`}><h2>{offer.title}</h2></Link>
              <span>{formatCurrency(offer.pricePln, "PLN")} - {offer.status === "AVAILABLE" ? "dostępna" : "sprzedana"}</span>
            </div>
            <span className={`status-pill ${offer.status === "SOLD" ? "status-pill-sold" : ""}`}>
              {offer.status === "AVAILABLE" ? "Aktywna" : "Sprzedana"}
            </span>
            <div className="my-offer-actions">
              <Link to={`/oferta/${offer.id}/edytuj`}>Edytuj</Link>
              <button type="button" onClick={() => void toggleStatus(offer)}>
                {offer.status === "AVAILABLE" ? "Oznacz sprzedaną" : "Przywróć"}
              </button>
              <button className="delete-link" type="button" onClick={() => void remove(offer)}>Usuń</button>
            </div>
          </article>
        ))}
      </div>
    ) : (
      <div className="empty-state">
        <span className="empty-icon"><BookOpen size={21} /></span>
        <h2>Nie masz jeszcze ofert</h2>
        <p>Dodaj pierwszą książkę do sprzedaży.</p>
        <Link className="button button-dark" to="/wystaw">Dodaj ofertę <ArrowRight size={16} /></Link>
      </div>
    )}
  </div>;
}

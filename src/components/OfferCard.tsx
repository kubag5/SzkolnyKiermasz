import { BookOpen, CheckCircle2, Tag } from "lucide-react";
import { Link } from "react-router-dom";
import { formatCurrency } from "../lib/currency";
import type { Offer } from "../lib/api";

const conditionLabels = { NEW: "Jak nowa", VERY_GOOD: "Bardzo dobry", GOOD: "Dobry", ACCEPTABLE: "Zadowalający" };
const coverStyles = ["cover-1", "cover-2", "cover-3", "cover-4", "cover-5"];

export function OfferCard({ offer, index, currency, rate }: { offer: Offer; index: number; currency: string; rate: number }) {
  const price = currency === "PLN" ? offer.pricePln : Math.round((offer.pricePln * rate + Number.EPSILON) * 100) / 100;
  return <article className={`offer-card ${offer.status === "SOLD" ? "offer-card-sold" : ""}`}>
    <Link className={`book-cover ${coverStyles[index % coverStyles.length]}`} to={`/oferta/${offer.id}`} aria-label={`Zobacz ofertę: ${offer.title}`}>
      <BookOpen size={16} />
      <strong>{offer.title}</strong>
      {offer.status === "SOLD" && <span className="cover-sold">Sprzedana</span>}
    </Link>
    <div className="offer-card-content">
      <div className="offer-card-topline">
        <span className="condition-pill"><Tag size={12} /> {conditionLabels[offer.condition]}</span>
        <span className="offer-seller">{offer.seller.nickname}</span>
      </div>
      <Link className="offer-title" to={`/oferta/${offer.id}`}>{offer.title}</Link>
      <p className="offer-description">{offer.description}</p>
      <div className="offer-card-bottom">
        <div>
          <strong className="offer-price">{formatCurrency(price, currency)}</strong>
          {currency !== "PLN" && <span className="original-price">{formatCurrency(offer.pricePln, "PLN")}</span>}
        </div>
        {offer.status === "AVAILABLE"
          ? <Link className="card-link" to={`/oferta/${offer.id}`}>Szczegóły</Link>
          : <span className="sold-label"><CheckCircle2 size={14} /> Sprzedana</span>}
      </div>
    </div>
  </article>;
}

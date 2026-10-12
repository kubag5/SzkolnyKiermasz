import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, CircleHelp } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api, ApiError, type Offer, type OfferInput } from "../lib/api";

const conditions: Array<{ value: OfferInput["condition"]; label: string; detail: string }> = [
  { value: "NEW", label: "Jak nowa", detail: "bez śladów używania" },
  { value: "VERY_GOOD", label: "Bardzo dobry", detail: "prawie jak nowa" },
  { value: "GOOD", label: "Dobry", detail: "zwykłe ślady używania" },
  { value: "ACCEPTABLE", label: "Zadowalający", detail: "wszystko czytelne" },
];

export function OfferFormPage({ edit = false }: { edit?: boolean }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [condition, setCondition] = useState<OfferInput["condition"]>("GOOD");
  const [loading, setLoading] = useState(edit);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");

  useEffect(() => {
    if (!edit || !id) return;
    let active = true;
    api<Offer>(`/api/offers/${id}`).then((offer) => {
      if (offer.sellerId !== user?.id) { navigate("/moje-oferty", { replace: true }); return; }
      if (active) {
        setTitle(offer.title);
        setDescription(offer.description);
        setPrice(String(offer.pricePln));
        setCondition(offer.condition);
      }
    }).catch((loadError) => { if (active) setError(loadError instanceof ApiError ? loadError.message : "Nie udało się pobrać oferty."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [edit, id, navigate, user?.id]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFieldError("");
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    const numericPrice = Number(price.replace(",", "."));
    if (cleanTitle.length < 2 || cleanTitle.length > 120) return setFieldError("Tytuł musi mieć od 2 do 120 znaków.");
    if (cleanDescription.length < 5 || cleanDescription.length > 1200) return setFieldError("Opis musi mieć od 5 do 1200 znaków.");
    if (!Number.isFinite(numericPrice) || numericPrice < 0.01 || numericPrice > 100000) return setFieldError("Podaj cenę od 0,01 do 100 000 zł.");

    const payload: OfferInput = { title: cleanTitle, description: cleanDescription, pricePln: numericPrice, condition };
    setBusy(true);
    try {
      const offer = await api<Offer>(edit ? `/api/offers/${id}` : "/api/offers", {
        method: edit ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      navigate(`/oferta/${offer.id}`, { replace: true });
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : "Nie udało się zapisać oferty.");
    } finally { setBusy(false); }
  }

  if (loading) return <div className="page-loading" role="status">Ładowanie...</div>;

  return <div className="page-container form-page">
    <Link className="back-link dark-back-link" to={edit ? `/oferta/${id}` : "/moje-oferty"}>
      <ArrowLeft size={16} /> {edit ? "Wróć do oferty" : "Wróć do moich ofert"}
    </Link>
    <div className="offer-form-layout">
      <section className="offer-form-intro">
        <h1>{edit ? "Edycja oferty" : "Nowa oferta"}</h1>
        <p>Podaj tytuł, opis, stan i cenę w PLN. Oferta będzie widoczna pod nickiem {user?.nickname}.</p>
      </section>
      <form className="offer-form-card" onSubmit={submit} noValidate>
        <h2>Dane książki</h2>
        <label className="field">
          <span>Tytuł *</span>
          <input className="plain-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="np. Matematyka 2" maxLength={120} required />
          <small>{title.length}/120</small>
        </label>
        <label className="field">
          <span>Opis *</span>
          <textarea className="plain-input textarea-input" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Stan, wydanie, uwagi..." maxLength={1200} rows={5} required />
          <small>{description.length}/1200</small>
        </label>
        <div className="form-columns">
          <label className="field">
            <span>Cena *</span>
            <div className="input-wrap price-input price-field">
              <input type="number" min="0.01" max="100000" step="0.01" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="0,00" required />
              <span>PLN</span>
            </div>
          </label>
          <label className="field">
            <span>Stan</span>
            <select className="select-control" value={condition} onChange={(event) => setCondition(event.target.value as OfferInput["condition"])}>
              {conditions.map((item) => <option key={item.value} value={item.value}>{item.label} ({item.detail})</option>)}
            </select>
          </label>
        </div>
        <p className="form-currency-note"><CircleHelp size={14} /> Kupujący mogą zobaczyć cenę też w EUR lub USD.</p>
        {fieldError && <p className="form-message form-message-error" role="alert">{fieldError}</p>}
        {error && <p className="form-message form-message-error" role="alert">{error}</p>}
        <div className="form-submit-row">
          <Link className="cancel-link" to={edit ? `/oferta/${id}` : "/moje-oferty"}>Anuluj</Link>
          <button className="button button-dark" type="submit" disabled={busy}>
            {busy ? "Zapisywanie..." : edit ? "Zapisz zmiany" : "Opublikuj"}
          </button>
        </div>
      </form>
    </div>
  </div>;
}

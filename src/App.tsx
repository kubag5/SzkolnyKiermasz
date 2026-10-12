import { useState } from "react";
import { BookOpen, ChevronDown, LogOut, Menu, Plus, UserRound } from "lucide-react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { AuthPage } from "./pages/AuthPage";
import { OfferDetailPage } from "./pages/OfferDetailPage";
import { OfferFormPage } from "./pages/OfferFormPage";
import { OffersPage } from "./pages/OffersPage";
import { MyOffersPage } from "./pages/MyOffersPage";

function RequireUser({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="page-loading" role="status">Ładowanie...</div>;
  if (!user) return <Navigate to="/zaloguj" replace state={{ from: location.pathname }} />;
  return children;
}

function Header() {
  const { user, signOut } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  async function handleSignOut() {
    try {
      await signOut();
      setAccountOpen(false);
      setSignOutError("");
    } catch {
      setSignOutError("Nie udało się wylogować. Spróbuj ponownie.");
    }
  }

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" to="/" aria-label="Szkolny kiermasz - strona główna">
            <span className="brand-mark"><BookOpen size={19} strokeWidth={2.2} /></span>
            <span>Szkolny kiermasz</span>
          </Link>
          <nav className={`main-nav ${navOpen ? "is-open" : ""}`} aria-label="Główna nawigacja">
            <Link to="/" onClick={() => setNavOpen(false)}>Oferty</Link>
            {user && <Link to="/moje-oferty" onClick={() => setNavOpen(false)}>Moje oferty</Link>}
          </nav>
          <div className="header-actions">
            {user ? (
              <>
                <Link className="button button-primary button-small header-sell" to="/wystaw"><Plus size={16} /> Dodaj ofertę</Link>
                <div className="account-menu">
                  <button className="account-trigger" type="button" aria-expanded={accountOpen} onClick={() => { setNavOpen(false); setAccountOpen((open) => !open); }}>
                    <span className="avatar">{user.nickname.slice(0, 1).toUpperCase()}</span>
                    <span className="account-name">{user.nickname}</span>
                    <ChevronDown size={15} />
                  </button>
                  {accountOpen && <div className="account-dropdown">
                    <Link to="/moje-oferty" onClick={() => setAccountOpen(false)}><UserRound size={16} /> Moje oferty</Link>
                    <button type="button" onClick={() => void handleSignOut()}><LogOut size={16} /> Wyloguj</button>
                  </div>}
                </div>
              </>
            ) : (
              <>
                <Link className="header-login" to="/zaloguj">Zaloguj się</Link>
                <Link className="button button-primary button-small" to="/rejestracja">Zarejestruj się</Link>
              </>
            )}
            <button className="mobile-menu-button" type="button" aria-label={navOpen ? "Zamknij menu" : "Otwórz menu"} aria-expanded={navOpen} onClick={() => { setAccountOpen(false); setNavOpen((open) => !open); }}><Menu size={21} /></button>
          </div>
        </div>
      </header>
      {signOutError && <div className="toast-error" role="alert">{signOutError}</div>}
    </>
  );
}

export function App() {
  return <div className="app-root">
    <Header />
    <main>
      <Routes>
        <Route path="/" element={<OffersPage />} />
        <Route path="/zaloguj" element={<AuthPage mode="login" />} />
        <Route path="/rejestracja" element={<AuthPage mode="register" />} />
        <Route path="/oferta/:id" element={<OfferDetailPage />} />
        <Route path="/wystaw" element={<RequireUser><OfferFormPage /></RequireUser>} />
        <Route path="/oferta/:id/edytuj" element={<RequireUser><OfferFormPage edit /></RequireUser>} />
        <Route path="/moje-oferty" element={<RequireUser><MyOffersPage /></RequireUser>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </main>
    <footer className="site-footer">
      <div className="footer-inner">
        <span className="footer-brand"><BookOpen size={17} /> Szkolny kiermasz</span>
        <a href="https://frankfurter.dev/" target="_blank" rel="noreferrer">Kursy walut: Frankfurter API</a>
      </div>
    </footer>
  </div>;
}

function NotFound() {
  return <section className="empty-state page-narrow">
    <h1>Nie znaleziono strony</h1>
    <p>Wróć do listy ofert.</p>
    <Link className="button button-primary" to="/">Oferty</Link>
  </section>;
}

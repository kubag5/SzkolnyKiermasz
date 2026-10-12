import { useState, type FormEvent } from "react";
import { ArrowLeft, Eye, EyeOff, LockKeyhole, UserRound } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api, ApiError, type User } from "../lib/api";

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const isRegister = mode === "register";
  const navigate = useNavigate();
  const location = useLocation();
  const { refresh } = useAuth();
  const [username, setUsername] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFormError("");
    const cleanUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(cleanUsername)) {
      setFormError("Login: 3-24 znaki, tylko małe litery, cyfry lub podkreślenia.");
      return;
    }
    if (password.length < 8 || password.length > 72) {
      setFormError("Hasło musi mieć od 8 do 72 znaków.");
      return;
    }
    if (isRegister && nickname.trim().length < 2) {
      setFormError("Nick musi mieć co najmniej 2 znaki.");
      return;
    }

    setBusy(true);
    try {
      await (isRegister
        ? api<{ user: User }>("/api/auth/register", { method: "POST", body: JSON.stringify({ username: cleanUsername, nickname: nickname.trim(), password }) })
        : api<{ user: User }>("/api/auth/login", { method: "POST", body: JSON.stringify({ username: cleanUsername, password }) }));
      await refresh();
      const target = (location.state as { from?: string } | null)?.from ?? (isRegister ? "/wystaw" : "/");
      navigate(target, { replace: true });
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : "Nie udało się połączyć z aplikacją.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="auth-layout">
    <div className="auth-main">
      <Link className="back-link" to="/"><ArrowLeft size={16} /> Wróć do ofert</Link>
      <div className="auth-form-wrap">
        <h2>{isRegister ? "Rejestracja" : "Logowanie"}</h2>
        <p className="auth-subtitle">{isRegister ? "Załóż konto, żeby wystawiać oferty." : "Zaloguj się, żeby zarządzać swoimi ofertami."}</p>
        <form className="stack-form" onSubmit={submit} noValidate>
          {isRegister && (
            <label className="field">
              <span>Nick</span>
              <div className="input-wrap">
                <UserRound size={17} />
                <input autoComplete="nickname" maxLength={32} value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Twój nick" required />
              </div>
            </label>
          )}
          <label className="field">
            <span>Login</span>
            <div className="input-wrap">
              <UserRound size={17} />
              <input autoComplete="username" minLength={3} maxLength={24} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="np. ola_12" required />
            </div>
            <small>3-24 znaki: małe litery, cyfry lub _</small>
          </label>
          <label className="field">
            <span>Hasło</span>
            <div className="input-wrap">
              <LockKeyhole size={17} />
              <input autoComplete={isRegister ? "new-password" : "current-password"} type={passwordVisible ? "text" : "password"} maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 8 znaków" required />
              <button className="input-action" type="button" aria-label={passwordVisible ? "Ukryj hasło" : "Pokaż hasło"} onClick={() => setPasswordVisible((visible) => !visible)}>
                {passwordVisible ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </label>
          {formError && <p className="form-message form-message-error" role="alert">{formError}</p>}
          {error && <p className="form-message form-message-error" role="alert">{error}</p>}
          <button className="button button-primary button-wide auth-submit" type="submit" disabled={busy}>
            {busy ? "Ładowanie..." : isRegister ? "Utwórz konto" : "Zaloguj się"}
          </button>
        </form>
        <p className="auth-switch">
          {isRegister ? "Masz już konto?" : "Nie masz konta?"}{" "}
          <Link to={isRegister ? "/zaloguj" : "/rejestracja"}>{isRegister ? "Zaloguj się" : "Zarejestruj się"}</Link>
        </p>
        <p className="privacy-note">Publicznie widać tylko nick. Nie prosimy o dane kontaktowe.</p>
      </div>
    </div>
  </section>;
}

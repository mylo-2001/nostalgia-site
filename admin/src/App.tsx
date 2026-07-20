import { useCallback, useEffect, useState } from "react";
import { checkSession, clearAdminClientSession, api, type AdminSessionState } from "./api/client";
import { Login } from "./pages/Login";
import { MfaSetup } from "./pages/MfaSetup";
import { Layout, type Section } from "./components/Layout";
import { Overview } from "./pages/Overview";
import { Orders } from "./pages/Orders";
import { NewProduct } from "./pages/NewProduct";
import { Products } from "./pages/Products";
import { Coupons } from "./pages/Coupons";
import { Reviews } from "./pages/Reviews";
import { Users } from "./pages/Users";
import { Newsletter } from "./pages/Newsletter";
import { Messages } from "./pages/Messages";
import { Analytics } from "./pages/Analytics";
import { Audit } from "./pages/Audit";
import { Operations } from "./pages/Operations";
import { Settings } from "./pages/Settings";

const SECTIONS: Section[] = [
  { id: "overview", label: "Επισκόπηση" },
  { id: "orders", label: "Παραγγελίες" },
  { id: "new-product", label: "Νέο προϊόν" },
  { id: "products", label: "Προϊόντα & Stock" },
  { id: "coupons", label: "Κουπόνια" },
  { id: "reviews", label: "Κριτικές" },
  { id: "users", label: "Πελάτες" },
  { id: "newsletter", label: "Newsletter" },
  { id: "messages", label: "Μηνύματα" },
  { id: "analytics", label: "Analytics" },
  { id: "operations", label: "Λειτουργία συστήματος" },
  { id: "audit", label: "Αρχείο ενεργειών" },
  { id: "settings", label: "Ρυθμίσεις" },
];

function render(section: string, goTo: (s: string) => void) {
  switch (section) {
    case "overview": return <Overview onNavigate={goTo} />;
    case "orders": return <Orders />;
    case "new-product": return <NewProduct />;
    case "products": return <Products />;
    case "coupons": return <Coupons />;
    case "reviews": return <Reviews />;
    case "users": return <Users />;
    case "newsletter": return <Newsletter />;
    case "messages": return <Messages />;
    case "analytics": return <Analytics />;
    case "operations": return <Operations />;
    case "audit": return <Audit />;
    case "settings": return <Settings />;
    default: return <Overview onNavigate={goTo} />;
  }
}

export function App() {
  const [authState, setAuthState] = useState<AdminSessionState | "checking">("checking");
  const [section, setSection] = useState("overview");

  const refreshSession = useCallback(async () => {
    setAuthState(await checkSession());
  }, []);

  useEffect(() => { void refreshSession(); }, [refreshSession]);

  if (authState === "checking") return <div className="login"><p className="muted">Έλεγχος σύνδεσης…</p></div>;
  if (authState === "anonymous") return <Login onLoggedIn={() => void refreshSession()} />;

  async function logout() {
    await api.post("/api/admin/logout");
    clearAdminClientSession();
    setAuthState("anonymous");
  }

  if (authState === "mfa_setup") {
    return <MfaSetup onComplete={() => setAuthState("authenticated")} onLogout={() => void logout()} />;
  }

  return (
    <Layout sections={SECTIONS} active={section} onSelect={setSection} onLogout={logout}>
      {render(section, setSection)}
    </Layout>
  );
}

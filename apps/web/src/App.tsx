import { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  Briefcase,
  FileText,
  Link2,
  Loader2,
  LogOut,
  Settings2,
  ShieldCheck,
  Smartphone,
  Zap,
} from 'lucide-react';
import { api, type CatalogResponse, type UatUser } from './api/client';
import { UnderwritingWizard } from './components/UnderwritingWizard';
import { QuotesPoliciesView } from './components/QuotesPoliciesView';
import { BrokerReportsView } from './components/BrokerReportsView';
import { EcosystemBridgeView } from './components/EcosystemBridgeView';
import { UatAccessGate } from './components/UatAccessGate';
import { RemarksDrawer } from './components/RemarksDrawer';
import { AdminControlPanel } from './components/AdminControlPanel';

type TabKey = 'underwrite' | 'quotes' | 'reports' | 'ecosystem' | 'admin';
type ModeKey = 'BROKER' | 'CLIENT_APP';

export default function App() {
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<UatUser | null>(null);
  const [uatStatus, setUatStatus] = useState<{
    testingOpen: boolean;
    sandboxBannerText: string;
  }>({
    testingOpen: true,
    sandboxBannerText:
      'SANDBOX TEST ONLY — Mock TRA/TIRA data. Cover notes generated here are NOT valid for road use.',
  });

  const [mode, setMode] = useState<ModeKey>('BROKER');
  const [tab, setTab] = useState<TabKey>('underwrite');
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resumeQuoteId, setResumeQuoteId] = useState<string | null>(null);
  const [ecosystemPlate, setEcosystemPlate] = useState<string>('');
  const [wizardCtx, setWizardCtx] = useState<{
    screen: string;
    plate?: string | null;
    quoteNumber?: string | null;
  }>({ screen: 'New Cover · Step 1: Plate Lookup' });

  // Bootstrap UAT status & current session
  useEffect(() => {
    Promise.all([api.getUatStatus(), api.getUatMe()])
      .then(([status, me]) => {
        setUatStatus(status);
        if (me.authenticated && me.user) {
          setUser(me.user);
          if (me.user.role === 'CLIENT_USER') {
            setMode('CLIENT_APP');
          }
        }
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setAuthLoading(false));
  }, []);

  // Load rating catalog once authenticated
  useEffect(() => {
    if (!user) return;
    setError(null);
    api
      .getCatalog()
      .then(setCatalog)
      .catch((e) => setError((e as Error).message));
  }, [user]);

  const handleResumeQuote = (quoteId: string) => {
    setResumeQuoteId(quoteId);
    setTab('underwrite');
  };

  const handleVerifyInEcosystem = (plate: string) => {
    setEcosystemPlate(plate);
    setTab('ecosystem');
  };

  const handleLogout = async () => {
    await api.uatLogout().catch(() => {});
    setUser(null);
    setCatalog(null);
    setTab('underwrite');
  };

  const handleWizardCtx = useCallback(
    (ctx: { screen: string; plate?: string | null; quoteNumber?: string | null }) => {
      setWizardCtx(ctx);
    },
    [],
  );

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 bg-slate-50 text-sm text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin text-sky-600" aria-hidden="true" />
        Checking CoverFlow UAT session...
      </div>
    );
  }

  if (!user) {
    return (
      <UatAccessGate
        testingOpen={uatStatus.testingOpen}
        sandboxBannerText={uatStatus.sandboxBannerText}
        onAuthenticated={(u) => {
          setUser(u);
          if (u.role === 'CLIENT_USER') {
            setMode('CLIENT_APP');
            setTab('underwrite');
          }
        }}
      />
    );
  }

  const isClientLocked = user.role === 'CLIENT_USER';
  const effectiveMode: ModeKey = isClientLocked ? 'CLIENT_APP' : mode;

  const handleModeSwitch = (nextMode: ModeKey) => {
    if (isClientLocked || nextMode === mode) return;
    setMode(nextMode);
    setResumeQuoteId(null);
    if (nextMode === 'CLIENT_APP' && (tab === 'ecosystem' || tab === 'reports')) {
      setTab('underwrite');
    }
  };

  const activeScreenLabel =
    tab === 'underwrite'
      ? wizardCtx.screen
      : tab === 'quotes'
        ? 'Quotes & Issued Risk Notes'
        : tab === 'reports'
          ? 'Broker Management Reports'
          : tab === 'ecosystem'
            ? 'ClaimFlow Ecosystem Bridge'
            : 'Admin Control Panel';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Persistent Sandbox Test Watermark Ribbon */}
      <div className="bg-amber-400 px-4 py-1.5 text-center text-[11px] font-extrabold tracking-wide text-amber-950">
        {uatStatus.sandboxBannerText}
      </div>

      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-600 to-indigo-700 text-white shadow-sm">
              <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold tracking-tight text-slate-900">CoverFlow</h1>
                <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-800 ring-1 ring-sky-200">
                  V1 UAT
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Signed in as <strong className="text-slate-700">{user.email}</strong>
              </p>
            </div>
          </div>

          {/* Primary Navigation */}
          <nav aria-label="Main navigation" className="flex flex-wrap items-center gap-1">
            {(
              [
                { id: 'underwrite', label: 'New Cover', icon: Zap },
                {
                  id: 'quotes',
                  label: effectiveMode === 'CLIENT_APP' ? 'My Stickers' : 'Quotes & Risk Notes',
                  icon: FileText,
                },
                ...(effectiveMode === 'BROKER'
                  ? [
                      { id: 'reports' as TabKey, label: 'Reports', icon: BarChart3 },
                      { id: 'ecosystem' as TabKey, label: 'ClaimFlow Bridge', icon: Link2 },
                    ]
                  : []),
                ...(user.role === 'ADMIN'
                  ? [{ id: 'admin' as TabKey, label: 'Admin & Remarks', icon: Settings2 }]
                  : []),
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition sm:text-sm ${
                  tab === item.id
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <item.icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </button>
            ))}
          </nav>

          {/* Right Controls: Experience Mode + Sign Out */}
          <div className="flex items-center gap-2">
            {!isClientLocked && (
              <div
                role="group"
                aria-label="Experience mode"
                className="inline-flex rounded-xl bg-slate-100 p-1"
              >
                <button
                  type="button"
                  onClick={() => handleModeSwitch('BROKER')}
                  className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                    effectiveMode === 'BROKER'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Briefcase className="h-3.5 w-3.5 text-sky-600" aria-hidden="true" />
                  Broker
                </button>
                <button
                  type="button"
                  onClick={() => handleModeSwitch('CLIENT_APP')}
                  className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                    effectiveMode === 'CLIENT_APP'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Smartphone className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                  Client App
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleLogout}
              title="Sign out"
              aria-label="Sign out"
              className="inline-flex min-h-[38px] items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 pb-24 sm:px-6 lg:py-8">
        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-900">
            <strong>Error:</strong> {error}
          </div>
        ) : !catalog ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-sky-600" aria-hidden="true" />
            Loading TIRA MRO rating catalog...
          </div>
        ) : tab === 'underwrite' ? (
          <UnderwritingWizard
            mode={effectiveMode}
            catalog={catalog}
            resumeQuoteId={resumeQuoteId}
            onQuoteCleared={() => setResumeQuoteId(null)}
            onVerifyInEcosystem={handleVerifyInEcosystem}
            onContextChange={handleWizardCtx}
          />
        ) : tab === 'quotes' ? (
          <QuotesPoliciesView
            mode={effectiveMode}
            user={user}
            onResumeQuote={handleResumeQuote}
            onVerifyInEcosystem={effectiveMode === 'BROKER' ? handleVerifyInEcosystem : undefined}
            onStartNew={() => {
              setResumeQuoteId(null);
              setTab('underwrite');
            }}
          />
        ) : tab === 'reports' && effectiveMode === 'BROKER' ? (
          <BrokerReportsView catalog={catalog} onResumeQuote={handleResumeQuote} />
        ) : tab === 'ecosystem' && effectiveMode === 'BROKER' ? (
          <EcosystemBridgeView initialPlate={ecosystemPlate} />
        ) : (
          <AdminControlPanel />
        )}
      </main>

      {/* Always-available Floating Broker Remarks Drawer */}
      <RemarksDrawer
        user={user}
        mode={effectiveMode}
        currentScreen={activeScreenLabel}
        activePlate={tab === 'underwrite' ? wizardCtx.plate : ecosystemPlate || null}
        activeQuoteNumber={tab === 'underwrite' ? wizardCtx.quoteNumber : null}
      />
    </div>
  );
}

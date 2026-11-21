import { useState } from 'react';
import { AlertTriangle, KeyRound, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';
import { api, type UatUser } from '../api/client';

interface UatAccessGateProps {
  testingOpen: boolean;
  sandboxBannerText: string;
  onAuthenticated: (user: UatUser) => void;
}

export function UatAccessGate({
  testingOpen,
  sandboxBannerText,
  onAuthenticated,
}: UatAccessGateProps) {
  const [email, setEmail] = useState('');
  const [passcode, setPasscode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.uatLogin({ email, passcode });
      onAuthenticated(res.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <div className="bg-amber-400 px-4 py-2 text-center text-xs font-bold text-amber-950">
        {sandboxBannerText}
      </div>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
        <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-lg sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-600 to-indigo-700 text-white shadow-sm">
              <ShieldCheck className="h-7 w-7" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
                CoverFlow Private UAT
              </h1>
              <p className="text-xs text-slate-500">
                Invite-only Broker & Client Motor Underwriting Sandbox
              </p>
            </div>
          </div>

          {!testingOpen && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
              <span>
                Broker testing is currently paused by the administrator. Only Admin accounts can sign in right now.
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="uat-email" className="block text-sm font-semibold text-slate-800">
                Approved Gmail Address
              </label>
              <span id="uat-email-hint" className="mb-1.5 block text-xs text-slate-500">
                Use the exact Gmail address approved by the CoverFlow team
              </span>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="uat-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  aria-describedby="uat-email-hint"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="yourname@gmail.com"
                  className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-4 text-sm text-slate-900"
                />
              </div>
            </div>

            <div>
              <label htmlFor="uat-passcode" className="block text-sm font-semibold text-slate-800">
                Access Passcode
              </label>
              <span id="uat-pass-hint" className="mb-1.5 block text-xs text-slate-500">
                Shared in your WhatsApp or Email invitation
              </span>
              <div className="relative">
                <KeyRound
                  className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="uat-passcode"
                  name="passcode"
                  type="password"
                  required
                  autoComplete="current-password"
                  aria-describedby="uat-pass-hint"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter UAT access passcode"
                  className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-4 text-sm text-slate-900"
                />
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800"
              >
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              )}
              {busy ? 'Verifying Access...' : 'Enter CoverFlow Sandbox'}
            </button>
          </form>

          <div className="mt-6 rounded-xl bg-slate-50 p-3.5 text-[11px] leading-relaxed text-slate-600">
            <strong className="text-slate-800">View & Test Only:</strong> All vehicle lookups, TIRA
            stickers, and payment webhooks are simulated. Your feedback and remarks inside the app
            are logged against your Gmail to help us finalize V1.
          </div>
        </div>
      </main>
    </div>
  );
}

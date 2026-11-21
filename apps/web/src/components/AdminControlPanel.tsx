import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Download,
  KeyRound,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Shield,
  Trash2,
  UserPlus,
} from 'lucide-react';
import {
  api,
  type AllowedTesterRecord,
  type BrokerRemarkRecord,
} from '../api/client';

export function AdminControlPanel() {
  const [loading, setLoading] = useState(true);
  const [testingOpen, setTestingOpen] = useState(true);
  const [brokerAccessCode, setBrokerAccessCode] = useState('');
  const [testers, setTesters] = useState<AllowedTesterRecord[]>([]);
  const [remarks, setRemarks] = useState<BrokerRemarkRecord[]>([]);

  // Add tester form
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newOrg, setNewOrg] = useState('');
  const [newExpires, setNewExpires] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getAdminOverview();
      setTestingOpen(data.settings.testingOpen);
      setBrokerAccessCode(data.settings.brokerAccessCode);
      setTesters(data.testers);
      setRemarks(data.remarks);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleKillSwitch = async () => {
    setBusy(true);
    try {
      const res = await api.updateAdminSettings({ testingOpen: !testingOpen });
      setTestingOpen(res.settings.testingOpen);
      setNotice(
        res.settings.testingOpen
          ? 'Broker testing resumed. Approved Gmails can sign in.'
          : 'Master Kill-Switch activated! All non-admin broker sessions are now blocked.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (brokerAccessCode.trim().length < 4) return;
    setBusy(true);
    try {
      const res = await api.updateAdminSettings({ brokerAccessCode });
      setBrokerAccessCode(res.settings.brokerAccessCode);
      setNotice(`Broker invite passcode updated to "${res.settings.brokerAccessCode}".`);
    } finally {
      setBusy(false);
    }
  };

  const handleAddTester = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newName.trim()) return;
    setBusy(true);
    try {
      await api.addAllowedTester({
        email: newEmail.trim(),
        name: newName.trim(),
        organization: newOrg.trim() || undefined,
        role: 'BROKER_TESTER',
        expiresAt: newExpires ? `${newExpires}T23:59:59Z` : null,
      });
      setNewEmail('');
      setNewName('');
      setNewOrg('');
      setNewExpires('');
      setNotice('Approved broker Gmail added to allowlist.');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const copyInviteMessage = () => {
    const url = window.location.origin;
    const text = `Hi! You're invited to test CoverFlow (our new <3-min Motor Underwriting sandbox).\n\nLink: ${url}\nSign in with your approved Gmail address\nAccess Passcode: ${brokerAccessCode}\n\nPlease try any sample plate (e.g. T101ABC, T999ECS, T450DLD) and click the purple "Leave Remark" button on any screen to share your feedback. Note: Sandbox test only (not live TIRA).`;
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Header & Master Kill-Switch */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-900 p-6 text-white shadow-sm">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/20 px-3 py-1 text-xs font-bold text-sky-200 ring-1 ring-sky-400/30">
            <Shield className="h-3.5 w-3.5" aria-hidden="true" />
            ADMIN UAT CONTROL CENTER (HIDDEN FROM BROKERS)
          </div>
          <h2 className="mt-2 text-2xl font-extrabold">
            Access Control & Broker Remarks
          </h2>
          <p className="mt-1 text-sm text-slate-300">
            Manage approved Gmail testers, rotate the invite passcode, pause testing instantly, and export structured broker feedback.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={copyInviteMessage}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white ring-1 ring-white/20 hover:bg-white/20"
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
            {copiedInvite ? 'Copied Broker Invite!' : 'Copy WhatsApp / Email Invite'}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={toggleKillSwitch}
            className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition ${
              testingOpen
                ? 'bg-rose-600 text-white hover:bg-rose-700'
                : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
            }`}
          >
            {testingOpen ? (
              <>
                <PauseCircle className="h-4 w-4" aria-hidden="true" />
                Pause All Broker Access
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4" aria-hidden="true" />
                Resume Broker Access
              </>
            )}
          </button>
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            {notice}
          </span>
          <button type="button" onClick={() => setNotice(null)} className="text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Passcode & Add Approved Gmail */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <form
          onSubmit={handleAddTester}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-7"
        >
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <UserPlus className="h-5 w-5 text-sky-600" aria-hidden="true" />
            Approve a Broker Gmail Account
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="adm-email" className="block text-xs font-semibold text-slate-700">
                Broker Gmail Address *
              </label>
              <input
                id="adm-email"
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="brokername@gmail.com"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="adm-name" className="block text-xs font-semibold text-slate-700">
                Full Name *
              </label>
              <input
                id="adm-name"
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Abubakar Zakaria"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="adm-org" className="block text-xs font-semibold text-slate-700">
                Brokerage / Company
              </label>
              <input
                id="adm-org"
                type="text"
                value={newOrg}
                onChange={(e) => setNewOrg(e.target.value)}
                placeholder="e.g. Kangaroo Insurance Brokers"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="adm-exp" className="block text-xs font-semibold text-slate-700">
                Optional Access Expiry Date
              </label>
              <input
                id="adm-exp"
                type="date"
                value={newExpires}
                onChange={(e) => setNewExpires(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-sky-600 px-5 py-2 text-sm font-bold text-white hover:bg-sky-700 disabled:opacity-60"
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Add to Approved Allowlist
          </button>
        </form>

        <form
          onSubmit={handleUpdateCode}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-5"
        >
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <KeyRound className="h-5 w-5 text-amber-600" aria-hidden="true" />
            Broker Invite Passcode
          </h3>
          <p className="text-xs text-slate-500">
            Brokers need BOTH an approved Gmail AND this passcode. Rotate it anytime to stop new logins from old invitations.
          </p>
          <div>
            <label htmlFor="adm-code" className="block text-xs font-semibold text-slate-700">
              Current Broker Access Code
            </label>
            <input
              id="adm-code"
              type="text"
              required
              minLength={4}
              value={brokerAccessCode}
              onChange={(e) => setBrokerAccessCode(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-mono-code font-bold text-slate-900"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-slate-900 px-5 py-2 text-sm font-bold text-white hover:bg-slate-800"
          >
            Update Passcode
          </button>
        </form>
      </div>

      {/* Approved Gmail Allowlist Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-base font-bold text-slate-900">
            Approved Gmail Allowlist ({testers.length})
          </h3>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Tester</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Active</th>
                <th className="px-4 py-3 text-right">Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {testers.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-900">{t.name}</div>
                    <div className="font-mono-code text-slate-500">
                      {t.email} {t.organization ? `· ${t.organization}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 font-bold ${
                        t.role === 'ADMIN'
                          ? 'bg-indigo-50 text-indigo-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {t.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 font-bold ${
                        t.active
                          ? 'bg-emerald-50 text-emerald-800'
                          : 'bg-rose-50 text-rose-800'
                      }`}
                    >
                      {t.active ? 'Active' : 'Revoked'}
                    </span>
                    {t.expiresAt && (
                      <div className="mt-0.5 text-[11px] text-slate-400">
                        Exp: {t.expiresAt.slice(0, 10)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {t.lastSeenAt ? new Date(t.lastSeenAt).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {t.role !== 'ADMIN' && (
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            await api.updateAllowedTester(t.id, { active: !t.active });
                            await load();
                          }}
                          className={`rounded-lg px-2.5 py-1.5 font-bold ${
                            t.active
                              ? 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                              : 'border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                          }`}
                        >
                          {t.active ? 'Revoke' : 'Re-Approve'}
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove ${t.email}`}
                          onClick={async () => {
                            await api.deleteAllowedTester(t.id);
                            await load();
                          }}
                          className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Broker Remarks Log + CSV Export */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Broker Remarks & UAT Feedback ({remarks.length})
            </h3>
            <p className="text-xs text-slate-500">
              Every remark submitted from the floating button with automatic screen, plate & quote context.
            </p>
          </div>
          <a
            href="/api/v1/uat/admin/remarks.csv"
            className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </a>
        </div>

        {remarks.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No broker remarks submitted yet. Click the purple <strong>Leave Remark</strong> button in the bottom-right corner to test it!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Broker</th>
                  <th className="px-4 py-3">Category / Rating</th>
                  <th className="px-4 py-3">Context</th>
                  <th className="px-4 py-3">Remark</th>
                  <th className="px-4 py-3">Triage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {remarks.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{r.testerName}</div>
                      <div className="font-mono-code text-slate-500">{r.testerEmail}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 font-bold text-indigo-800">
                        {r.category}
                      </span>
                      {r.rating && <div className="mt-1 text-amber-600">{'★'.repeat(r.rating)}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div>{r.screen}</div>
                      <div className="font-mono-code text-[11px] text-slate-400">
                        {r.mode} {r.plate ? `· ${r.plate}` : ''} {r.quoteNumber ? `· ${r.quoteNumber}` : ''}
                      </div>
                    </td>
                    <td className="max-w-sm px-4 py-3 text-slate-800">{r.comment}</td>
                    <td className="px-4 py-3">
                      <select
                        aria-label="Remark status"
                        value={r.status}
                        onChange={async (e) => {
                          await api.updateRemarkStatus(
                            r.id,
                            e.target.value as 'NEW' | 'REVIEWED' | 'RESOLVED',
                          );
                          await load();
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold"
                      >
                        <option value="NEW">New</option>
                        <option value="REVIEWED">Reviewed</option>
                        <option value="RESOLVED">Resolved</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

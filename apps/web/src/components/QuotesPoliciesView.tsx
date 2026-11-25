import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Building2,
  FileText,
  Lock,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { api, formatTzs, type HydratedQuote, type UatUser } from '../api/client';
import { StickerCard } from './StickerCard';

interface QuotesPoliciesViewProps {
  mode: 'BROKER' | 'CLIENT_APP';
  user: UatUser;
  onResumeQuote: (quoteId: string) => void;
  onVerifyInEcosystem?: (plate: string) => void;
  onStartNew: () => void;
}

const STATUS_BADGE: Record<string, string> = {
  QUOTED: 'bg-sky-50 text-sky-800 ring-sky-200',
  REFERRED: 'bg-amber-50 text-amber-800 ring-amber-200',
  ISSUE_READY: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  PAYMENT_PENDING: 'bg-orange-50 text-orange-800 ring-orange-200',
  PAYMENT_CONFIRMED: 'bg-teal-50 text-teal-800 ring-teal-200',
  PAYMENT_REVERSED: 'bg-rose-50 text-rose-800 ring-rose-200',
  TIRA_REJECTED: 'bg-rose-50 text-rose-800 ring-rose-200',
  ISSUED: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  DELIVERED: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
};

export function QuotesPoliciesView({
  mode,
  user,
  onResumeQuote,
  onVerifyInEcosystem,
  onStartNew,
}: QuotesPoliciesViewProps) {
  const scope: 'client' | 'broker' = mode === 'CLIENT_APP' ? 'client' : 'broker';
  const [quotes, setQuotes] = useState<HydratedQuote[]>([]);
  const [policies, setPolicies] = useState<Awaited<ReturnType<typeof api.listPolicies>>['policies']>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<'policies' | 'quotes'>(
    mode === 'CLIENT_APP' ? 'policies' : 'quotes',
  );

  const load = async () => {
    setLoading(true);
    try {
      const [qRes, pRes] = await Promise.all([api.listQuotes(scope), api.listPolicies(scope)]);
      setQuotes(qRes.quotes);
      setPolicies(pRes.policies);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSubTab(mode === 'CLIENT_APP' ? 'policies' : 'quotes');
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            {mode === 'CLIENT_APP' ? 'My Sticker Wallet & Saved Quotes' : 'Quotations & Issued Risk Notes'}
          </h2>
          <p className="text-sm text-slate-500">
            Strict separation between saved quotations and TIRA-verified issued cover notes.
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {mode === 'CLIENT_APP' ? (
              <>
                <Lock className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                Private Client View · Showing only covers belonging to{' '}
                <span className="font-mono-code text-slate-900">{user.email}</span>
              </>
            ) : (
              <>
                <Building2 className="h-3.5 w-3.5 text-sky-600" aria-hidden="true" />
                {user.role === 'ADMIN'
                  ? 'Admin Oversight · Viewing all UAT brokerage records'
                  : `Brokerage Workspace · Scoped to ${user.organization ?? user.email}`}
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </button>
          <button
            type="button"
            onClick={onStartNew}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
          >
            + New Cover
          </button>
        </div>
      </div>

      <div className="inline-flex rounded-xl bg-slate-200/70 p-1">
        <button
          type="button"
          onClick={() => setSubTab('quotes')}
          className={`inline-flex min-h-[40px] items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
            subTab === 'quotes'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="h-4 w-4" aria-hidden="true" />
          Quotations ({quotes.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('policies')}
          className={`inline-flex min-h-[40px] items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
            subTab === 'policies'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Wallet className="h-4 w-4" aria-hidden="true" />
          Issued Stickers & Risk Notes ({policies.length})
        </button>
      </div>

      {subTab === 'policies' ? (
        policies.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <ShieldCheck className="mx-auto h-10 w-10 text-slate-400" aria-hidden="true" />
            <h3 className="mt-3 text-base font-semibold text-slate-900">
              No issued TIRA cover notes yet
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Complete a quote, confirm payment, and submit to TIRA MIS to generate your first digital motor sticker.
            </p>
            <button
              type="button"
              onClick={onStartNew}
              className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-700"
            >
              Start a 2-Minute Cover
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {policies.map((p) => (
              <StickerCard
                key={p.id}
                policy={{
                  ...p,
                  insurerName: p.insurer?.name,
                }}
                onVerifyInEcosystem={mode === 'BROKER' ? onVerifyInEcosystem : undefined}
              />
            ))}
          </div>
        )
      ) : quotes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <FileText className="mx-auto h-10 w-10 text-slate-400" aria-hidden="true" />
          <h3 className="mt-3 text-base font-semibold text-slate-900">No quotations saved yet</h3>
          <p className="mt-1 text-sm text-slate-500">
            Enter a vehicle registration number to generate an instant quote in under 60 seconds.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3.5">Quote #</th>
                  <th className="px-4 py-3.5">Vehicles</th>
                  <th className="px-4 py-3.5">Customer</th>
                  <th className="px-4 py-3.5">Insurer</th>
                  <th className="px-4 py-3.5">Payable</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quotes.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-900 font-mono-code">
                        {q.quoteNumber}
                      </div>
                      <div className="text-xs text-slate-500">
                        v{q.activeVersion} · {q.channel === 'BROKER' ? 'Broker' : 'Client App'}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      {q.items.map((item) => (
                        <div key={item.id} className="flex items-center gap-1.5">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-bold font-mono-code text-slate-800">
                            {item.vehicle.normalizedPlate}
                          </span>
                          <span className="text-xs text-slate-600">
                            {item.vehicle.make} {item.vehicle.model} ({item.coverType})
                          </span>
                        </div>
                      ))}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-slate-900">
                        {q.customer?.fullName ?? 'Pending KYC'}
                      </div>
                      <div className="text-xs text-slate-500">{q.customer?.phone ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">
                      {q.insurer?.shortName ?? q.insurerCode}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-900">
                        {formatTzs(q.totalPayableTzs)}
                      </div>
                      {q.payments[0] && (
                        <div className="text-xs text-slate-500 font-mono-code">
                          Ctrl: {q.payments[0].controlNumber}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                          STATUS_BADGE[q.status] ?? 'bg-slate-100 text-slate-700 ring-slate-200'
                        }`}
                      >
                        {q.statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <a
                          href={`/api/v1/documents/quotes/${q.id}/quotation.pdf?scope=${scope}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Quote PDF
                        </a>
                        {mode === 'BROKER' && (
                          <a
                            href={`/api/v1/documents/quotes/${q.id}/debit-note.pdf?scope=broker`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                          >
                            Debit Note
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => onResumeQuote(q.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                        >
                          Open
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

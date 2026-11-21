import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, MessageSquarePlus, Send, Star, X } from 'lucide-react';
import { api, type BrokerRemarkRecord, type UatUser } from '../api/client';

interface RemarksDrawerProps {
  user: UatUser;
  mode: 'BROKER' | 'CLIENT_APP';
  currentScreen: string;
  activePlate?: string | null;
  activeQuoteNumber?: string | null;
}

const CATEGORIES: Array<{ id: BrokerRemarkRecord['category']; label: string }> = [
  { id: 'PRICING', label: 'Pricing / Rates' },
  { id: 'MISSING_FIELD', label: 'Missing Field / Rule' },
  { id: 'CONFUSING_STEP', label: 'Confusing Step' },
  { id: 'BUG', label: 'Bug / Error' },
  { id: 'GREAT', label: 'Works Great!' },
];

export function RemarksDrawer({
  user,
  mode,
  currentScreen,
  activePlate,
  activeQuoteNumber,
}: RemarksDrawerProps) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<BrokerRemarkRecord['category']>('PRICING');
  const [rating, setRating] = useState<number>(4);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [myRemarks, setMyRemarks] = useState<BrokerRemarkRecord[]>([]);

  useEffect(() => {
    if (!open) return;
    api
      .getMyRemarks()
      .then((r) => setMyRemarks(r.remarks))
      .catch(() => {});
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (comment.trim().length < 3) return;
    setBusy(true);
    setError(null);
    setSavedMsg(null);
    try {
      const res = await api.submitRemark({
        category,
        rating,
        mode,
        screen: currentScreen,
        plate: activePlate ?? null,
        quoteNumber: activeQuoteNumber ?? null,
        comment,
      });
      setMyRemarks((prev) => [res.remark, ...prev]);
      setComment('');
      setSavedMsg('Thank you! Your remark was logged directly to the CoverFlow team.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 inline-flex min-h-[48px] items-center gap-2 rounded-full bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg ring-2 ring-white transition hover:bg-indigo-700"
      >
        <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
        Leave Remark
      </button>

      {/* Slide-over Drawer */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="remarks-drawer-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 id="remarks-drawer-title" className="text-base font-extrabold text-slate-900">
                  Share Broker / Tester Remark
                </h2>
                <p className="text-xs text-slate-500">
                  Signed in as <strong>{user.email}</strong>
                </p>
              </div>
              <button
                type="button"
                aria-label="Close remarks drawer"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              {/* Auto-Captured Context */}
              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                <div className="font-bold text-slate-800">Auto-captured context:</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <span className="rounded bg-white px-2 py-0.5 font-medium ring-1 ring-slate-200">
                    {mode === 'BROKER' ? 'Broker Portal' : 'Client App'}
                  </span>
                  <span className="rounded bg-white px-2 py-0.5 font-medium ring-1 ring-slate-200">
                    {currentScreen}
                  </span>
                  {activePlate && (
                    <span className="rounded bg-white px-2 py-0.5 font-mono-code font-bold ring-1 ring-slate-200">
                      {activePlate}
                    </span>
                  )}
                  {activeQuoteNumber && (
                    <span className="rounded bg-white px-2 py-0.5 font-mono-code font-bold ring-1 ring-slate-200">
                      {activeQuoteNumber}
                    </span>
                  )}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <fieldset>
                  <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Remark Category
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((c) => (
                      <label
                        key={c.id}
                        className={`cursor-pointer rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                          category === c.id
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="remarkCategory"
                          checked={category === c.id}
                          onChange={() => setCategory(c.id)}
                          className="visually-hidden"
                        />
                        {c.label}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div>
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Experience Rating (1–5)
                  </span>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setRating(n)}
                        aria-label={`Rate ${n} out of 5`}
                        className={`flex h-9 w-9 items-center justify-center rounded-lg border transition ${
                          rating >= n
                            ? 'border-amber-300 bg-amber-50 text-amber-500'
                            : 'border-slate-200 bg-white text-slate-300'
                        }`}
                      >
                        <Star className="h-4 w-4 fill-current" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="remark-text" className="block text-sm font-semibold text-slate-800">
                    Your Remark / Observation
                  </label>
                  <span className="mb-1.5 block text-xs text-slate-500">
                    Tell us what works well, what rate/field needs adjustment, or what felt slow.
                  </span>
                  <textarea
                    id="remark-text"
                    rows={4}
                    required
                    minLength={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="e.g. Great speed on T101ABC! For Daladala buses, we also need..."
                    className="w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-900"
                  />
                </div>

                {error && (
                  <div role="alert" className="rounded-xl bg-rose-50 p-3 text-xs text-rose-800">
                    {error}
                  </div>
                )}

                {savedMsg && (
                  <div
                    role="status"
                    className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                    {savedMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Send className="h-4 w-4" aria-hidden="true" />
                  )}
                  Submit Remark
                </button>
              </form>

              {/* Tester's own submitted remarks */}
              {myRemarks.length > 0 && (
                <div className="border-t border-slate-200 pt-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Your Submitted Remarks ({myRemarks.length})
                  </h3>
                  <div className="mt-2.5 space-y-2">
                    {myRemarks.map((r) => (
                      <div key={r.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800">{r.category}</span>
                          <span className="text-[11px] text-slate-400">
                            {new Date(r.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-1 text-slate-700">{r.comment}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

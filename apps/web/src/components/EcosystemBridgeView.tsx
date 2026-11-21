import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Link2,
  Search,
  Send,
  Wrench,
} from 'lucide-react';
import type { EcosystemPolicyVerification } from '@coverflow/domain';
import { api, formatTzs } from '../api/client';

interface EcosystemBridgeViewProps {
  initialPlate?: string;
}

export function EcosystemBridgeView({ initialPlate = '' }: EcosystemBridgeViewProps) {
  const [plate, setPlate] = useState(initialPlate || 'T101ABC');
  const [result, setResult] = useState<EcosystemPolicyVerification | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState<string | null>(null);

  const verify = async (targetPlate: string) => {
    if (!targetPlate.trim()) return;
    setLoading(true);
    setFeedbackSent(null);
    try {
      const res = await api.verifyEcosystemPolicy(targetPlate);
      setResult(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialPlate) {
      setPlate(initialPlate);
      verify(initialPlate);
    }
  }, [initialPlate]);

  const simulateClaimFlowFeedback = async () => {
    if (!result?.found || !result.vehicle) return;
    const claimId = `CLM-${Date.now().toString().slice(-5)}`;
    await api.submitClaimsFeedback({
      normalizedPlate: result.vehicle.normalizedPlate,
      policyNo: result.policyNo,
      claimFlowClaimId: claimId,
      lossDate: new Date().toISOString().slice(0, 10),
      claimStatus: 'SETTLED',
    });
    setFeedbackSent(
      `ClaimFlow recorded verified claim ${claimId} for ${result.vehicle.normalizedPlate}. Next time this plate is quoted in CoverFlow, its verified claim history will automatically surface!`,
    );
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 p-6 text-white shadow-sm">
        <div className="inline-flex items-center gap-2 rounded-full bg-sky-400/20 px-3 py-1 text-xs font-semibold text-sky-200 ring-1 ring-sky-300/30">
          <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
          CONNECTED ECOSYSTEM CONTRACT
        </div>
        <h2 className="mt-3 text-2xl font-bold">
          CoverFlow ↔ ClaimFlow ↔ AutoFix GMS Bridge
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-300">
          When you connect ClaimFlow and AutoFix GMS repositories later, they call these exact
          versioned REST contracts to verify active TIRA cover, read exact excess rules, inspect
          pre-cover baseline photos, and feed verified claims history back to underwriting.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            verify(plate);
          }}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <label htmlFor="eco-plate" className="block text-sm font-semibold text-slate-800">
              Simulate ClaimFlow / AutoFix GMS Lookup by Registration Plate
            </label>
            <span className="mb-1.5 block text-xs text-slate-500">
              Calls <code className="font-mono-code text-sky-700">GET /api/v1/ecosystem/policies/verify?plate=...</code>
            </span>
            <input
              id="eco-plate"
              type="text"
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              autoCorrect="off"
              spellCheck={false}
              placeholder="e.g. T101ABC"
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 font-mono-code font-bold uppercase tracking-wider text-slate-900"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            {loading ? 'Querying...' : 'Verify Active Cover'}
          </button>
        </form>

        {result && (
          <div className="mt-6 space-y-5" role="status" aria-live="polite">
            {!result.found ? (
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
                <div>
                  <div className="font-semibold">No issued CoverFlow policy found for {plate}</div>
                  <p className="mt-0.5 text-xs text-amber-800">
                    Issue a policy in the Underwriting flow first, then query the same plate here to see the live ClaimFlow & AutoFix GMS handoff payload.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      ClaimFlow FNOL Verification Ready
                    </div>
                    <dl className="mt-3 space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Cover Note / Sticker:</dt>
                        <dd className="font-mono-code font-semibold text-slate-900">
                          {result.coverNoteNo} / {result.stickerNo}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Insurer & Cover:</dt>
                        <dd className="font-semibold text-slate-900">
                          {result.insurerName} ({result.coverType})
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Sum Insured:</dt>
                        <dd className="font-semibold text-slate-900">
                          {formatTzs(result.sumInsuredTzs)}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Claims-Free Source:</dt>
                        <dd className="font-medium text-slate-800">
                          {result.claimsFreeDeclaration?.status.replace(/_/g, ' ')}
                        </dd>
                      </div>
                      <div className="pt-1 text-xs text-slate-600">
                        <strong>Excess Terms:</strong> {result.excess?.standardDescription}
                      </div>
                    </dl>
                  </div>

                  <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-800">
                      <Wrench className="h-4 w-4" aria-hidden="true" />
                      AutoFix GMS Vehicle Identity Payload
                    </div>
                    <dl className="mt-3 space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Vehicle:</dt>
                        <dd className="font-semibold text-slate-900">
                          {result.vehicle?.manufactureYear} {result.vehicle?.make}{' '}
                          {result.vehicle?.model}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Chassis / VIN:</dt>
                        <dd className="font-mono-code font-semibold text-slate-900">
                          {result.vehicle?.chassisNo}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Engine No:</dt>
                        <dd className="font-mono-code font-semibold text-slate-900">
                          {result.vehicle?.engineNo}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Baseline Photos:</dt>
                        <dd className="inline-flex items-center gap-1 font-semibold text-sky-900">
                          <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                          {result.preCoverPhotos?.length ?? 0} timestamped photo(s)
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs text-slate-600">
                    <strong>Test Bi-Directional Feedback Loop:</strong> Simulate ClaimFlow reporting a
                    settled claim back to CoverFlow so renewal pricing updates from{' '}
                    <em>self-declared</em> to <em>verified claim record</em>.
                  </div>
                  <button
                    type="button"
                    onClick={simulateClaimFlowFeedback}
                    className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    <Send className="h-3.5 w-3.5" aria-hidden="true" />
                    Simulate ClaimFlow Settled Claim
                  </button>
                </div>

                {feedbackSent && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm font-medium text-emerald-900">
                    {feedbackSent}
                  </div>
                )}

                <details className="rounded-xl border border-slate-200 bg-slate-900 p-4 text-xs text-slate-200">
                  <summary className="cursor-pointer font-semibold text-sky-300">
                    View Raw JSON Ecosystem Contract Payload
                  </summary>
                  <pre className="mt-3 overflow-x-auto font-mono-code text-[11px] leading-relaxed">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </details>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

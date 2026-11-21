import { CheckCircle2, Download, ExternalLink, QrCode, ShieldCheck } from 'lucide-react';
import { formatTzs } from '../api/client';

interface StickerCardProps {
  policy: {
    id: string;
    policyNo: string;
    coverNoteNo: string;
    stickerNo: string;
    insurerCode: string;
    insurerName?: string;
    coverType: string;
    startDate: string;
    endDate: string;
    sumInsuredTzs: number;
    totalPayableTzs: number;
    firstLossPayee?: string | null;
    vehicle: {
      normalizedPlate: string;
      make: string;
      model: string;
      manufactureYear: number;
      chassisNo: string;
      color: string;
    };
    customer: {
      fullName: string;
      phone: string;
    };
  };
  onVerifyInEcosystem?: (plate: string) => void;
}

export function StickerCard({ policy, onVerifyInEcosystem }: StickerCardProps) {
  return (
    <article className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
      <div className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 px-6 py-5 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-2.5 py-1 text-xs font-semibold text-emerald-100 ring-1 ring-emerald-300/30">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              TIRA001 · VERIFIED ACTIVE COVER
            </div>
            <h3 className="mt-2.5 text-2xl font-extrabold tracking-tight font-mono-code">
              {policy.vehicle.normalizedPlate}
            </h3>
            <p className="text-sm text-emerald-100">
              {policy.vehicle.manufactureYear} {policy.vehicle.make} {policy.vehicle.model} ·{' '}
              {policy.vehicle.color}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white text-emerald-950 shadow-inner">
              <QrCode className="h-10 w-10" aria-hidden="true" />
            </div>
            <span className="text-[11px] font-medium text-emerald-200">TIRA QR Embedded in PDF</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl bg-black/20 p-3.5 sm:grid-cols-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-emerald-200/80">
              TIRA Sticker No.
            </div>
            <div className="mt-0.5 text-sm font-bold font-mono-code">{policy.stickerNo}</div>
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-emerald-200/80">
              Cover Note No.
            </div>
            <div className="mt-0.5 text-sm font-bold font-mono-code">{policy.coverNoteNo}</div>
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-emerald-200/80">
              Validity Period
            </div>
            <div className="mt-0.5 text-sm font-semibold">
              {policy.startDate} → {policy.endDate}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-6 py-4">
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <div className="text-xs text-slate-500">Insured</div>
            <div className="font-semibold text-slate-900">{policy.customer.fullName}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Insurer</div>
            <div className="font-semibold text-slate-900">
              {policy.insurerName ?? policy.insurerCode}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Cover Type</div>
            <div className="font-semibold text-slate-900">{policy.coverType}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Total Paid</div>
            <div className="font-semibold text-emerald-700">
              {formatTzs(policy.totalPayableTzs)}
            </div>
          </div>
        </div>

        {policy.firstLossPayee && (
          <div className="flex items-center gap-2 rounded-lg bg-sky-50 px-3 py-2 text-xs font-medium text-sky-900">
            <ShieldCheck className="h-4 w-4 text-sky-600" aria-hidden="true" />
            First Loss Payee: {policy.firstLossPayee}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5 border-t border-slate-100 pt-3">
          <a
            href={`/api/v1/documents/policies/${policy.id}/cover-note.pdf`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Download Cover Note & QR Sticker (PDF)
          </a>

          {onVerifyInEcosystem && (
            <button
              type="button"
              onClick={() => onVerifyInEcosystem(policy.vehicle.normalizedPlate)}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <ExternalLink className="h-4 w-4 text-sky-600" aria-hidden="true" />
              Test ClaimFlow Verification
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

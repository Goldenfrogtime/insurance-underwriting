import {
  CheckCircle2,
  ClipboardList,
  Download,
  ExternalLink,
  FileText,
  Trash2,
  Upload,
} from 'lucide-react';
import type { ProposalQuestionnaire } from '@coverflow/domain';

export const DEFAULT_PROPOSAL_ANSWERS: ProposalQuestionnaire = {
  previousInsurer: '',
  overnightParking: 'GATED_COMPOUND',
  priorDeclinedOrCancelled: false,
  priorDeclinedDetails: '',
  accidentsOrLossesLast3Years: false,
  accidentsDetails: '',
  vehicleModifiedOrDefective: false,
  modificationDetails: '',
  driverConvictionsOrUnder25: false,
  driverDetails: '',
};

interface ProposalQuestionnaireSectionProps {
  quoteId: string;
  mode: 'BROKER' | 'CLIENT_APP';
  answers: ProposalQuestionnaire;
  onChange: (next: ProposalQuestionnaire) => void;
  existingSignedFileName: string | null;
  hasExistingSignedUpload: boolean;
  pendingFileName: string;
  pendingFileDataUrl: string;
  markedForRemoval: boolean;
  onPickSignedFile: (fileName: string, dataUrl: string) => void;
  onClearSignedFile: () => void;
  onError: (msg: string) => void;
}

const YES_NO_QUESTIONS: Array<{
  flagKey:
    | 'priorDeclinedOrCancelled'
    | 'accidentsOrLossesLast3Years'
    | 'vehicleModifiedOrDefective'
    | 'driverConvictionsOrUnder25';
  detailKey:
    | 'priorDeclinedDetails'
    | 'accidentsDetails'
    | 'modificationDetails'
    | 'driverDetails';
  question: string;
  placeholder: string;
}> = [
  {
    flagKey: 'priorDeclinedOrCancelled',
    detailKey: 'priorDeclinedDetails',
    question:
      'Has any insurer ever declined, cancelled, or imposed special terms on your motor insurance?',
    placeholder: 'State insurer name, year, and reason...',
  },
  {
    flagKey: 'accidentsOrLossesLast3Years',
    detailKey: 'accidentsDetails',
    question: 'Any motor accidents, theft, or third-party claims in the last 3 years?',
    placeholder: 'Briefly describe date, incident, and approximate claim amount...',
  },
  {
    flagKey: 'vehicleModifiedOrDefective',
    detailKey: 'modificationDetails',
    question:
      'Has the vehicle been modified from factory specs or does it have any known safety defect?',
    placeholder: 'Describe body conversion, engine swap, or defect...',
  },
  {
    flagKey: 'driverConvictionsOrUnder25',
    detailKey: 'driverDetails',
    question:
      'Will any regular driver be under 25, hold < 2 years driving license, or have motoring convictions?',
    placeholder: 'Provide driver age / license duration or conviction details...',
  },
];

export function ProposalQuestionnaireSection({
  quoteId,
  mode,
  answers,
  onChange,
  existingSignedFileName,
  hasExistingSignedUpload,
  pendingFileName,
  pendingFileDataUrl,
  markedForRemoval,
  onPickSignedFile,
  onClearSignedFile,
  onError,
}: ProposalQuestionnaireSectionProps) {
  const scopeParam = mode === 'CLIENT_APP' ? 'client' : 'broker';
  const displayedFileName = pendingFileName
    ? pendingFileName
    : !markedForRemoval && hasExistingSignedUpload
      ? existingSignedFileName || 'signed-proposal'
      : '';

  const handlePaperFileChange = (file: File | null) => {
    if (!file) return;
    const isPdf = file.type === 'application/pdf';
    const isImage = file.type.startsWith('image/');
    if (!isPdf && !isImage) {
      onError('Signed proposal form must be a PDF or image (JPG, PNG, WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      onError('Signed proposal file must be under 5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onPickSignedFile(file.name, String(reader.result || ''));
    };
    reader.onerror = () => onError('Could not read the selected proposal file.');
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4 rounded-xl border border-sky-200 bg-sky-50/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
            <ClipboardList className="h-4 w-4 text-sky-600" aria-hidden="true" />
            Digital Motor Proposal Questionnaire
          </div>
          <p className="mt-0.5 text-[11px] text-slate-600">
            Answers below automatically populate the downloadable <strong>Proposal Form PDF</strong>.
            You may also upload a wet-signed paper form if preferred.
          </p>
        </div>
        <a
          href={`/api/v1/documents/quotes/${quoteId}/proposal.pdf?scope=${scopeParam}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-white px-2.5 py-1 text-[11px] font-bold text-sky-800 hover:bg-sky-50"
        >
          <Download className="h-3 w-3" aria-hidden="true" />
          Preview Proposal PDF
        </a>
      </div>

      {/* Previous Insurer & Overnight Parking */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="prop-prev-insurer" className="block text-xs font-semibold text-slate-700">
            Previous Motor Insurer (Optional)
          </label>
          <input
            id="prop-prev-insurer"
            type="text"
            value={answers.previousInsurer ?? ''}
            onChange={(e) => onChange({ ...answers, previousInsurer: e.target.value })}
            placeholder="e.g. Jubilee Allianz, Britam, or First-time"
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
          />
        </div>
        <div>
          <label htmlFor="prop-parking" className="block text-xs font-semibold text-slate-700">
            Usual Overnight Parking
          </label>
          <select
            id="prop-parking"
            value={answers.overnightParking}
            onChange={(e) =>
              onChange({
                ...answers,
                overnightParking: e.target.value as ProposalQuestionnaire['overnightParking'],
              })
            }
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
          >
            <option value="GATED_COMPOUND">Gated / Watchman Compound</option>
            <option value="LOCKED_GARAGE">Locked Private Garage</option>
            <option value="COMMERCIAL_YARD">Commercial Fleet Yard / Depot</option>
            <option value="STREET_OR_PUBLIC">Street / Open Public Parking</option>
          </select>
        </div>
      </div>

      {/* 4 Material Disclosure Yes/No Questions */}
      <div className="space-y-2">
        {YES_NO_QUESTIONS.map((item, idx) => {
          const isYes = Boolean(answers[item.flagKey]);
          const detailVal = answers[item.detailKey] ?? '';
          return (
            <div
              key={item.flagKey}
              className={`rounded-xl border p-3 transition ${
                isYes
                  ? 'border-amber-300 bg-amber-50/70'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex-1 text-xs font-medium text-slate-800">
                  <strong className="text-slate-500">{idx + 1}.</strong> {item.question}
                </span>
                <div className="inline-flex shrink-0 rounded-lg bg-slate-100 p-0.5 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...answers,
                        [item.flagKey]: false,
                        [item.detailKey]: '',
                      })
                    }
                    className={`rounded-md px-2.5 py-1 transition ${
                      !isYes ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    No
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...answers,
                        [item.flagKey]: true,
                      })
                    }
                    className={`rounded-md px-2.5 py-1 transition ${
                      isYes ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Yes
                  </button>
                </div>
              </div>

              {isYes && (
                <div className="mt-2">
                  <input
                    type="text"
                    value={detailVal}
                    onChange={(e) =>
                      onChange({
                        ...answers,
                        [item.detailKey]: e.target.value,
                      })
                    }
                    placeholder={item.placeholder}
                    className="w-full rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs text-slate-900"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Optional Signed Paper Proposal Form Upload */}
      <div className="rounded-xl border border-slate-200 bg-white p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-bold text-slate-900">
              Signed Paper Proposal Form (Optional)
            </div>
            <p className="text-[11px] text-slate-500">
              If the client signed a physical paper proposal, attach the scanned PDF or photo here.
            </p>
          </div>
          {displayedFileName && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              {pendingFileDataUrl ? 'Ready to save' : 'Attached'}
            </span>
          )}
        </div>

        <input
          id="signed-paper-proposal-input"
          type="file"
          accept="application/pdf,image/*"
          onChange={(e) => {
            const picked = e.target.files?.[0] ?? null;
            e.target.value = '';
            handlePaperFileChange(picked);
          }}
          className="visually-hidden"
        />

        {displayedFileName ? (
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs">
            <div className="flex min-w-0 items-center gap-2 text-emerald-950">
              <FileText className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
              <span className="truncate font-semibold">{displayedFileName}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {!pendingFileDataUrl && hasExistingSignedUpload && !markedForRemoval && (
                <a
                  href={`/api/v1/documents/quotes/${quoteId}/signed-proposal?scope=${scopeParam}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-white px-2 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-50"
                >
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  View
                </a>
              )}
              <label
                htmlFor="signed-paper-proposal-input"
                className="cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
              >
                Replace
              </label>
              <button
                type="button"
                onClick={onClearSignedFile}
                aria-label="Remove signed paper proposal"
                className="rounded-md border border-rose-200 bg-white p-1 text-rose-700 hover:bg-rose-50"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : (
          <label
            htmlFor="signed-paper-proposal-input"
            className="mt-2.5 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:border-sky-400 hover:bg-sky-50"
          >
            <Upload className="h-4 w-4 text-sky-600" aria-hidden="true" />
            Attach Signed Paper Proposal (PDF or Photo, max 5 MB)
          </label>
        )}
      </div>
    </div>
  );
}

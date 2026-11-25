import { useRef, useState } from 'react';
import {
  Building2,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  FileText,
  Landmark,
  Loader2,
  Shield,
  Smartphone,
  Upload,
} from 'lucide-react';
import type { PaymentMethod, PaymentState } from '@coverflow/domain';
import { api, formatTzs, type HydratedQuote } from '../api/client';

type MobileNetwork = 'MPESA' | 'MIXX_YAS' | 'AIRTEL_MONEY' | 'HALOPESA';

interface PaymentPanelProps {
  mode: 'BROKER' | 'CLIENT_APP';
  quote: HydratedQuote;
  defaultPhone: string;
  actionBusy: boolean;
  onQuoteUpdated: (quote: HydratedQuote, notice: string) => void;
  onError: (msg: string) => void;
  onBindTira: () => void;
}

const NETWORK_GUIDES: Record<
  MobileNetwork,
  {
    name: string;
    ussd: string;
    enSteps: (bizNo: string, ctrlNo: string, amount: string) => string[];
    swSteps: (bizNo: string, ctrlNo: string, amount: string) => string[];
  }
> = {
  MPESA: {
    name: 'M-Pesa (Vodacom)',
    ussd: '*150*00#',
    enSteps: (biz, ctrl, amt) => [
      `Dial *150*00# on your Vodacom line (or open the M-Pesa App)`,
      `Select 4 — Pay by M-Pesa, then 4 — Enter Business Number`,
      `Enter Business Number: ${biz}`,
      `Enter Reference / Control Number: ${ctrl}`,
      `Enter exact amount: ${amt}`,
      `Enter your M-Pesa PIN and press 1 to confirm`,
    ],
    swSteps: (biz, ctrl, amt) => [
      `Piga *150*00# kwenye laini yako ya Vodacom (au fungua M-Pesa App)`,
      `Chagua 4 — Lipa kwa M-Pesa, kisha 4 — Weka Namba ya Kampuni`,
      `Weka Namba ya Kampuni: ${biz}`,
      `Weka Namba ya Kumbukumbu (Control No.): ${ctrl}`,
      `Weka kiasi kamili: ${amt}`,
      `Weka namba yako ya siri (PIN) na bonyeza 1 kuthibitisha`,
    ],
  },
  MIXX_YAS: {
    name: 'Mixx by Yas (Tigo Pesa)',
    ussd: '*150*01#',
    enSteps: (biz, ctrl, amt) => [
      `Dial *150*01# on your Yas / Tigo line (or open Mixx by Yas App)`,
      `Select 4 — Pay Bill, then 3 — Enter Business Number`,
      `Enter Business Number: ${biz}`,
      `Enter Reference / Control Number: ${ctrl}`,
      `Enter exact amount: ${amt} and confirm with your PIN`,
    ],
    swSteps: (biz, ctrl, amt) => [
      `Piga *150*01# kwenye laini yako ya Yas / Tigo (au fungua Mixx by Yas App)`,
      `Chagua 4 — Lipa Bili, kisha 3 — Ingiza Namba ya Kampuni`,
      `Weka Namba ya Kampuni: ${biz}`,
      `Weka Namba ya Kumbukumbu (Control No.): ${ctrl}`,
      `Weka kiasi kamili: ${amt} kisha weka PIN kuthibitisha`,
    ],
  },
  AIRTEL_MONEY: {
    name: 'Airtel Money',
    ussd: '*150*60#',
    enSteps: (biz, ctrl, amt) => [
      `Dial *150*60# on your Airtel line`,
      `Select 5 — Make Payments, then 4 — Enter Business Number`,
      `Enter Business Number: ${biz}`,
      `Enter Reference / Control Number: ${ctrl}`,
      `Enter exact amount: ${amt} and confirm with your PIN`,
    ],
    swSteps: (biz, ctrl, amt) => [
      `Piga *150*60# kwenye laini yako ya Airtel`,
      `Chagua 5 — Lipia Bili, kisha 4 — Weka Namba ya Kampuni`,
      `Weka Namba ya Kampuni: ${biz}`,
      `Weka Namba ya Kumbukumbu (Control No.): ${ctrl}`,
      `Weka kiasi kamili: ${amt} kisha weka PIN kuthibitisha`,
    ],
  },
  HALOPESA: {
    name: 'HaloPesa',
    ussd: '*150*88#',
    enSteps: (biz, ctrl, amt) => [
      `Dial *150*88# on your Halotel line`,
      `Select 4 — Pay Bills, then 3 — Business Number`,
      `Enter Business Number: ${biz}, Reference: ${ctrl}, Amount: ${amt}`,
      `Enter your HaloPesa PIN to confirm`,
    ],
    swSteps: (biz, ctrl, amt) => [
      `Piga *150*88# kwenye laini yako ya Halotel`,
      `Chagua 4 — Lipa Bili, kisha 3 — Namba ya Kampuni`,
      `Weka Namba ya Kampuni: ${biz}, Kumbukumbu: ${ctrl}, Kiasi: ${amt}`,
      `Weka PIN yako ya HaloPesa kuthibitisha`,
    ],
  },
};

export function PaymentPanel({
  mode,
  quote,
  defaultPhone,
  actionBusy,
  onQuoteUpdated,
  onError,
  onBindTira,
}: PaymentPanelProps) {
  const bankAccounts = quote.insurer?.bankAccounts ?? [];
  const bizNumber = quote.insurer?.mobileBusinessNumber ?? '400800';

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('MOBILE_MONEY');
  const [mobileNetwork, setMobileNetwork] = useState<MobileNetwork>('MPESA');
  const [guideLang, setGuideLang] = useState<'SW' | 'EN'>('SW');
  const [selectedBank, setSelectedBank] = useState<string>(bankAccounts[0]?.bankName ?? 'CRDB Bank Plc');
  const [depositRef, setDepositRef] = useState('');
  const [proofFileName, setProofFileName] = useState('');
  const [proofDataUrl, setProofDataUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [slipError, setSlipError] = useState<string | null>(null);
  const activePaymentCardRef = useRef<HTMLDivElement>(null);
  const slipInputRef = useRef<HTMLInputElement>(null);

  const latestPayment = quote.payments[0];
  const isBusy = busy || actionBusy;

  const copyText = (key: string, value: string) => {
    navigator.clipboard?.writeText(value).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleFilePicked = (file: File | null, inputEl?: HTMLInputElement | null) => {
    setSlipError(null);
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      const msg = 'Deposit slip file must be under 5 MB.';
      setSlipError(msg);
      onError(msg);
      if (inputEl) inputEl.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setProofFileName(file.name);
      setProofDataUrl(String(reader.result || ''));
      if (inputEl) inputEl.value = '';
    };
    reader.onerror = () => {
      const msg = 'Could not read the selected deposit slip file.';
      setSlipError(msg);
      onError(msg);
      if (inputEl) inputEl.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleInitiate = async () => {
    setBusy(true);
    try {
      const res = await api.initiatePayment(quote.id, {
        method: paymentMethod,
        payerPhone: defaultPhone || undefined,
        mobileNetwork: paymentMethod === 'MOBILE_MONEY' ? mobileNetwork : undefined,
        bankName: paymentMethod === 'DIRECT_BANK_DEPOSIT' ? selectedBank : undefined,
        depositorReference:
          paymentMethod === 'DIRECT_BANK_DEPOSIT' ? depositRef.trim() || undefined : undefined,
        proofFileName:
          paymentMethod === 'DIRECT_BANK_DEPOSIT' ? proofFileName || undefined : undefined,
        proofDataUrl:
          paymentMethod === 'DIRECT_BANK_DEPOSIT' ? proofDataUrl || undefined : undefined,
      });
      onQuoteUpdated(
        res.quote,
        paymentMethod === 'DIRECT_BANK_DEPOSIT'
          ? `Direct Bank Deposit (${res.payment.controlNumber}) recorded. Awaiting insurer bank confirmation.`
          : `Payment Control Number ${res.payment.controlNumber} generated. Follow the step-by-step guide below to pay.`,
      );
      setTimeout(() => {
        activePaymentCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 60);
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleAttachProofToExisting = async () => {
    if (!latestPayment || !proofDataUrl || !proofFileName) return;
    setBusy(true);
    try {
      const res = await api.uploadPaymentProof(latestPayment.controlNumber, {
        depositorReference: depositRef.trim() || undefined,
        proofFileName,
        proofDataUrl,
      });
      onQuoteUpdated(
        res.quote,
        `Bank deposit slip "${proofFileName}" uploaded for insurer verification.`,
      );
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleSimulate = async (state: PaymentState) => {
    if (!latestPayment) return;
    setBusy(true);
    try {
      const res = await api.simulatePayment(latestPayment.controlNumber, state);
      onQuoteUpdated(res.quote, `Authoritative payment status updated: ${state}.`);
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const primaryButtonLabel =
    paymentMethod === 'MOBILE_MONEY'
      ? `Pay via ${NETWORK_GUIDES[mobileNetwork].name} · ${formatTzs(quote.totalPayableTzs)}`
      : paymentMethod === 'DIRECT_BANK_DEPOSIT'
        ? `Record Direct Bank Deposit · ${formatTzs(quote.totalPayableTzs)}`
        : paymentMethod === 'CONTROL_NUMBER_BANK'
          ? `Generate Bank Control Number · ${formatTzs(quote.totalPayableTzs)}`
          : paymentMethod === 'CORPORATE_CREDIT'
            ? `Request Insurer Credit Clearance · ${formatTzs(quote.totalPayableTzs)}`
            : `Proceed to Card Checkout · ${formatTzs(quote.totalPayableTzs)}`;

  // Always honor the user's currently clicked mobile operator immediately (0ms)
  const activeNet: MobileNetwork = mobileNetwork;
  const netGuide = NETWORK_GUIDES[activeNet];

  return (
    <div className="space-y-5">
      {/* Payment Method Selector */}
      <fieldset>
        <legend className="mb-2 text-sm font-bold text-slate-900">
          Choose Payment Method (Paid Directly to Insurer)
        </legend>
        <div className="grid grid-cols-1 gap-2">
          {(
            [
              {
                id: 'MOBILE_MONEY',
                label: 'Mobile Money (M-Pesa / Mixx / Airtel / HaloPesa)',
                sub: 'Fastest · Instant TIRA sticker on payment',
                icon: Smartphone,
              },
              {
                id: 'DIRECT_BANK_DEPOSIT',
                label: 'Direct Bank Deposit / EFT (Upload Slip)',
                sub: 'Deposit straight to Insurer CRDB / NMB / NBC account',
                icon: Landmark,
              },
              {
                id: 'CONTROL_NUMBER_BANK',
                label: 'Bank Control Number (CRDB / NMB / Wakala)',
                sub: 'Auto-reconciles at bank teller or Wakala',
                icon: CreditCard,
              },
              {
                id: 'CARD',
                label: 'Visa / Mastercard',
                sub: 'Instant card payment',
                icon: CreditCard,
              },
              ...(mode === 'BROKER'
                ? [
                    {
                      id: 'CORPORATE_CREDIT' as PaymentMethod,
                      label: 'Insurer Approved Corporate Credit',
                      sub: 'Requires insurer credit clearance',
                      icon: Building2,
                    },
                  ]
                : []),
            ] as const
          ).map((m) => (
            <label
              key={m.id}
              className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition ${
                paymentMethod === m.id
                  ? 'border-sky-600 bg-sky-50 text-sky-950 ring-1 ring-sky-600'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="payMethod"
                checked={paymentMethod === m.id}
                onChange={() => setPaymentMethod(m.id)}
                className="mt-0.5 h-4 w-4"
              />
              <m.icon className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-xs font-bold">{m.label}</span>
                <span className="block text-[11px] text-slate-500">{m.sub}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Mobile Money Network Picker */}
      {paymentMethod === 'MOBILE_MONEY' && (
        <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3.5">
          <div className="mb-2 text-xs font-bold text-sky-950">
            Select Your Mobile Money Network
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(NETWORK_GUIDES) as MobileNetwork[]).map((net) => (
              <button
                key={net}
                type="button"
                onClick={() => setMobileNetwork(net)}
                className={`rounded-lg border px-3 py-2 text-left text-xs font-bold transition ${
                  mobileNetwork === net
                    ? 'border-sky-600 bg-sky-600 text-white'
                    : 'border-sky-200 bg-white text-slate-700 hover:border-sky-400'
                }`}
              >
                <div>{NETWORK_GUIDES[net].name}</div>
                <div
                  className={`text-[10px] font-mono-code ${
                    mobileNetwork === net ? 'text-sky-100' : 'text-slate-400'
                  }`}
                >
                  {NETWORK_GUIDES[net].ussd}
                </div>
              </button>
            ))}
          </div>

          {/* Instant 0ms Preview of "How to Pay" as soon as an operator is clicked */}
          {!latestPayment && (
            <div className="mt-3 rounded-xl border border-sky-200 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-slate-900">
                  {guideLang === 'SW'
                    ? `Jinsi ya Kulipia — ${netGuide.name}`
                    : `How to Pay — ${netGuide.name}`}
                </span>
                <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setGuideLang('SW')}
                    className={`rounded-md px-2 py-0.5 ${
                      guideLang === 'SW' ? 'bg-white text-sky-800 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    Kiswahili
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuideLang('EN')}
                    className={`rounded-md px-2 py-0.5 ${
                      guideLang === 'EN' ? 'bg-white text-sky-800 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    English
                  </button>
                </div>
              </div>
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-[11px] text-slate-700">
                {(guideLang === 'SW'
                  ? netGuide.swSteps(
                      bizNumber,
                      '(Namba ya Kumbukumbu itatolewa chini)',
                      formatTzs(quote.totalPayableTzs),
                    )
                  : netGuide.enSteps(
                      bizNumber,
                      '(Control No. generated below)',
                      formatTzs(quote.totalPayableTzs),
                    )
                ).map((stepText) => (
                  <li key={stepText}>{stepText}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Direct Bank Deposit: Insurer Official Bank Details + Real Slip Uploader */}
      {paymentMethod === 'DIRECT_BANK_DEPOSIT' && (
        <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
          <div>
            <div className="text-xs font-bold text-emerald-950">
              {quote.insurer?.name} — Official Premium Bank Accounts
            </div>
            <p className="mt-0.5 text-[11px] text-emerald-900">
              Deposit the full gross premium directly into the insurer&apos;s account below (quote
              ref <strong className="font-mono-code">{quote.quoteNumber}</strong>), then upload your
              bank slip or EFT receipt.
            </p>
          </div>

          <div className="space-y-2">
            {bankAccounts.map((acc) => {
              const active = selectedBank === acc.bankName;
              return (
                <div
                  key={acc.accountNumber}
                  onClick={() => setSelectedBank(acc.bankName)}
                  className={`cursor-pointer rounded-xl border p-3 text-xs transition ${
                    active
                      ? 'border-emerald-600 bg-white ring-1 ring-emerald-600'
                      : 'border-emerald-200/80 bg-white/70 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-slate-900">{acc.bankName}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyText(acc.accountNumber, acc.accountNumber);
                      }}
                      className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-200"
                    >
                      {copiedKey === acc.accountNumber ? (
                        <Check className="h-3 w-3 text-emerald-600" aria-hidden="true" />
                      ) : (
                        <Copy className="h-3 w-3" aria-hidden="true" />
                      )}
                      {copiedKey === acc.accountNumber ? 'Copied' : 'Copy A/C'}
                    </button>
                  </div>
                  <div className="mt-1 font-mono-code text-sm font-bold text-emerald-800">
                    {acc.accountNumber}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-600">
                    {acc.accountName} · {acc.branch} ({acc.currency})
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-2.5 border-t border-emerald-200 pt-3">
            <div>
              <label htmlFor="bank-slip-ref" className="block text-xs font-semibold text-slate-800">
                Bank Slip / EFT Reference Number (Optional before deposit)
              </label>
              <input
                id="bank-slip-ref"
                type="text"
                value={depositRef}
                onChange={(e) => setDepositRef(e.target.value)}
                placeholder="e.g. CRDB-FT2632900412"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono-code"
              />
            </div>

            <div>
              <div className="block text-xs font-semibold text-slate-800">
                Upload Bank Deposit Slip / Receipt (Photo or PDF)
              </div>
              <button
                type="button"
                onClick={() => slipInputRef.current?.click()}
                className="mt-1 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-emerald-300 bg-white px-4 py-3 text-xs font-semibold text-emerald-900 hover:bg-emerald-50"
              >
                <Upload className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                {proofFileName ? `Attached: ${proofFileName}` : 'Choose photo or PDF receipt (max 5 MB)'}
              </button>
              <input
                ref={slipInputRef}
                id="bank-slip-file"
                type="file"
                accept=".pdf,application/pdf,image/*"
                onChange={(e) => handleFilePicked(e.target.files?.[0] ?? null, e.target)}
                className="hidden"
              />
              {slipError && (
                <div className="mt-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-800">
                  {slipError}
                </div>
              )}
              {proofDataUrl && proofDataUrl.startsWith('data:image/') && (
                <img
                  src={proofDataUrl}
                  alt="Uploaded bank deposit slip preview"
                  className="mt-2 max-h-36 w-full rounded-lg border border-slate-200 object-contain bg-white"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Primary Initiate Payment Button */}
      <button
        type="button"
        disabled={!quote.readiness.issueReady || isBusy}
        onClick={handleInitiate}
        className="inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {isBusy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {primaryButtonLabel}
      </button>

      {/* Active Payment Card + Self-Service Guide (EN / SW) */}
      {latestPayment && (
        <div
          ref={activePaymentCardRef}
          className="space-y-3.5 rounded-xl border border-slate-200 bg-slate-50 p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {latestPayment.method === 'DIRECT_BANK_DEPOSIT'
                ? 'Bank Deposit Tracking Ref'
                : 'Payment Control Number'}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                latestPayment.state === 'CONFIRMED'
                  ? 'bg-emerald-100 text-emerald-800'
                  : latestPayment.state === 'REVERSED' || latestPayment.state === 'UNAVAILABLE'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-amber-100 text-amber-800'
              }`}
            >
              {latestPayment.state}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="text-2xl font-extrabold tracking-wider text-slate-900 font-mono-code">
              {latestPayment.controlNumber}
            </div>
            <button
              type="button"
              onClick={() => copyText('ctrl', latestPayment.controlNumber)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
            >
              {copiedKey === 'ctrl' ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {copiedKey === 'ctrl' ? 'Copied' : 'Copy'}
            </button>
          </div>

          {/* Step-by-Step Self-Service Mobile Money Guide (EN / Swahili) */}
          {(latestPayment.method === 'MOBILE_MONEY' ||
            latestPayment.method === 'CONTROL_NUMBER_BANK') && (
            <div className="rounded-xl border border-sky-200 bg-white p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-extrabold text-slate-900">
                  {guideLang === 'SW'
                    ? `Jinsi ya Kulipia — ${netGuide.name}`
                    : `How to Pay — ${netGuide.name}`}
                </div>
                <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setGuideLang('SW')}
                    className={`rounded-md px-2 py-0.5 ${
                      guideLang === 'SW' ? 'bg-white text-sky-800 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    Kiswahili
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuideLang('EN')}
                    className={`rounded-md px-2 py-0.5 ${
                      guideLang === 'EN' ? 'bg-white text-sky-800 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    English
                  </button>
                </div>
              </div>

              {latestPayment.method === 'MOBILE_MONEY' && latestPayment.payerPhone && (
                <div className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-900">
                  {guideLang === 'SW'
                    ? `Ombi la malipo (STK Push) limetumwa kwenye ${latestPayment.payerPhone}. Unaweza kuweka PIN moja kwa moja au fuata hatua hizi:`
                    : `Payment prompt (STK Push) sent to ${latestPayment.payerPhone}. Approve on your phone, or pay manually using these steps:`}
                </div>
              )}

              <ol className="mt-2.5 list-decimal space-y-1.5 pl-4 text-xs text-slate-700">
                {(guideLang === 'SW'
                  ? netGuide.swSteps(
                      bizNumber,
                      latestPayment.controlNumber,
                      formatTzs(latestPayment.amountTzs),
                    )
                  : netGuide.enSteps(
                      bizNumber,
                      latestPayment.controlNumber,
                      formatTzs(latestPayment.amountTzs),
                    )
                ).map((stepText) => (
                  <li key={stepText}>{stepText}</li>
                ))}
              </ol>

              <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-slate-100 pt-2.5">
                <button
                  type="button"
                  onClick={() => copyText('biz', bizNumber)}
                  className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-200"
                >
                  {copiedKey === 'biz' ? '✓ Copied' : `Copy Business No: ${bizNumber}`}
                </button>
                <button
                  type="button"
                  onClick={() => copyText('amt', String(latestPayment.amountTzs))}
                  className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-200"
                >
                  {copiedKey === 'amt'
                    ? '✓ Copied'
                    : `Copy Amount: ${latestPayment.amountTzs.toLocaleString('en-US')}`}
                </button>
              </div>
            </div>
          )}

          {/* Direct Bank Deposit Status + Post-Init Proof Upload */}
          {latestPayment.method === 'DIRECT_BANK_DEPOSIT' && (
            <div className="space-y-2.5 rounded-xl border border-emerald-200 bg-white p-3.5 text-xs">
              <div className="font-bold text-slate-900">
                Bank: {latestPayment.bankName ?? selectedBank}
                {latestPayment.depositorReference && (
                  <span className="ml-2 font-mono-code font-normal text-slate-600">
                    (Ref: {latestPayment.depositorReference})
                  </span>
                )}
              </div>
              {latestPayment.proofFileName ? (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-2 text-emerald-900">
                  <FileText className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  <span className="font-semibold">Slip attached: {latestPayment.proofFileName}</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] text-amber-800">
                    No deposit slip attached yet. Upload your bank receipt below so the insurer can reconcile and release your TIRA sticker.
                  </p>
                  {proofDataUrl && proofFileName && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={handleAttachProofToExisting}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-800"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Attach &ldquo;{proofFileName}&rdquo; to Deposit
                    </button>
                  )}
                </div>
              )}
              <p className="text-[11px] text-slate-500">{latestPayment.statusMessage}</p>
            </div>
          )}

          {/* Broker WhatsApp Share Instructions */}
          {mode === 'BROKER' && (
            <button
              type="button"
              onClick={() => {
                const msg =
                  latestPayment.method === 'DIRECT_BANK_DEPOSIT'
                    ? `CoverFlow Quote ${quote.quoteNumber}: Pay ${formatTzs(quote.totalPayableTzs)} directly to ${quote.insurer?.name} (${latestPayment.bankName ?? selectedBank}). Use Quote Ref ${quote.quoteNumber} and send us the deposit slip.`
                    : `CoverFlow Quote ${quote.quoteNumber}: Pay ${formatTzs(quote.totalPayableTzs)} via M-Pesa (*150*00#) / Mixx (*150*01#) / Airtel (*150*60#). Business No: ${bizNumber}, Control No: ${latestPayment.controlNumber}.`;
                copyText('wa', msg);
              }}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              {copiedKey === 'wa'
                ? 'Copied WhatsApp Payment Instructions!'
                : 'Copy WhatsApp Payment Instructions for Client'}
            </button>
          )}

          {/* Clearly Labeled Sandbox Confirmation Simulator */}
          <div className="border-t border-slate-200 pt-3">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {latestPayment.method === 'DIRECT_BANK_DEPOSIT'
                ? 'Sandbox Insurer Bank Reconciliation Simulator'
                : 'Sandbox Payment Gateway Webhook Simulator'}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => handleSimulate('CONFIRMED')}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
              >
                {latestPayment.method === 'DIRECT_BANK_DEPOSIT'
                  ? '✓ Simulate Insurer Confirmed'
                  : '✓ Confirm Payment'}
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => handleSimulate('REVERSED')}
                className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
              >
                Simulate Reversed
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => handleSimulate('UNAVAILABLE')}
                className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-50"
              >
                Simulate Unavailable
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => handleSimulate('PENDING')}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Reset Pending
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Final Bind Button — strictly gated on authoritative payment CONFIRMED */}
      <button
        type="button"
        disabled={latestPayment?.state !== 'CONFIRMED' || isBusy}
        onClick={onBindTira}
        className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
      >
        {isBusy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Shield className="h-4 w-4" aria-hidden="true" />
        )}
        Submit to TIRA MIS & Issue Cover Note
      </button>
    </div>
  );
}

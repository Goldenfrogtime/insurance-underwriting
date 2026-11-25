import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Building2,
  CalendarClock,
  Check,
  Clock,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  Landmark,
  Loader2,
  Printer,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import {
  api,
  formatTzs,
  type BrokerReportResponse,
  type CatalogResponse,
} from '../api/client';

type ReportTab = 'production' | 'commission' | 'pending' | 'renewals';

interface BrokerReportsViewProps {
  catalog: CatalogResponse;
  onResumeQuote: (quoteId: string) => void;
}

function isoDateDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function firstDayOfMonthIso(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

export function BrokerReportsView({ catalog, onResumeQuote }: BrokerReportsViewProps) {
  const [subTab, setSubTab] = useState<ReportTab>('production');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [insurerCode, setInsurerCode] = useState('ALL');
  const [coverType, setCoverType] = useState('ALL');
  const [expiryDays, setExpiryDays] = useState('60');

  const [report, setReport] = useState<BrokerReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadReport = async (overrides?: {
    from?: string;
    to?: string;
    insurerCode?: string;
    coverType?: string;
    expiryDays?: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getBrokerReport({
        from: overrides?.from !== undefined ? overrides.from : fromDate,
        to: overrides?.to !== undefined ? overrides.to : toDate,
        insurerCode: overrides?.insurerCode !== undefined ? overrides.insurerCode : insurerCode,
        coverType: overrides?.coverType !== undefined ? overrides.coverType : coverType,
        expiryDays: overrides?.expiryDays !== undefined ? overrides.expiryDays : expiryDays,
      });
      setReport(data);
    } catch (err) {
      setError((err as Error).message || 'Could not load broker report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate, insurerCode, coverType, expiryDays]);

  const exportCsvUrl = useMemo(() => {
    const qs = new URLSearchParams({ report: subTab });
    if (fromDate) qs.set('from', fromDate);
    if (toDate) qs.set('to', toDate);
    if (insurerCode !== 'ALL') qs.set('insurerCode', insurerCode);
    if (coverType !== 'ALL') qs.set('coverType', coverType);
    if (expiryDays) qs.set('expiryDays', expiryDays);
    return `/api/v1/reports/broker/export.csv?${qs.toString()}`;
  }, [subTab, fromDate, toDate, insurerCode, coverType, expiryDays]);

  const copyRenewalMessage = (row: BrokerReportResponse['renewalRows'][0]) => {
    const msg = `Habari ${row.customerName}, bima ya gari ${row.plate} (${row.vehicleLabel}) na ${row.insurerName} (Cover Note ${row.coverNoteNo}) inaisha tarehe ${row.endDate}. Tafadhali tuwasiliane ili tukuhuishe mapema bila usumbufu.`;
    navigator.clipboard?.writeText(msg).catch(() => {});
    setCopiedId(row.policyId);
    setTimeout(() => setCopiedId(null), 2200);
  };

  const resetFilters = () => {
    setFromDate('');
    setToDate('');
    setInsurerCode('ALL');
    setCoverType('ALL');
    setExpiryDays('60');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <BarChart3 className="h-6 w-6 text-sky-600" aria-hidden="true" />
            Broker Management Reports
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Production register, insurer commission statements, open quote pipeline, and upcoming
            motor renewals.
          </p>
          {report && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              <Building2 className="h-3.5 w-3.5 text-sky-600" aria-hidden="true" />
              Scoped to: <strong className="text-slate-900">{report.scopeLabel}</strong>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => loadReport()}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
            Print / PDF
          </button>
          <a
            href={exportCsvUrl}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-800"
          >
            <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
            Export Excel CSV
          </a>
        </div>
      </div>

      {/* Filters Panel */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div>
            <label htmlFor="rep-from" className="block text-[11px] font-bold uppercase text-slate-500">
              From Date
            </label>
            <input
              id="rep-from"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
            />
          </div>
          <div>
            <label htmlFor="rep-to" className="block text-[11px] font-bold uppercase text-slate-500">
              To Date
            </label>
            <input
              id="rep-to"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
            />
          </div>
          <div>
            <label htmlFor="rep-insurer" className="block text-[11px] font-bold uppercase text-slate-500">
              Insurer
            </label>
            <select
              id="rep-insurer"
              value={insurerCode}
              onChange={(e) => setInsurerCode(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
            >
              <option value="ALL">All Insurers</option>
              {catalog.insurers.map((ins) => (
                <option key={ins.code} value={ins.code}>
                  {ins.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="rep-cover" className="block text-[11px] font-bold uppercase text-slate-500">
              Cover Type
            </label>
            <select
              id="rep-cover"
              value={coverType}
              onChange={(e) => setCoverType(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
            >
              <option value="ALL">All Cover Types</option>
              <option value="COMPREHENSIVE">Comprehensive</option>
              <option value="TPFT">Third Party Fire &amp; Theft</option>
              <option value="TPO">Third Party Only (TPO)</option>
            </select>
          </div>
          <div>
            <label htmlFor="rep-expiry" className="block text-[11px] font-bold uppercase text-slate-500">
              Renewal Window
            </label>
            <select
              id="rep-expiry"
              value={expiryDays}
              onChange={(e) => setExpiryDays(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
            >
              <option value="30">Next 30 Days</option>
              <option value="60">Next 60 Days</option>
              <option value="90">Next 90 Days</option>
              <option value="365">Next 12 Months</option>
              <option value="ALL">All Active Policies</option>
            </select>
          </div>
          <div className="flex flex-col justify-end gap-1.5">
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => {
                  setFromDate(firstDayOfMonthIso());
                  setToDate('');
                }}
                className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-200"
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => {
                  setFromDate(isoDateDaysAgo(30));
                  setToDate('');
                }}
                className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-200"
              >
                Last 30d
              </button>
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-50"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <strong>Error:</strong> {error}
        </div>
      )}

      {loading && !report ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-sky-600" aria-hidden="true" />
          Compiling brokerage reports...
        </div>
      ) : report ? (
        <>
          {/* Executive KPI Strip */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Gross Written Premium
              </div>
              <div className="mt-1 text-lg font-extrabold text-slate-900">
                {formatTzs(report.summary.totalGrossWrittenTzs)}
              </div>
              <div className="mt-0.5 text-xs text-slate-500">
                {report.summary.policyCount} issued cover note(s)
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Net Premium + 18% VAT
              </div>
              <div className="mt-1 text-lg font-extrabold text-slate-900">
                {formatTzs(report.summary.totalNetPremiumTzs)}
              </div>
              <div className="mt-0.5 text-xs text-slate-500">
                VAT: {formatTzs(report.summary.totalVatCollectedTzs)}
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                Commission Receivable
              </div>
              <div className="mt-1 text-lg font-extrabold text-emerald-950">
                {formatTzs(report.summary.totalCommissionInvoiceableTzs)}
              </div>
              <div className="mt-0.5 text-xs text-emerald-800">
                12.5%: {formatTzs(report.summary.totalBrokerCommissionTzs)} + VAT:{' '}
                {formatTzs(report.summary.totalVatOnCommissionTzs)}
              </div>
            </div>

            <div className="rounded-2xl border border-sky-200 bg-sky-50/40 p-4 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-wider text-sky-800">
                Open Quote Pipeline
              </div>
              <div className="mt-1 text-lg font-extrabold text-sky-950">
                {formatTzs(report.summary.pendingPipelineTzs)}
              </div>
              <div className="mt-0.5 text-xs text-sky-800">
                {report.summary.pendingQuoteCount} quote(s) awaiting bind
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                Renewals in Window
              </div>
              <div className="mt-1 text-lg font-extrabold text-amber-950">
                {report.summary.renewalsDueCount} policy(ies)
              </div>
              <div className="mt-0.5 text-xs text-amber-800">
                Value: {formatTzs(report.summary.renewalsDueValueTzs)}
              </div>
            </div>
          </div>

          {/* Report Sub-Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex flex-wrap rounded-xl bg-slate-200/70 p-1">
              {(
                [
                  {
                    id: 'production',
                    label: `Production Register (${report.productionRows.length})`,
                    icon: TrendingUp,
                  },
                  {
                    id: 'commission',
                    label: `Commission Statement (${report.commissionByInsurer.length})`,
                    icon: Landmark,
                  },
                  {
                    id: 'pending',
                    label: `Pending Quotes (${report.pendingRows.length})`,
                    icon: Clock,
                  },
                  {
                    id: 'renewals',
                    label: `Expiring & Renewals (${report.renewalRows.length})`,
                    icon: CalendarClock,
                  },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSubTab(t.id)}
                  className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                    subTab === t.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <t.icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* SUB-TAB 1: PRODUCTION / SALES REGISTER */}
          {subTab === 'production' && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Issued</th>
                      <th className="px-4 py-3">Cover Note / Sticker</th>
                      <th className="px-4 py-3">Insured &amp; Vehicle</th>
                      <th className="px-4 py-3">Insurer &amp; Cover</th>
                      <th className="px-4 py-3">Period</th>
                      <th className="px-4 py-3 text-right">Net Premium</th>
                      <th className="px-4 py-3 text-right">VAT (18%)</th>
                      <th className="px-4 py-3 text-right">Gross (100%)</th>
                      <th className="px-4 py-3 text-right">Docs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.productionRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                          No issued policies match the current filters.
                        </td>
                      </tr>
                    ) : (
                      report.productionRows.map((row) => (
                        <tr key={row.policyId} className="hover:bg-slate-50/70">
                          <td className="whitespace-nowrap px-4 py-3 font-mono-code text-slate-600">
                            {row.issuedDate}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-mono-code font-bold text-slate-900">
                              {row.coverNoteNo}
                            </div>
                            <div className="font-mono-code text-[10px] text-emerald-700">
                              Sticker: {row.stickerNo}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-900">{row.customerName}</div>
                            <div className="text-[11px] text-slate-500">
                              <span className="font-mono-code font-semibold text-slate-700">
                                {row.plate}
                              </span>{' '}
                              · {row.vehicleLabel}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900">{row.insurerName}</div>
                            <div className="text-[11px] text-slate-500">
                              {row.coverType} · {row.paymentMethod.replace(/_/g, ' ')}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-mono-code text-[11px] text-slate-600">
                            {row.startDate} → {row.endDate}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-mono-code text-slate-700">
                            {formatTzs(row.netPremiumTzs)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-mono-code text-slate-600">
                            {formatTzs(row.vatAmountTzs)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-mono-code font-bold text-slate-900">
                            {formatTzs(row.grossPayableTzs)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            <a
                              href={`/api/v1/documents/policies/${row.policyId}/cover-note.pdf?scope=broker`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-sky-700 hover:bg-sky-50"
                            >
                              <Download className="h-3 w-3" aria-hidden="true" />
                              PDF
                            </a>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUB-TAB 2: COMMISSION STATEMENT */}
          {subTab === 'commission' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-sky-200 bg-sky-50/60 px-4 py-3 text-xs text-sky-950">
                <strong>TIRA Cash-and-Carry Accounting:</strong> Insured clients pay{' '}
                <strong>100% Gross Premium</strong> directly to the insurer. The broker then
                invoices each insurer separately for{' '}
                <strong>12.5% Commission + 18% VAT on Commission</strong> using the breakdown below.
              </div>

              {/* Grouped by Insurer */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  Summary by Insurer (Commission Receivable)
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                    <thead className="bg-slate-50/60 text-[11px] font-bold uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Insurer</th>
                        <th className="px-4 py-3 text-right">Policies</th>
                        <th className="px-4 py-3 text-right">Net Premium</th>
                        <th className="px-4 py-3 text-right">Gross Paid to Insurer (100%)</th>
                        <th className="px-4 py-3 text-right">Broker Commission (12.5%)</th>
                        <th className="px-4 py-3 text-right">VAT on Comm (18%)</th>
                        <th className="px-4 py-3 text-right">Total Receivable</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.commissionByInsurer.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                            No issued policies in this date range.
                          </td>
                        </tr>
                      ) : (
                        report.commissionByInsurer.map((ins) => (
                          <tr key={ins.insurerCode} className="hover:bg-slate-50/70">
                            <td className="px-4 py-3 font-bold text-slate-900">{ins.insurerName}</td>
                            <td className="px-4 py-3 text-right font-mono-code">{ins.policyCount}</td>
                            <td className="px-4 py-3 text-right font-mono-code">
                              {formatTzs(ins.netPremiumTzs)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono-code font-semibold text-slate-900">
                              {formatTzs(ins.grossPayableTzs)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono-code text-emerald-800">
                              {formatTzs(ins.brokerCommissionTzs)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono-code text-emerald-700">
                              {formatTzs(ins.vatOnCommissionTzs)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono-code font-extrabold text-emerald-900">
                              {formatTzs(ins.totalCommissionInvoiceTzs)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Policy-Level Commission Detail */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  Policy-Level Commission Schedule
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                    <thead className="bg-slate-50/60 text-[11px] font-bold uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Insurer</th>
                        <th className="px-4 py-3">Cover Note / Plate</th>
                        <th className="px-4 py-3">Insured</th>
                        <th className="px-4 py-3 text-right">Net Premium</th>
                        <th className="px-4 py-3 text-right">Comm (12.5%)</th>
                        <th className="px-4 py-3 text-right">VAT (18%)</th>
                        <th className="px-4 py-3 text-right">Total Receivable</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.productionRows.map((row) => (
                        <tr key={row.policyId} className="hover:bg-slate-50/70">
                          <td className="whitespace-nowrap px-4 py-2.5 font-mono-code text-slate-600">
                            {row.issuedDate}
                          </td>
                          <td className="px-4 py-2.5 font-semibold text-slate-900">
                            {row.insurerName}
                          </td>
                          <td className="px-4 py-2.5 font-mono-code text-slate-800">
                            {row.coverNoteNo} · <strong>{row.plate}</strong>
                          </td>
                          <td className="px-4 py-2.5 text-slate-700">{row.customerName}</td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono-code">
                            {formatTzs(row.netPremiumTzs)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono-code text-emerald-800">
                            {formatTzs(row.brokerCommissionTzs)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono-code text-emerald-700">
                            {formatTzs(row.vatOnCommissionTzs)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono-code font-bold text-emerald-950">
                            {formatTzs(row.totalCommissionInvoiceTzs)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SUB-TAB 3: PENDING QUOTES PIPELINE */}
          {subTab === 'pending' && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3">Quote #</th>
                      <th className="px-4 py-3">Client &amp; Plate(s)</th>
                      <th className="px-4 py-3">Insurer &amp; Cover</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Gross Premium</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.pendingRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                          No pending quotes match the current filters.
                        </td>
                      </tr>
                    ) : (
                      report.pendingRows.map((row) => (
                        <tr key={row.quoteId} className="hover:bg-slate-50/70">
                          <td className="whitespace-nowrap px-4 py-3 font-mono-code text-slate-600">
                            {row.createdDate}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-mono-code font-bold text-slate-900">
                            {row.quoteNumber}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-900">{row.customerName}</div>
                            <div className="text-[11px] text-slate-500">
                              <span className="font-mono-code font-semibold text-slate-700">
                                {row.plates}
                              </span>
                              {row.customerPhone ? ` · ${row.customerPhone}` : ''}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900">{row.insurerName}</div>
                            <div className="text-[11px] text-slate-500">{row.coverType}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-900 ring-1 ring-amber-200">
                              {row.statusLabel}
                            </span>
                            <div className="mt-0.5 text-[10px] text-slate-500">
                              Payment: {row.paymentState}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-mono-code font-bold text-slate-900">
                            {formatTzs(row.grossPayableTzs)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => onResumeQuote(row.quoteId)}
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-slate-800"
                            >
                              Open
                              <ArrowRight className="h-3 w-3" aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUB-TAB 4: EXPIRING POLICIES & RENEWALS */}
          {subTab === 'renewals' && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Expiry Date</th>
                      <th className="px-4 py-3">Urgency</th>
                      <th className="px-4 py-3">Insured &amp; Phone</th>
                      <th className="px-4 py-3">Plate &amp; Vehicle</th>
                      <th className="px-4 py-3">Insurer &amp; Cover</th>
                      <th className="px-4 py-3 text-right">Expiring Premium</th>
                      <th className="px-4 py-3 text-right">Renewal Outreach</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.renewalRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                          No policies expiring within the selected renewal window. Try switching{' '}
                          <strong>Renewal Window</strong> to &ldquo;All Active Policies&rdquo;.
                        </td>
                      </tr>
                    ) : (
                      report.renewalRows.map((row) => {
                        const badgeClass =
                          row.daysRemaining < 0
                            ? 'bg-rose-100 text-rose-800'
                            : row.daysRemaining <= 15
                              ? 'bg-rose-50 text-rose-800 ring-1 ring-rose-200'
                              : row.daysRemaining <= 30
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200';
                        const badgeLabel =
                          row.daysRemaining < 0
                            ? `Expired ${Math.abs(row.daysRemaining)}d ago`
                            : row.daysRemaining === 0
                              ? 'Expires Today'
                              : `${row.daysRemaining} days left`;

                        return (
                          <tr key={row.policyId} className="hover:bg-slate-50/70">
                            <td className="whitespace-nowrap px-4 py-3 font-mono-code font-bold text-slate-900">
                              {row.endDate}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${badgeClass}`}
                              >
                                {badgeLabel}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-bold text-slate-900">{row.customerName}</div>
                              <div className="font-mono-code text-[11px] text-slate-600">
                                {row.customerPhone}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-mono-code font-bold text-slate-900">
                                {row.plate}
                              </div>
                              <div className="text-[11px] text-slate-500">{row.vehicleLabel}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-slate-900">{row.insurerName}</div>
                              <div className="text-[11px] text-slate-500">
                                {row.coverType} · {row.coverNoteNo}
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-mono-code font-bold text-slate-900">
                              {formatTzs(row.expiringPremiumTzs)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => copyRenewalMessage(row)}
                                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100"
                              >
                                {copiedId === row.policyId ? (
                                  <>
                                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                    Copied WhatsApp Msg
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                                    Copy WhatsApp Reminder
                                  </>
                                )}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Footer timestamp */}
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              Report generated {new Date(report.generatedAt).toLocaleString()}
            </span>
            <span>All figures in Tanzanian Shillings (TZS)</span>
          </div>
        </>
      ) : null}
    </div>
  );
}

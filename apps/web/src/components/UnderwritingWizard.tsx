import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Camera,
  Car,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  FileCheck2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Sparkles,
  UserCheck,
  Zap,
} from 'lucide-react';
import type {
  ClaimsFreeStatus,
  CoverDuration,
  CoverType,
  InsurerProfile,
  RatingCalculationResult,
  TonnageBand,
  VehicleClass,
} from '@coverflow/domain';
import {
  api,
  formatTzs,
  type CatalogResponse,
  type ClientRecord,
  type HydratedQuote,
  type PlateLookupResponse,
} from '../api/client';
import { StickerCard } from './StickerCard';
import { PaymentPanel } from './PaymentPanel';

interface UnderwritingWizardProps {
  mode: 'BROKER' | 'CLIENT_APP';
  catalog: CatalogResponse;
  resumeQuoteId?: string | null;
  onQuoteCleared?: () => void;
  onVerifyInEcosystem: (plate: string) => void;
  onContextChange?: (ctx: { screen: string; plate?: string | null; quoteNumber?: string | null }) => void;
}

const STEPS = [
  { num: 1, title: 'Plate Lookup', subtitle: 'TRA & TIRA check' },
  { num: 2, title: 'Cover & Quote', subtitle: 'Instant pricing' },
  { num: 3, title: 'KYC & Payment', subtitle: 'Control No. & Pay' },
  { num: 4, title: 'TIRA Sticker', subtitle: 'Bind & Deliver' },
] as const;

// Tiny SVG placeholder image as base64 dataUrl for 1-click demo photo upload
function makeDemoPhotoDataUrl(plate: string, angle: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="240" viewBox="0 0 420 240"><rect width="420" height="240" fill="#0f172a"/><rect x="16" y="16" width="388" height="208" rx="14" fill="#1e293b" stroke="#38bdf8" stroke-width="2"/><text x="34" y="64" fill="#38bdf8" font-family="sans-serif" font-size="14" font-weight="bold">COVERFLOW BASELINE INSPECTION</text><text x="34" y="112" fill="#ffffff" font-family="monospace" font-size="28" font-weight="bold">${plate} · ${angle}</text><text x="34" y="152" fill="#94a3b8" font-family="sans-serif" font-size="13">Timestamp: ${new Date().toISOString()}</text><text x="34" y="182" fill="#34d399" font-family="sans-serif" font-size="12">Stored with consent for ClaimFlow FNOL baseline</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export function UnderwritingWizard({
  mode,
  catalog,
  resumeQuoteId,
  onQuoteCleared,
  onVerifyInEcosystem,
  onContextChange,
}: UnderwritingWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);

  // Elapsed timer to showcase < 3 minute underwriting speed
  const [startedAt] = useState<number>(() => Date.now());
  const [elapsedSec, setElapsedSec] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsedSec(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  // Step 1 state
  const [plateInput, setPlateInput] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookup, setLookup] = useState<PlateLookupResponse | null>(null);
  const [showCorrectionDrawer, setShowCorrectionDrawer] = useState(false);
  const [corrField, setCorrField] = useState<'vehicleClass' | 'actualUse' | 'seats'>('vehicleClass');
  const [corrProposed, setCorrProposed] = useState('');
  const [corrReason, setCorrReason] = useState('');
  const [corrEvidence, setCorrEvidence] = useState('');

  // Broker client search
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');

  // Step 2 state (Cover & Rating)
  const [vehicleClass, setVehicleClass] = useState<VehicleClass>('PRIVATE_CAR');
  const [actualUse, setActualUse] = useState('Private or Normal');
  const [coverType, setCoverType] = useState<CoverType>('COMPREHENSIVE');
  const [duration, setDuration] = useState<CoverDuration>('ANNUAL_12M');
  const [startDate, setStartDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [sumInsuredStr, setSumInsuredStr] = useState('48000000');
  const [seatCountStr, setSeatCountStr] = useState('');
  const [tonnageBand, setTonnageBand] = useState<TonnageBand>('ABOVE_2T_TO_5T');
  const [carriesPassengers2W3W, setCarriesPassengers2W3W] = useState(false);
  const [claimsFreeStatus, setClaimsFreeStatus] = useState<ClaimsFreeStatus>(
    'SELF_DECLARED_CLAIMS_FREE',
  );
  const [selectedInsurerCode, setSelectedInsurerCode] = useState<string>('MUA_TZ');

  // V1 #1-#2 Add-ons, First Loss Payee & Discounts
  const [showEnhancements, setShowEnhancements] = useState(false);
  const [addonPvt, setAddonPvt] = useState(false);
  const [addonExcessProtector, setAddonExcessProtector] = useState(false);
  const [addonExcessBuyBack, setAddonExcessBuyBack] = useState(false);
  const [addonLossOfUse, setAddonLossOfUse] = useState(false);
  const [addonGeoExt, setAddonGeoExt] = useState(false);
  const [windscreenStr, setWindscreenStr] = useState('');
  const [accessoriesStr, setAccessoriesStr] = useState('');
  const [isFinanced, setIsFinanced] = useState(false);
  const [firstLossPayee, setFirstLossPayee] = useState('');

  // Discounts
  const [discTrackerReq, setDiscTrackerReq] = useState(false);
  const [discTrackerRef, setDiscTrackerRef] = useState('');
  const [discTatoaReq, setDiscTatoaReq] = useState(false);
  const [discTatoaRef, setDiscTatoaRef] = useState('');
  const [discFleetReq, setDiscFleetReq] = useState(false);
  const [discFleetSize, setDiscFleetSize] = useState('60');
  const [discFleetRef, setDiscFleetRef] = useState('');

  // Live Rating comparisons
  const [comparisons, setComparisons] = useState<
    Array<{ insurer: InsurerProfile; calculation: RatingCalculationResult }>
  >([]);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [showBrokerDrawer, setShowBrokerDrawer] = useState(false);

  // Active persisted Quote (Steps 3 & 4)
  const [quote, setQuote] = useState<HydratedQuote | null>(null);
  const [addingVehicleMode, setAddingVehicleMode] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Step 3 KYC & Declaration
  const [kycIdType, setKycIdType] = useState<'NIDA' | 'TIN' | 'PASSPORT'>('NIDA');
  const [kycIdNumber, setKycIdNumber] = useState('');
  const [kycFullName, setKycFullName] = useState('');
  const [kycPhone, setKycPhone] = useState('');
  const [kycEmail, setKycEmail] = useState('');
  const [kycRegion, setKycRegion] = useState('Dar Es Salaam');
  const [kycDistrict, setKycDistrict] = useState('');
  const [ownerRelationship, setOwnerRelationship] = useState('REGISTERED_OWNER');
  const [ownerConfirmed, setOwnerConfirmed] = useState(true);
  const [proposalAccepted, setProposalAccepted] = useState(false);
  const [proposalSigner, setProposalSigner] = useState('');

  // Focus step heading on step change (Modern Web Guidance §11)
  useEffect(() => {
    stepHeadingRef.current?.focus();
  }, [step]);

  // Report current step/plate/quote context to Remarks Drawer
  useEffect(() => {
    const stepMeta = STEPS.find((s) => s.num === step);
    onContextChange?.({
      screen: `New Cover · Step ${step}: ${stepMeta?.title ?? ''}`,
      plate: lookup?.tra.vehicle?.normalizedPlate ?? quote?.items[0]?.vehicle.normalizedPlate ?? null,
      quoteNumber: quote?.quoteNumber ?? null,
    });
  }, [step, lookup, quote, onContextChange]);

  // Load broker clients
  useEffect(() => {
    if (mode === 'BROKER') {
      api.listClients().then((r) => setClients(r.clients)).catch(() => {});
    }
  }, [mode]);

  // Resume existing quote if selected from Quotations list
  useEffect(() => {
    if (!resumeQuoteId) return;
    const scope = mode === 'CLIENT_APP' ? 'client' : 'broker';
    api
      .getQuote(resumeQuoteId, scope)
      .then((q) => {
        setQuote(q);
        hydrateKycFromQuote(q);
        if (q.policies.length > 0 || q.status === 'ISSUED' || q.status === 'DELIVERED') {
          setStep(4);
        } else {
          setStep(3);
        }
      })
      .catch(() => {});
  }, [resumeQuoteId, mode]);

  // Prevent cross-mode quote leakage when toggling Broker <-> Client App
  useEffect(() => {
    if (quote && quote.channel !== mode) {
      setQuote(null);
      setStep(1);
    }
  }, [mode, quote]);

  function hydrateKycFromQuote(q: HydratedQuote) {
    if (q.customer) {
      setKycFullName(q.customer.fullName || '');
      setKycPhone(q.customer.phone || '');
      setKycEmail(q.customer.email || '');
      setKycIdType((q.customer.idType as 'NIDA' | 'TIN' | 'PASSPORT') || 'NIDA');
      setKycIdNumber(q.customer.idNumber || '');
      setKycRegion(q.customer.region || 'Dar Es Salaam');
      setKycDistrict(q.customer.district || '');
      setProposalSigner(q.proposalSignedBy || q.customer.fullName || '');
    }
    setOwnerRelationship(q.ownerRelationship || 'REGISTERED_OWNER');
    setOwnerConfirmed(q.ownerRelationshipConfirmed || true);
    setProposalAccepted(q.proposalAccepted);
    if (q.firstLossPayee) {
      setIsFinanced(true);
      setFirstLossPayee(q.firstLossPayee);
    }
  }

  const classMeta = useMemo(
    () => catalog.vehicleClasses.find((c) => c.code === vehicleClass) ?? catalog.vehicleClasses[0],
    [catalog, vehicleClass],
  );

  const selectedComparison = useMemo(
    () =>
      comparisons.find((c) => c.insurer.code === selectedInsurerCode) ?? comparisons[0] ?? null,
    [comparisons, selectedInsurerCode],
  );

  // Run Plate Lookup
  const handleLookupPlate = async (targetPlate?: string) => {
    const raw = (targetPlate ?? plateInput).trim();
    if (!raw) return;
    setPlateInput(raw.toUpperCase());
    setLookupLoading(true);
    setLookupError(null);
    setActionError(null);
    setShowCorrectionDrawer(false);
    setCorrProposed('');
    setCorrReason('');
    setCorrEvidence('');

    try {
      const res = await api.lookupPlate(raw, mode === 'CLIENT_APP' ? 'client' : 'broker');
      setLookup(res);

      if (res.tra.ok && res.tra.vehicle) {
        const v = res.tra.vehicle;
        setVehicleClass(v.suggestedClass);
        setActualUse(v.registeredUsage);
        const meta = catalog.vehicleClasses.find((c) => c.code === v.suggestedClass);
        if (meta && !meta.supportedCovers.includes(coverType)) {
          setCoverType(meta.supportedCovers[0]);
        }
        setStartDate(res.recommendedStartDate);
        if (res.valuation) {
          setSumInsuredStr(String(res.valuation.recommendedTzs));
        }
        if (meta?.requiresSeats) {
          setSeatCountStr(String(v.seats || ''));
        } else {
          setSeatCountStr('');
        }
        if (v.suggestedClass === 'MOTORCYCLE_2W') {
          setCarriesPassengers2W3W(true);
        } else {
          setCarriesPassengers2W3W(false);
        }
        if (res.verifiedClaimsHistory.hasVerifiedClaims) {
          setClaimsFreeStatus('VERIFIED_WITH_CLAIM');
        } else {
          setClaimsFreeStatus('SELF_DECLARED_CLAIMS_FREE');
        }

        // Pre-fill KYC gently from matched customer or TRA registered owner
        if (res.matchedCustomer) {
          setSelectedClientId(res.matchedCustomer.id);
          setKycFullName(res.matchedCustomer.fullName);
          setKycPhone(res.matchedCustomer.phone);
          setKycEmail(res.matchedCustomer.email ?? '');
          setKycIdType((res.matchedCustomer.idType as 'NIDA' | 'TIN' | 'PASSPORT') ?? 'NIDA');
          setKycIdNumber(res.matchedCustomer.idNumber ?? '');
          setKycRegion(res.matchedCustomer.region ?? 'Dar Es Salaam');
          setKycDistrict(res.matchedCustomer.district ?? '');
          setProposalSigner(res.matchedCustomer.fullName);
        } else if (!addingVehicleMode) {
          setSelectedClientId('');
          setKycFullName(v.registeredOwnerName);
          setProposalSigner(v.registeredOwnerName);
        }
      } else {
        setLookupError(res.tra.errorMessage ?? 'Unable to fetch vehicle record.');
      }
    } catch (e) {
      setLookupError((e as Error).message);
    } finally {
      setLookupLoading(false);
    }
  };

  // Live Rating Preview whenever Step 2 parameters change
  useEffect(() => {
    if (step !== 2 || !lookup?.tra.vehicle) return;
    const timer = setTimeout(async () => {
      setRatingLoading(true);
      try {
        const hasPendingCorrection =
          showCorrectionDrawer && Boolean(corrProposed.trim()) && Boolean(corrReason.trim());
        const res = await api.previewRating({
          compareAllInsurers: true,
          vehicleClass,
          coverType,
          duration,
          sumInsuredTzs: Number(sumInsuredStr.replace(/[^0-9]/g, '')) || 0,
          seatCount: seatCountStr ? Number(seatCountStr) : undefined,
          tonnageBand: classMeta.requiresTonnageForTpo ? tonnageBand : undefined,
          carriesPassengers2W3W,
          manufactureYear: lookup.tra.vehicle?.manufactureYear,
          claimsFreeStatus,
          hasUnacceptedCorrection: hasPendingCorrection,
          addOns: {
            pvt: addonPvt,
            excessProtector: addonExcessProtector,
            excessBuyBack: addonExcessBuyBack,
            lossOfUse: addonLossOfUse,
            geographicalExtension: addonGeoExt,
            windscreenSumInsured: Number(windscreenStr.replace(/[^0-9]/g, '')) || 0,
            accessoriesSumInsured: Number(accessoriesStr.replace(/[^0-9]/g, '')) || 0,
          },
          discounts: {
            trackingDevice: {
              requested: discTrackerReq,
              evidenceRef: discTrackerRef.trim() || undefined,
            },
            tatoaTaboaMember: {
              requested: discTatoaReq,
              membershipApprovalRef: discTatoaRef.trim() || undefined,
            },
            fleetDiscount: {
              requested: discFleetReq,
              fleetSize: Number(discFleetSize) || 0,
              comprehensiveRatioPct: 60,
              claimsRatioPct: 30,
              committeeApprovalRef: discFleetRef.trim() || undefined,
            },
          },
        });
        setComparisons(res.comparisons ?? []);
      } catch {
        // Ignore transient input errors while typing
      } finally {
        setRatingLoading(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [
    step,
    lookup,
    vehicleClass,
    coverType,
    duration,
    sumInsuredStr,
    seatCountStr,
    tonnageBand,
    carriesPassengers2W3W,
    claimsFreeStatus,
    addonPvt,
    addonExcessProtector,
    addonExcessBuyBack,
    addonLossOfUse,
    addonGeoExt,
    windscreenStr,
    accessoriesStr,
    discTrackerReq,
    discTrackerRef,
    discTatoaReq,
    discTatoaRef,
    discFleetReq,
    discFleetSize,
    discFleetRef,
    showCorrectionDrawer,
    corrProposed,
    corrReason,
    classMeta.requiresTonnageForTpo,
  ]);

  // Save Quote (or add vehicle to existing quote)
  const handleSaveQuote = async () => {
    if (!lookup?.tra.vehicle || !selectedComparison?.calculation.priceable) return;
    setActionBusy(true);
    setActionError(null);

    const hasCorrection =
      showCorrectionDrawer && Boolean(corrProposed.trim()) && Boolean(corrReason.trim());

    const itemPayload = {
      normalizedPlate: lookup.tra.vehicle.normalizedPlate,
      vehicleClass,
      actualUse,
      coverType,
      duration,
      startDate,
      sumInsuredTzs: Number(sumInsuredStr.replace(/[^0-9]/g, '')) || 0,
      seatCount: seatCountStr ? Number(seatCountStr) : undefined,
      tonnageBand: classMeta.requiresTonnageForTpo ? tonnageBand : undefined,
      carriesPassengers2W3W,
      claimsFreeStatus,
      addOns: {
        pvt: addonPvt,
        excessProtector: addonExcessProtector,
        excessBuyBack: addonExcessBuyBack,
        lossOfUse: addonLossOfUse,
        geographicalExtension: addonGeoExt,
        windscreenSumInsured: Number(windscreenStr.replace(/[^0-9]/g, '')) || 0,
        accessoriesSumInsured: Number(accessoriesStr.replace(/[^0-9]/g, '')) || 0,
      },
      discounts: {
        trackingDevice: {
          requested: discTrackerReq,
          evidenceRef: discTrackerRef.trim() || undefined,
        },
        tatoaTaboaMember: {
          requested: discTatoaReq,
          membershipApprovalRef: discTatoaRef.trim() || undefined,
        },
        fleetDiscount: {
          requested: discFleetReq,
          fleetSize: Number(discFleetSize) || 0,
          comprehensiveRatioPct: 60,
          claimsRatioPct: 30,
          committeeApprovalRef: discFleetRef.trim() || undefined,
        },
      },
      correction: hasCorrection
        ? {
            field: corrField,
            fetchedValue:
              corrField === 'seats'
                ? String(lookup.tra.vehicle.seats)
                : corrField === 'actualUse'
                  ? lookup.tra.vehicle.registeredUsage
                  : lookup.tra.vehicle.suggestedClass,
            proposedValue: corrProposed.trim(),
            reason: corrReason.trim(),
            evidenceFileName: corrEvidence.trim() || 'TRA_Registration_Card.pdf',
          }
        : undefined,
    };

    try {
      let saved: HydratedQuote;
      if (addingVehicleMode && quote) {
        saved = await api.addQuoteItem(quote.id, itemPayload);
        setAddingVehicleMode(false);
        setStatusNotice(`Added ${lookup.tra.vehicle.normalizedPlate} to Quote ${saved.quoteNumber} (v${saved.activeVersion}).`);
      } else {
        saved = await api.createQuote({
          channel: mode,
          insurerCode: selectedInsurerCode,
          customerId: selectedClientId || undefined,
          quickContact:
            !selectedClientId && (kycFullName || kycPhone)
              ? { fullName: kycFullName, phone: kycPhone, email: kycEmail }
              : undefined,
          firstLossPayee: isFinanced ? firstLossPayee : undefined,
          item: itemPayload,
        });
        setStatusNotice(`Quote ${saved.quoteNumber} saved (v${saved.activeVersion}) — no photos or payment required yet.`);
      }
      setQuote(saved);
      hydrateKycFromQuote(saved);
      setStep(3);
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setActionBusy(false);
    }
  };

  // Auto-verify NIDA / TIN
  const handleVerifyKyc = async () => {
    if (!kycIdNumber.trim()) return;
    setActionBusy(true);
    setActionError(null);
    try {
      const res = await api.verifyKyc(kycIdType, kycIdNumber);
      if (res.found) {
        if (res.fullName) setKycFullName(res.fullName);
        if (res.phone) setKycPhone(res.phone);
        if (res.region) setKycRegion(res.region);
        if (res.district) setKycDistrict(res.district);
        if (res.fullName) setProposalSigner(res.fullName);
        setStatusNotice(`Verified via ${res.source}: details auto-filled.`);
      } else {
        setStatusNotice('No mock NIDA/TIN match — continue entering customer details manually.');
      }
    } finally {
      setActionBusy(false);
    }
  };

  // Save KYC & Proposal
  const handleSaveKyc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quote) return;
    setActionBusy(true);
    setActionError(null);
    try {
      const updated = await api.saveKycDeclaration(quote.id, {
        customerId: quote.customerId ?? (selectedClientId || undefined),
        fullName: kycFullName,
        idType: kycIdType,
        idNumber: kycIdNumber,
        phone: kycPhone,
        email: kycEmail || null,
        region: kycRegion || null,
        district: kycDistrict || null,
        ownerRelationship,
        ownerRelationshipConfirmed: ownerConfirmed,
        firstLossPayee: isFinanced ? firstLossPayee : null,
        proposalAccepted,
        proposalSignedBy: proposalSigner || kycFullName,
      });
      setQuote(updated);
      setStatusNotice('KYC & digital AML/CFT proposal saved.');
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setActionBusy(false);
    }
  };

  // Attach baseline photo
  const handleAttachDemoPhoto = async (plate: string, angle: string) => {
    if (!quote) return;
    setActionBusy(true);
    try {
      const updated = await api.uploadPhoto(quote.id, {
        plate,
        angle,
        dataUrl: makeDemoPhotoDataUrl(plate, angle),
        consentGiven: true,
      });
      setQuote(updated);
      setStatusNotice(`Saved timestamped ${angle} baseline photo for ClaimFlow.`);
    } finally {
      setActionBusy(false);
    }
  };

  // Submit to TIRA MIS & Issue Cover Note
  const handleBindTira = async () => {
    if (!quote) return;
    setActionBusy(true);
    setActionError(null);
    try {
      const res = await api.bindQuote(quote.id);
      setQuote(res.quote);
      setStep(4);
      setStatusNotice('TIRA001 Success! Cover Note & Digital Sticker issued.');
    } catch (err) {
      const typed = err as Error & { data?: { quote?: HydratedQuote; actionableNextStep?: string } };
      if (typed.data?.quote) setQuote(typed.data.quote);
      setActionError(
        `${typed.message}${typed.data?.actionableNextStep ? ` — Next step: ${typed.data.actionableNextStep}` : ''}`,
      );
      setStep(4);
    } finally {
      setActionBusy(false);
    }
  };

  const handleResetWizard = () => {
    setQuote(null);
    setLookup(null);
    setPlateInput('');
    setComparisons([]);
    setAddingVehicleMode(false);
    setActionError(null);
    setStatusNotice(null);
    setStep(1);
    onQuoteCleared?.();
  };

  const mins = Math.floor(elapsedSec / 60);
  const secs = String(elapsedSec % 60).padStart(2, '0');

  return (
    <div className="space-y-6">
      {/* Progress Bar + Speed Meter */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Underwriting progress" className="flex-1">
            <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {STEPS.map((s) => {
                const isDone = step > s.num;
                const isCurrent = step === s.num;
                const clickable =
                  (s.num === 1 && !quote) ||
                  (s.num === 2 && Boolean(lookup?.tra.vehicle)) ||
                  (s.num === 3 && Boolean(quote)) ||
                  (s.num === 4 && Boolean(quote && (quote.policies.length > 0 || quote.tiraLogs.length > 0)));
                return (
                  <li
                    key={s.num}
                    aria-current={isCurrent ? 'step' : undefined}
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-2 transition ${
                      isCurrent
                        ? 'bg-sky-50 text-sky-900 ring-1 ring-sky-200'
                        : isDone
                          ? 'bg-emerald-50/60 text-emerald-900'
                          : 'text-slate-400'
                    }`}
                  >
                    <button
                      type="button"
                      disabled={!clickable}
                      onClick={() => clickable && setStep(s.num)}
                      className="flex w-full items-center gap-2.5 text-left disabled:cursor-default"
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          isCurrent
                            ? 'bg-sky-600 text-white'
                            : isDone
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {isDone ? <Check className="h-4 w-4" aria-hidden="true" /> : s.num}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-bold">{s.title}</span>
                        <span className="block truncate text-[11px] opacity-75">{s.subtitle}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 font-mono-code">
              <Zap className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
              {mins}:{secs}
            </span>
            {quote && (
              <button
                type="button"
                onClick={handleResetWizard}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Start Fresh
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Live Status Announcements */}
      {statusNotice && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            {statusNotice}
          </span>
          <button
            type="button"
            onClick={() => setStatusNotice(null)}
            className="text-xs font-semibold text-emerald-700 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
          <div>
            <div className="font-semibold">Action Blocked</div>
            <p className="text-xs text-rose-800">{actionError}</p>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* STEP 1: PLATE-FIRST LOOKUP                                          */}
      {/* =================================================================== */}
      {step === 1 && (
        <section className="mx-auto max-w-3xl space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2
                  ref={stepHeadingRef}
                  tabIndex={-1}
                  className="text-2xl font-extrabold tracking-tight text-slate-900 outline-none"
                >
                  {addingVehicleMode
                    ? `Add Another Vehicle to ${quote?.quoteNumber}`
                    : mode === 'CLIENT_APP'
                      ? 'Insure your vehicle in under 3 minutes'
                      : 'Start with Registration Number'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  We fetch vehicle specs from TRA, verify active TIRA MIS cover, and estimate market value automatically. Zero client forms upfront.
                </p>
              </div>
              {addingVehicleMode && (
                <button
                  type="button"
                  onClick={() => {
                    setAddingVehicleMode(false);
                    setStep(3);
                  }}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleLookupPlate();
              }}
              className="mt-6 space-y-3"
            >
              <div>
                <label htmlFor="plate-input" className="block text-sm font-semibold text-slate-800">
                  Vehicle Registration Number <span aria-hidden="true" className="text-rose-600">*</span>
                </label>
                <span id="plate-hint" className="mb-1.5 block text-xs text-slate-500">
                  Format: Tanzanian plate such as T101ABC, T999ECS, or MC204BDA
                </span>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    id="plate-input"
                    name="plate"
                    type="text"
                    required
                    value={plateInput}
                    onChange={(e) => setPlateInput(e.target.value.toUpperCase())}
                    aria-describedby="plate-hint"
                    autoCorrect="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    enterKeyHint="search"
                    placeholder="T101ABC"
                    className="flex-1 rounded-xl border-2 border-slate-300 bg-amber-50/40 px-4 py-3 text-xl font-extrabold uppercase tracking-[0.14em] text-slate-900 font-mono-code placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400"
                  />
                  <button
                    type="submit"
                    disabled={lookupLoading}
                    className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-sky-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-60"
                  >
                    {lookupLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Search className="h-4 w-4" aria-hidden="true" />
                    )}
                    {lookupLoading ? 'Fetching TRA & TIRA...' : 'Fetch Vehicle'}
                  </button>
                </div>
              </div>
            </form>

            {/* Quick Mock Scenario Chips */}
            <div className="mt-5 border-t border-slate-100 pt-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Sandbox Quick-Test Plates (Click to Test Any V1 Scenario)
              </div>
              <div className="flex flex-wrap gap-2">
                {catalog.samplePlates.map((sp) => (
                  <button
                    key={sp.plate}
                    type="button"
                    onClick={() => handleLookupPlate(sp.plate)}
                    title={sp.description}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-900"
                  >
                    <span className="font-mono-code font-bold text-slate-900">{sp.plate}</span>
                    <span className="hidden sm:inline text-slate-500">
                      · {sp.label.split('—')[1]?.trim() ?? sp.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {lookupError && (
              <div
                role="alert"
                className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{lookupError}</span>
              </div>
            )}
          </div>

          {/* Fetched Vehicle Result Card */}
          {lookup?.tra.ok && lookup.tra.vehicle && (
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                    <Car className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-extrabold text-slate-900">
                        {lookup.tra.vehicle.manufactureYear} {lookup.tra.vehicle.make}{' '}
                        {lookup.tra.vehicle.model}
                      </h3>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold font-mono-code text-slate-800">
                        {lookup.tra.vehicle.normalizedPlate}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {lookup.tra.vehicle.bodyType} · {lookup.tra.vehicle.color} ·{' '}
                      {lookup.tra.vehicle.cc} cc · {lookup.tra.vehicle.seats} seats ·{' '}
                      {lookup.tra.vehicle.fuelType}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    TRA Verified
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                      lookup.activeCover.status === 'ACTIVE_COVER_FOUND'
                        ? 'bg-amber-50 text-amber-800 ring-amber-200'
                        : 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                    }`}
                  >
                    {lookup.activeCover.status === 'ACTIVE_COVER_FOUND'
                      ? `TIRA 2205 · Active til ${lookup.activeCover.expiryDate}`
                      : 'TIRA Clear · No Active Cover'}
                  </span>
                </div>
              </div>

              {/* Active Cover Callout (Smart Fix vs Smart Policy passive error!) */}
              {lookup.activeCover.status === 'ACTIVE_COVER_FOUND' && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                  <div className="flex items-start gap-2.5">
                    <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
                    <div>
                      <div className="font-bold">
                        Active TIRA Cover Detected (Code {lookup.activeCover.tiraCode})
                      </div>
                      <p className="mt-0.5 text-xs text-amber-900">
                        Current cover with <strong>{lookup.activeCover.existingInsurer}</strong> expires on{' '}
                        <strong>{lookup.activeCover.expiryDate}</strong>. CoverFlow automatically set your proposed renewal start date to{' '}
                        <strong className="underline">{lookup.activeCover.suggestedStartDate}</strong>{' '}
                        so you can quote now without TIRA overlap rejection.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Verified ClaimFlow History Callout */}
              {lookup.verifiedClaimsHistory.hasVerifiedClaims && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-900">
                  <strong>ClaimFlow Verified History:</strong> {lookup.verifiedClaimsHistory.claims.length} prior claim(s) recorded for this plate. Claims-free status has been automatically set to <strong>Verified With Claim</strong>.
                </div>
              )}

              {/* Compact Provenance Grid */}
              <dl className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3.5 text-xs sm:grid-cols-4">
                <div>
                  <dt className="text-slate-500">TRA Registered Owner</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">
                    {lookup.tra.vehicle.registeredOwnerName}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Registered Usage</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">
                    {lookup.tra.vehicle.registeredUsage}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Chassis No.</dt>
                  <dd className="mt-0.5 font-mono-code font-semibold text-slate-900">
                    {lookup.tra.vehicle.chassisNo}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Engine No.</dt>
                  <dd className="mt-0.5 font-mono-code font-semibold text-slate-900">
                    {lookup.tra.vehicle.engineNo}
                  </dd>
                </div>
              </dl>

              {/* Broker Optional Client Picker */}
              {mode === 'BROKER' && !addingVehicleMode && clients.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                  <label
                    htmlFor="broker-client-select"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Optional: Link Existing Broker Client (Saves KYC Typing Later)
                  </label>
                  <select
                    id="broker-client-select"
                    value={selectedClientId}
                    onChange={(e) => {
                      const cid = e.target.value;
                      setSelectedClientId(cid);
                      const cl = clients.find((c) => c.id === cid);
                      if (cl) {
                        setKycFullName(cl.fullName);
                        setKycPhone(cl.phone);
                        setKycEmail(cl.email ?? '');
                        setKycIdType((cl.idType as 'NIDA' | 'TIN' | 'PASSPORT') ?? 'NIDA');
                        setKycIdNumber(cl.idNumber ?? '');
                        setProposalSigner(cl.fullName);
                      }
                    }}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    <option value="">Create / capture at issuance stage</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName} ({c.phone})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Controlled Vehicle Fact Correction Drawer (Scenario 4) */}
              <div className="rounded-xl border border-slate-200 p-3.5">
                <button
                  type="button"
                  aria-expanded={showCorrectionDrawer}
                  onClick={() => setShowCorrectionDrawer((v) => !v)}
                  className="flex w-full items-center justify-between text-left text-xs font-semibold text-slate-700"
                >
                  <span>
                    Actual vehicle use or seat count differs from TRA? (Open Controlled Correction)
                  </span>
                  {showCorrectionDrawer ? (
                    <ChevronUp className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>

                {showCorrectionDrawer && (
                  <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                    <p className="text-xs text-slate-500">
                      Original TRA values are preserved for audit. Corrections require insurer/TIRA acceptance before final binding.
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <label htmlFor="corr-field" className="block text-xs font-semibold text-slate-700">
                          Field to Correct
                        </label>
                        <select
                          id="corr-field"
                          value={corrField}
                          onChange={(e) =>
                            setCorrField(e.target.value as 'vehicleClass' | 'actualUse' | 'seats')
                          }
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs"
                        >
                          <option value="vehicleClass">Vehicle Class / Use</option>
                          <option value="actualUse">Actual Usage Description</option>
                          <option value="seats">Registered Seating Capacity</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="corr-proposed" className="block text-xs font-semibold text-slate-700">
                          Proposed Value
                        </label>
                        <input
                          id="corr-proposed"
                          type="text"
                          value={corrProposed}
                          onChange={(e) => setCorrProposed(e.target.value)}
                          placeholder="e.g. Private Car / 30 seats"
                          className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs"
                        />
                      </div>
                      <div>
                        <label htmlFor="corr-evidence" className="block text-xs font-semibold text-slate-700">
                          Evidence Ref (Reg. Card)
                        </label>
                        <input
                          id="corr-evidence"
                          type="text"
                          value={corrEvidence}
                          onChange={(e) => setCorrEvidence(e.target.value)}
                          placeholder="Updated_TRA_Card.pdf"
                          className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs"
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="corr-reason" className="block text-xs font-semibold text-slate-700">
                        Reason for Correction
                      </label>
                      <input
                        id="corr-reason"
                        type="text"
                        value={corrReason}
                        onChange={(e) => setCorrReason(e.target.value)}
                        placeholder="e.g. Vehicle converted from company commercial pickup to personal private use"
                        className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-slate-800"
                >
                  Continue to Cover & Instant Quote
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* =================================================================== */}
      {/* STEP 2: COVER, ADD-ONS & INSTANT MULTI-INSURER QUOTE                */}
      {/* =================================================================== */}
      {step === 2 && lookup?.tra.vehicle && (
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left 7 columns: Smart Dynamic Form */}
          <div className="space-y-5 lg:col-span-7">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2
                    ref={stepHeadingRef}
                    tabIndex={-1}
                    className="text-xl font-extrabold text-slate-900 outline-none"
                  >
                    Configure Cover — {lookup.tra.vehicle.normalizedPlate}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {lookup.tra.vehicle.manufactureYear} {lookup.tra.vehicle.make}{' '}
                    {lookup.tra.vehicle.model} · Only inputs required for this vehicle class are shown.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  Change Plate
                </button>
              </div>

              <div className="mt-5 space-y-5">
                {/* Vehicle Class */}
                <div>
                  <label htmlFor="veh-class" className="block text-sm font-semibold text-slate-800">
                    Actual Vehicle Use & Rating Class
                  </label>
                  <span className="mb-1.5 block text-xs text-slate-500">
                    Suggested from TRA: <strong>{lookup.tra.vehicle.registeredUsage}</strong>
                  </span>
                  <select
                    id="veh-class"
                    value={vehicleClass}
                    onChange={(e) => {
                      const next = e.target.value as VehicleClass;
                      setVehicleClass(next);
                      const nextMeta = catalog.vehicleClasses.find((c) => c.code === next);
                      setActualUse(nextMeta?.label ?? next);
                      if (nextMeta && !nextMeta.supportedCovers.includes(coverType)) {
                        setCoverType(nextMeta.supportedCovers[0]);
                      }
                      if (nextMeta?.requiresSeats && !seatCountStr) {
                        setSeatCountStr(String(lookup.tra.vehicle?.seats || ''));
                      }
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900"
                  >
                    {catalog.vehicleClasses.map((vc) => (
                      <option key={vc.code} value={vc.code}>
                        {vc.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cover Type Radio Cards (Modern Web Guidance: 2-5 options = visible radios) */}
                <fieldset>
                  <legend className="mb-2 text-sm font-semibold text-slate-800">
                    Select Type of Cover
                  </legend>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    {(['COMPREHENSIVE', 'TPFT', 'TPO'] as CoverType[]).map((ct) => {
                      const supported = classMeta.supportedCovers.includes(ct);
                      const active = coverType === ct;
                      const labelMap: Record<CoverType, { name: string; desc: string }> = {
                        COMPREHENSIVE: {
                          name: 'Comprehensive',
                          desc: 'Full own-damage, theft, fire & third-party',
                        },
                        TPFT: {
                          name: 'Third Party F&T',
                          desc: 'Fire, theft & statutory third-party',
                        },
                        TPO: {
                          name: 'Third Party Only',
                          desc: 'Minimum statutory liability cover',
                        },
                      };
                      return (
                        <label
                          key={ct}
                          className={`flex cursor-pointer flex-col rounded-xl border p-3.5 transition ${
                            !supported
                              ? 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-50'
                              : active
                                ? 'border-sky-600 bg-sky-50/70 ring-1 ring-sky-600'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="coverType"
                              value={ct}
                              checked={active}
                              disabled={!supported}
                              onChange={() => setCoverType(ct)}
                              className="h-4 w-4"
                            />
                            <span className="text-sm font-bold text-slate-900">
                              {labelMap[ct].name}
                            </span>
                          </span>
                          <span className="mt-1 pl-6 text-xs text-slate-500">
                            {supported ? labelMap[ct].desc : 'Not available for this class'}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                {/* Dynamic Inputs: Sum Insured + Valuation Guidance */}
                {(coverType === 'COMPREHENSIVE' || coverType === 'TPFT') && (
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label htmlFor="sum-insured" className="text-sm font-semibold text-slate-800">
                        Vehicle Market Value / Sum Insured (TZS)
                      </label>
                      {lookup.valuation && (
                        <button
                          type="button"
                          onClick={() => setSumInsuredStr(String(lookup.valuation!.recommendedTzs))}
                          className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800 ring-1 ring-sky-200 hover:bg-sky-100"
                        >
                          <Sparkles className="h-3.5 w-3.5 text-sky-600" aria-hidden="true" />
                          Suggested: {formatTzs(lookup.valuation.minTzs)} –{' '}
                          {formatTzs(lookup.valuation.maxTzs)}
                        </button>
                      )}
                    </div>
                    <span className="mb-1.5 block text-xs text-slate-500">
                      Enter current replacement value in Tanzanian Shillings
                    </span>
                    <input
                      id="sum-insured"
                      type="text"
                      inputMode="numeric"
                      value={
                        sumInsuredStr
                          ? Number(sumInsuredStr.replace(/[^0-9]/g, '')).toLocaleString('en-US')
                          : ''
                      }
                      onChange={(e) => setSumInsuredStr(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-base font-bold text-slate-900 font-mono-code"
                    />
                  </div>
                )}

                {/* Dynamic Input: Seat Count for Passenger Carrying (Scenario 3) */}
                {classMeta.requiresSeats && (
                  <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4">
                    <label htmlFor="seat-count" className="block text-sm font-semibold text-sky-950">
                      Passenger Seating Capacity (Required for Per-Seat Rating)
                    </label>
                    <span className="mb-1.5 block text-xs text-sky-800">
                      TRA record shows {lookup.tra.vehicle.seats} seats. Changing seats immediately recalculates per-seat premium.
                    </span>
                    <input
                      id="seat-count"
                      type="text"
                      inputMode="numeric"
                      required
                      value={seatCountStr}
                      onChange={(e) => setSeatCountStr(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="e.g. 28"
                      className="w-full max-w-xs rounded-xl border border-sky-300 bg-white px-4 py-2.5 font-mono-code font-bold text-slate-900"
                    />
                  </div>
                )}

                {/* Dynamic Input: Tonnage Band for Commercial Goods TPO/TPFT */}
                {classMeta.requiresTonnageForTpo && (coverType === 'TPO' || coverType === 'TPFT') && (
                  <div>
                    <label htmlFor="tonnage-band" className="block text-sm font-semibold text-slate-800">
                      Gross Vehicle Weight / Tonnage Band
                    </label>
                    <select
                      id="tonnage-band"
                      value={tonnageBand}
                      onChange={(e) => setTonnageBand(e.target.value as TonnageBand)}
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm"
                    >
                      {catalog.tonnageBands.map((tb) => (
                        <option key={tb.code} value={tb.code}>
                          {tb.label} — {formatTzs(tb.amountTzs)} TPP
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Dynamic Toggle: Bodaboda / Bajaji Passenger Extension */}
                {classMeta.supportsPassengerFeeToggle && (
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                    <input
                      type="checkbox"
                      checked={carriesPassengers2W3W}
                      onChange={(e) => setCarriesPassengers2W3W(e.target.checked)}
                      className="h-4 w-4"
                    />
                    <span className="text-sm font-medium text-slate-800">
                      Carrying fare-paying passengers (Bodaboda +TZS 15,000 / Bajaji +TZS 45,000)
                    </span>
                  </label>
                )}

                {/* Duration & Start Date (V1 #3 Short Period) */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="cover-duration" className="block text-sm font-semibold text-slate-800">
                      Cover Period
                    </label>
                    <select
                      id="cover-duration"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value as CoverDuration)}
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm"
                    >
                      {catalog.durations.map((d) => (
                        <option key={d.code} value={d.code}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="start-date" className="block text-sm font-semibold text-slate-800">
                      Cover Start Date
                    </label>
                    <input
                      id="start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm"
                    />
                  </div>
                </div>

                {/* Claims-Free Declaration */}
                {coverType === 'COMPREHENSIVE' && (
                  <fieldset>
                    <legend className="mb-2 text-sm font-semibold text-slate-800">
                      Prior Claims History{' '}
                      <span className="ml-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        {claimsFreeStatus.startsWith('VERIFIED') ? 'ClaimFlow Verified' : 'Self-Declared'}
                      </span>
                    </legend>
                    <div className="grid grid-cols-2 gap-2.5">
                      <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 p-3 hover:border-slate-300">
                        <input
                          type="radio"
                          name="claimsFree"
                          checked={
                            claimsFreeStatus === 'SELF_DECLARED_CLAIMS_FREE' ||
                            claimsFreeStatus === 'VERIFIED_CLAIMS_FREE'
                          }
                          disabled={lookup.verifiedClaimsHistory.hasVerifiedClaims}
                          onChange={() => setClaimsFreeStatus('SELF_DECLARED_CLAIMS_FREE')}
                          className="h-4 w-4"
                        />
                        <span className="text-sm font-medium text-slate-800">Claims-Free</span>
                      </label>
                      <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 p-3 hover:border-slate-300">
                        <input
                          type="radio"
                          name="claimsFree"
                          checked={
                            claimsFreeStatus === 'SELF_DECLARED_WITH_CLAIM' ||
                            claimsFreeStatus === 'VERIFIED_WITH_CLAIM'
                          }
                          onChange={() =>
                            setClaimsFreeStatus(
                              lookup.verifiedClaimsHistory.hasVerifiedClaims
                                ? 'VERIFIED_WITH_CLAIM'
                                : 'SELF_DECLARED_WITH_CLAIM',
                            )
                          }
                          className="h-4 w-4"
                        />
                        <span className="text-sm font-medium text-slate-800">Prior Claim Record</span>
                      </label>
                    </div>
                  </fieldset>
                )}

                {/* Collapsible V1 #1-#2 Enhancements: Add-ons, First Loss Payee & Validated Discounts */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <button
                    type="button"
                    aria-expanded={showEnhancements}
                    onClick={() => setShowEnhancements((v) => !v)}
                    className="flex w-full items-center justify-between text-left text-sm font-bold text-slate-800"
                  >
                    <span className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-sky-600" aria-hidden="true" />
                      Enhance Cover, First Loss Payee & Discounts (Optional)
                    </span>
                    {showEnhancements ? (
                      <ChevronUp className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>

                  {showEnhancements && (
                    <div className="mt-4 space-y-5 border-t border-slate-200 pt-4">
                      {coverType === 'COMPREHENSIVE' && (
                        <div>
                          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                            Popular Tanzania Motor Add-ons
                          </div>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3">
                              <input
                                type="checkbox"
                                checked={addonPvt}
                                onChange={(e) => setAddonPvt(e.target.checked)}
                                className="mt-0.5 h-4 w-4"
                              />
                              <span className="text-xs">
                                <strong className="block text-slate-900">PVT Cover (0.25%)</strong>
                                <span className="text-slate-500">Political Violence & Terrorism</span>
                              </span>
                            </label>
                            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3">
                              <input
                                type="checkbox"
                                checked={addonExcessProtector}
                                onChange={(e) => setAddonExcessProtector(e.target.checked)}
                                className="mt-0.5 h-4 w-4"
                              />
                              <span className="text-xs">
                                <strong className="block text-slate-900">Excess Protector (0.25%)</strong>
                                <span className="text-slate-500">Waives standard own-damage excess</span>
                              </span>
                            </label>
                            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3">
                              <input
                                type="checkbox"
                                checked={addonExcessBuyBack}
                                onChange={(e) => setAddonExcessBuyBack(e.target.checked)}
                                className="mt-0.5 h-4 w-4"
                              />
                              <span className="text-xs">
                                <strong className="block text-slate-900">Excess Buy-Back (+10% OD)</strong>
                                <span className="text-slate-500">MRO standard excess waiver loading</span>
                              </span>
                            </label>
                            {vehicleClass === 'PRIVATE_CAR' && (
                              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3">
                                <input
                                  type="checkbox"
                                  checked={addonLossOfUse}
                                  onChange={(e) => setAddonLossOfUse(e.target.checked)}
                                  className="mt-0.5 h-4 w-4"
                                />
                                <span className="text-xs">
                                  <strong className="block text-slate-900">Loss of Use (+TZS 50,000)</strong>
                                  <span className="text-slate-500">Up to 21 days @ 50k/day (Private only)</span>
                                </span>
                              </label>
                            )}
                            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3">
                              <input
                                type="checkbox"
                                checked={addonGeoExt}
                                onChange={(e) => setAddonGeoExt(e.target.checked)}
                                className="mt-0.5 h-4 w-4"
                              />
                              <span className="text-xs">
                                <strong className="block text-slate-900">Geo Extension (+5% OD)</strong>
                                <span className="text-slate-500">Cover beyond East Africa</span>
                              </span>
                            </label>
                          </div>

                          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                              <label htmlFor="windscreen-si" className="block text-xs font-semibold text-slate-700">
                                Windscreen Sum Insured (TZS · 10%)
                              </label>
                              <input
                                id="windscreen-si"
                                type="text"
                                inputMode="numeric"
                                value={windscreenStr}
                                onChange={(e) => setWindscreenStr(e.target.value.replace(/[^0-9]/g, ''))}
                                placeholder="e.g. 1000000"
                                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono-code"
                              />
                            </div>
                            <div>
                              <label htmlFor="accessories-si" className="block text-xs font-semibold text-slate-700">
                                Accessories Sum Insured (TZS · 5%)
                              </label>
                              <input
                                id="accessories-si"
                                type="text"
                                inputMode="numeric"
                                value={accessoriesStr}
                                onChange={(e) => setAccessoriesStr(e.target.value.replace(/[^0-9]/g, ''))}
                                placeholder="e.g. 500000"
                                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono-code"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* First Loss Payee (Financed Vehicle) */}
                      <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                        <label className="flex cursor-pointer items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isFinanced}
                            onChange={(e) => setIsFinanced(e.target.checked)}
                            className="h-4 w-4"
                          />
                          <span className="text-xs font-semibold text-slate-800">
                            Vehicle is Bank / Loan Financed (Add First Loss Payee)
                          </span>
                        </label>
                        {isFinanced && (
                          <input
                            type="text"
                            value={firstLossPayee}
                            onChange={(e) => setFirstLossPayee(e.target.value)}
                            placeholder="e.g. CRDB Bank Plc — Asset Finance"
                            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                          />
                        )}
                      </div>

                      {/* Validated Discounts (Scenario 5) */}
                      <div className="space-y-2.5">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Eligible Discounts (Evidence Required — Undocumented Discounts Excluded)
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <label className="flex cursor-pointer items-center gap-2">
                            <input
                              type="checkbox"
                              checked={discTrackerReq}
                              onChange={(e) => setDiscTrackerReq(e.target.checked)}
                              className="h-4 w-4"
                            />
                            <span className="text-xs font-semibold text-slate-800">
                              Approved Car Tracking Device (-5%)
                            </span>
                          </label>
                          {discTrackerReq && (
                            <input
                              type="text"
                              value={discTrackerRef}
                              onChange={(e) => setDiscTrackerRef(e.target.value)}
                              placeholder="Enter Tracker Certificate Ref (leave blank to test exclusion)"
                              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                            />
                          )}
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <label className="flex cursor-pointer items-center gap-2">
                            <input
                              type="checkbox"
                              checked={discTatoaReq}
                              onChange={(e) => setDiscTatoaReq(e.target.checked)}
                              className="h-4 w-4"
                            />
                            <span className="text-xs font-semibold text-slate-800">
                              TATOA / TABOA Member Discount (-5%)
                            </span>
                          </label>
                          {discTatoaReq && (
                            <input
                              type="text"
                              value={discTatoaRef}
                              onChange={(e) => setDiscTatoaRef(e.target.value)}
                              placeholder="Membership Approval Letter Ref"
                              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                            />
                          )}
                        </div>

                        {mode === 'BROKER' && (
                          <div className="rounded-xl border border-slate-200 bg-white p-3">
                            <label className="flex cursor-pointer items-center gap-2">
                              <input
                                type="checkbox"
                                checked={discFleetReq}
                                onChange={(e) => setDiscFleetReq(e.target.checked)}
                                className="h-4 w-4"
                              />
                              <span className="text-xs font-semibold text-slate-800">
                                Fleet Discount (-20%, &gt;50 Vehicles + ATI Approval)
                              </span>
                            </label>
                            {discFleetReq && (
                              <div className="mt-2 grid grid-cols-2 gap-2">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={discFleetSize}
                                  onChange={(e) => setDiscFleetSize(e.target.value.replace(/[^0-9]/g, ''))}
                                  placeholder="Fleet size (>50)"
                                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
                                />
                                <input
                                  type="text"
                                  value={discFleetRef}
                                  onChange={(e) => setDiscFleetRef(e.target.value)}
                                  placeholder="ATI/Committee Ref"
                                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Multi-Insurer Comparison Cards */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">
                  {mode === 'CLIENT_APP' ? 'Choose Your Insurer' : 'Select Insurer & Compare'}
                </h3>
                {ratingLoading && (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    Calculating...
                  </span>
                )}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {comparisons.map(({ insurer, calculation }) => {
                  const isSelected = insurer.code === selectedInsurerCode;
                  return (
                    <button
                      key={insurer.code}
                      type="button"
                      onClick={() => setSelectedInsurerCode(insurer.code)}
                      className={`flex flex-col justify-between rounded-xl border p-4 text-left transition ${
                        isSelected
                          ? 'border-sky-600 bg-sky-50/70 ring-1 ring-sky-600'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            {insurer.shortName}
                          </span>
                          {calculation.referralRequired ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                              Referral Needed
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                              Instant Bind
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{insurer.tagline}</p>
                      </div>

                      <div className="mt-3 border-t border-slate-100 pt-2.5">
                        {calculation.priceable ? (
                          <div className="flex items-baseline justify-between">
                            <span className="text-base font-extrabold text-slate-900">
                              {formatTzs(calculation.totalPayableTzs)}
                            </span>
                            <span className="text-[11px] text-slate-500">incl. 18% VAT</span>
                          </div>
                        ) : (
                          <span className="text-xs font-semibold text-rose-600">
                            {calculation.blockingErrors[0]}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right 5 columns: Sticky Transparent Premium Breakdown */}
          <aside className="lg:col-span-5">
            <div className="sticky top-24 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-sky-700">
                    Live Quotation Breakdown
                  </span>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    {selectedComparison?.insurer.shortName ?? 'Calculating...'}
                  </h3>
                </div>
                <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold font-mono-code text-slate-600">
                  {catalog.ruleVersion}
                </span>
              </div>

              {selectedComparison && !selectedComparison.calculation.priceable && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-900">
                  <strong>Cannot price yet:</strong>
                  <ul className="mt-1 list-disc pl-4">
                    {selectedComparison.calculation.blockingErrors.map((err) => (
                      <li key={err}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedComparison?.calculation.priceable && (
                <>
                  <div className="divide-y divide-slate-100 text-sm">
                    {selectedComparison.calculation.lineItems.map((li) => (
                      <div key={li.code} className="flex items-start justify-between gap-3 py-2.5">
                        <div>
                          <div className="font-medium text-slate-800">{li.label}</div>
                          <div className="text-[11px] text-slate-500">{li.formula}</div>
                        </div>
                        <span
                          className={`shrink-0 font-mono-code font-semibold ${
                            li.amountTzs < 0 ? 'text-emerald-700' : 'text-slate-900'
                          }`}
                        >
                          {li.amountTzs < 0 ? '-' : ''}
                          {formatTzs(Math.abs(li.amountTzs))}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Discount Transparency (Scenario 5) */}
                  {selectedComparison.calculation.discountDecisions.length > 0 && (
                    <div className="space-y-1.5 rounded-xl bg-slate-50 p-3 text-xs">
                      {selectedComparison.calculation.discountDecisions.map((dd) => (
                        <div
                          key={dd.code}
                          className={dd.applied ? 'text-emerald-800' : 'text-amber-800'}
                        >
                          <strong>{dd.applied ? '✓ Applied:' : '✕ Not Applied:'}</strong> {dd.reason}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Referral Reasons */}
                  {selectedComparison.calculation.referralReasons.length > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                      <div className="font-bold">Underwriter Referral Flagged:</div>
                      <ul className="mt-1 list-disc pl-4">
                        {selectedComparison.calculation.referralReasons.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Total Payable */}
                  <div className="rounded-xl bg-slate-900 p-4 text-white">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                        Total Customer Payable
                      </span>
                      <span className="text-2xl font-extrabold font-mono-code">
                        {formatTzs(selectedComparison.calculation.totalPayableTzs)}
                      </span>
                    </div>
                    <div className="mt-2 border-t border-slate-700 pt-2 text-[11px] text-slate-300">
                      <strong>Excess:</strong>{' '}
                      {selectedComparison.calculation.excess.standardDescription}.{' '}
                      {selectedComparison.calculation.excess.theftDescription}
                    </div>
                  </div>

                  {/* Broker-Only Private Commission & Settlement Drawer */}
                  {mode === 'BROKER' && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5">
                      <button
                        type="button"
                        aria-expanded={showBrokerDrawer}
                        onClick={() => setShowBrokerDrawer((v) => !v)}
                        className="flex w-full items-center justify-between text-xs font-bold text-amber-900"
                      >
                        <span className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Broker Commission & Settlement (Hidden from Client)
                        </span>
                        {showBrokerDrawer ? (
                          <ChevronUp className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <ChevronDown className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>
                      {showBrokerDrawer && (
                        <dl className="mt-2.5 space-y-1 border-t border-amber-200/70 pt-2.5 text-xs text-amber-950">
                          <div className="flex justify-between">
                            <dt>
                              Broker Commission ({selectedComparison.calculation.commission.commissionRatePct}%):
                            </dt>
                            <dd className="font-mono-code font-bold">
                              {formatTzs(selectedComparison.calculation.commission.brokerCommissionTzs)}
                            </dd>
                          </div>
                          <div className="flex justify-between">
                            <dt>VAT on Commission (18%):</dt>
                            <dd className="font-mono-code font-semibold">
                              {formatTzs(selectedComparison.calculation.commission.vatOnCommissionTzs)}
                            </dd>
                          </div>
                          <div className="flex justify-between border-t border-amber-200 pt-1 font-bold">
                            <dt>Net Insurer Settlement:</dt>
                            <dd className="font-mono-code">
                              {formatTzs(selectedComparison.calculation.commission.insurerSettlementTzs)}
                            </dd>
                          </div>
                        </dl>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={handleSaveQuote}
                    className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-60"
                  >
                    {actionBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : null}
                    {addingVehicleMode
                      ? 'Add Vehicle to Quote & Continue'
                      : `Save Quote & Continue · ${formatTzs(selectedComparison.calculation.totalPayableTzs)}`}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <p className="text-center text-[11px] text-slate-500">
                    Saves quote immediately without requiring photos or payment yet.
                  </p>
                </>
              )}
            </div>
          </aside>
        </section>
      )}

      {/* =================================================================== */}
      {/* STEP 3: PROGRESSIVE KYC, PROPOSAL, PHOTOS & AUTHORITATIVE PAYMENT   */}
      {/* =================================================================== */}
      {step === 3 && quote && (
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-7">
            {/* Quote Header + Printable Docs + Multi-vehicle add */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2
                      ref={stepHeadingRef}
                      tabIndex={-1}
                      className="text-xl font-extrabold text-slate-900 outline-none"
                    >
                      Quote {quote.quoteNumber}
                    </h2>
                    <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-bold text-sky-900">
                      v{quote.activeVersion} · {quote.statusLabel}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {quote.insurer?.name} · {quote.items.length} vehicle(s) · Total{' '}
                    <strong>{formatTzs(quote.totalPayableTzs)}</strong>
                  </p>
                </div>

                {mode === 'BROKER' && quote.policies.length === 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setAddingVehicleMode(true);
                      setLookup(null);
                      setPlateInput('');
                      setStep(1);
                    }}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2 text-xs font-bold text-sky-800 hover:bg-sky-100"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add Another Vehicle
                  </button>
                )}
              </div>

              {/* Vehicles on Quote + Pending Corrections */}
              <div className="mt-4 space-y-2.5">
                {quote.items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-mono-code font-bold text-slate-900">
                          {item.vehicle.normalizedPlate}
                        </span>{' '}
                        · {item.vehicle.manufactureYear} {item.vehicle.make} {item.vehicle.model} ·{' '}
                        <strong>{item.coverType}</strong> ({item.startDate} → {item.endDate})
                      </div>
                      <span className="font-mono-code font-bold text-slate-900">
                        {formatTzs(item.totalPayableTzs)}
                      </span>
                    </div>

                    {item.corrections.map((corr) => (
                      <div
                        key={corr.id}
                        className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-amber-950"
                      >
                        <div>
                          <strong>Correction ({corr.field}):</strong> TRA{' '}
                          <code className="font-mono-code">{corr.fetchedValue}</code> → Proposed{' '}
                          <code className="font-mono-code font-bold">{corr.proposedValue}</code> ·{' '}
                          <em>{corr.status.replace(/_/g, ' ')}</em>
                        </div>
                        {corr.status === 'PENDING_INSURER_ACCEPTANCE' && (
                          <button
                            type="button"
                            disabled={actionBusy}
                            onClick={async () => {
                              setActionBusy(true);
                              try {
                                const upd = await api.decideCorrection(quote.id, corr.id, 'ACCEPTED');
                                setQuote(upd);
                                setStatusNotice('Simulated Insurer/TIRA acceptance of vehicle correction.');
                              } finally {
                                setActionBusy(false);
                              }
                            }}
                            className="rounded-lg bg-amber-700 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-amber-800"
                          >
                            [Sandbox] Simulate Insurer Accept
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Referral Clearance Simulator (if referred without correction) */}
              {quote.items.some((i) => i.referralRequired && !i.referralApproved) && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950">
                  <div>
                    <strong>Underwriter Referral Pending:</strong> High sum insured, vehicle age, or class requires insurer sign-off before binding.
                  </div>
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={async () => {
                      setActionBusy(true);
                      try {
                        const upd = await api.approveReferral(quote.id);
                        setQuote(upd);
                        setStatusNotice('Simulated Underwriter Referral Approval.');
                      } finally {
                        setActionBusy(false);
                      }
                    }}
                    className="rounded-lg bg-amber-700 px-3 py-1.5 font-bold text-white hover:bg-amber-800"
                  >
                    [Sandbox] Approve Referral
                  </button>
                </div>
              )}

              {/* Printable Quote Docs (V1 #4) */}
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <a
                  href={`/api/v1/documents/quotes/${quote.id}/quotation.pdf?scope=${mode === 'CLIENT_APP' ? 'client' : 'broker'}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  Quotation PDF
                </a>
                <a
                  href={`/api/v1/documents/quotes/${quote.id}/proforma.pdf?scope=${mode === 'CLIENT_APP' ? 'client' : 'broker'}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  Proforma Invoice
                </a>
                <a
                  href={`/api/v1/documents/quotes/${quote.id}/proposal.pdf?scope=${mode === 'CLIENT_APP' ? 'client' : 'broker'}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  Proposal Form
                </a>
                {mode === 'BROKER' && (
                  <a
                    href={`/api/v1/documents/quotes/${quote.id}/debit-note.pdf?scope=broker`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    Broker Debit Note
                  </a>
                )}
              </div>
            </div>

            {/* Progressive KYC & AML/CFT Digital Proposal Form */}
            <form
              onSubmit={handleSaveKyc}
              className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-sky-600" aria-hidden="true" />
                <h3 className="text-base font-bold text-slate-900">
                  Fast KYC & Digital AML/CFT Proposal
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor="kyc-id-type" className="block text-xs font-semibold text-slate-700">
                    ID Type
                  </label>
                  <select
                    id="kyc-id-type"
                    value={kycIdType}
                    onChange={(e) => setKycIdType(e.target.value as 'NIDA' | 'TIN' | 'PASSPORT')}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="NIDA">NIDA National ID</option>
                    <option value="TIN">TRA TIN</option>
                    <option value="PASSPORT">Passport</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="kyc-id-num" className="block text-xs font-semibold text-slate-700">
                    ID Number <span className="font-normal text-slate-400">(try 19900304141120000120)</span>
                  </label>
                  <div className="mt-1 flex gap-2">
                    <input
                      id="kyc-id-num"
                      type="text"
                      required
                      value={kycIdNumber}
                      onChange={(e) => setKycIdNumber(e.target.value)}
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="20-digit NIDA or TIN"
                      className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono-code"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyKyc}
                      className="rounded-xl border border-sky-200 bg-sky-50 px-3.5 text-xs font-bold text-sky-800 hover:bg-sky-100"
                    >
                      Auto-Verify
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="kyc-name" className="block text-xs font-semibold text-slate-700">
                    Full Insured Name
                  </label>
                  <input
                    id="kyc-name"
                    type="text"
                    required
                    autoComplete="name"
                    value={kycFullName}
                    onChange={(e) => setKycFullName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="kyc-phone" className="block text-xs font-semibold text-slate-700">
                    Mobile Phone (Sticker & Mobile Money)
                  </label>
                  <input
                    id="kyc-phone"
                    type="tel"
                    required
                    autoComplete="tel"
                    value={kycPhone}
                    onChange={(e) => setKycPhone(e.target.value)}
                    placeholder="+255712345678"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="kyc-email" className="block text-xs font-semibold text-slate-700">
                    Email (Optional)
                  </label>
                  <input
                    id="kyc-email"
                    type="email"
                    autoComplete="email"
                    value={kycEmail}
                    onChange={(e) => setKycEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="owner-rel" className="block text-xs font-semibold text-slate-700">
                    Relationship to TRA Registered Owner
                  </label>
                  <select
                    id="owner-rel"
                    value={ownerRelationship}
                    onChange={(e) => setOwnerRelationship(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="REGISTERED_OWNER">I am the TRA Registered Owner</option>
                    <option value="CORPORATE_REPRESENTATIVE">Authorized Corporate Representative</option>
                    <option value="FINANCED">Financed Vehicle / Lessee</option>
                    <option value="AUTHORIZED_DRIVER">Authorized Family / Driver (Insurable Interest)</option>
                  </select>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <label className="flex cursor-pointer items-start gap-2.5 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={proposalAccepted}
                    onChange={(e) => setProposalAccepted(e.target.checked)}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span>
                    <strong>TIRA & FIU AML/CFT Digital Proposal Declaration:</strong> I confirm the
                    vehicle usage, claims history, and identity details are true and complete, and
                    I authorize cover issuance upon confirmed payment.
                  </span>
                </label>
                {proposalAccepted && (
                  <div className="mt-2.5 pl-6">
                    <label htmlFor="signer-name" className="block text-[11px] font-semibold text-slate-600">
                      Digital Signature (Typed Full Name)
                    </label>
                    <input
                      id="signer-name"
                      type="text"
                      value={proposalSigner}
                      onChange={(e) => setProposalSigner(e.target.value)}
                      placeholder={kycFullName || 'Type full name to sign'}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm italic"
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={actionBusy}
                className="inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                <FileCheck2 className="h-4 w-4" aria-hidden="true" />
                Save KYC & Digital Proposal
              </button>
            </form>

            {/* Optional Pre-Cover Baseline Photos (ClaimFlow Handoff) */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                    <Camera className="h-5 w-5 text-sky-600" aria-hidden="true" />
                    Pre-Cover Baseline Photos (ClaimFlow Handoff)
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Optional for quote & standard MUA bind (required by Sanlam Allianz Comprehensive). Stored timestamped with consent for ClaimFlow FNOL.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                  {quote.preCoverPhotos.length} / 4 captured
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {(['FRONT', 'REAR', 'LEFT', 'RIGHT'] as const).map((angle) => {
                  const plate = quote.items[0]?.vehicle.normalizedPlate ?? '';
                  const existing = quote.preCoverPhotos.find(
                    (p) => p.angle === angle && p.plate === plate,
                  );
                  return (
                    <button
                      key={angle}
                      type="button"
                      disabled={actionBusy}
                      onClick={() => handleAttachDemoPhoto(plate, angle)}
                      className={`flex flex-col items-center justify-center rounded-xl border p-3 text-xs font-semibold transition ${
                        existing
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                          : 'border-dashed border-slate-300 bg-slate-50 text-slate-600 hover:border-sky-400 hover:bg-sky-50'
                      }`}
                    >
                      {existing ? (
                        <CheckCircle2 className="mb-1 h-5 w-5 text-emerald-600" aria-hidden="true" />
                      ) : (
                        <Camera className="mb-1 h-5 w-5 text-slate-400" aria-hidden="true" />
                      )}
                      {angle}
                      <span className="mt-0.5 text-[10px] font-normal">
                        {existing ? 'Captured' : 'Tap to capture'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right 5 columns: Issue Readiness Gate + Control Number Payment & Bind */}
          <aside className="lg:col-span-5">
            <div className="sticky top-24 space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              {/* Readiness Gate Card */}
              <div>
                <h3 className="text-base font-bold text-slate-900">Issuance Readiness Gate</h3>
                {quote.readiness.issueReady ? (
                  <div className="mt-2 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                    All compliance, KYC, date-overlap & referral checks passed. Ready for payment!
                  </div>
                ) : (
                  <div className="mt-2 rounded-xl bg-amber-50 p-3.5 text-xs text-amber-950 ring-1 ring-amber-200">
                    <div className="font-bold">Complete before payment/bind:</div>
                    <ul className="mt-1.5 list-disc space-y-1 pl-4">
                      {quote.readiness.blockers.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <PaymentPanel
                mode={mode}
                quote={quote}
                defaultPhone={kycPhone}
                actionBusy={actionBusy}
                onQuoteUpdated={(updatedQuote, notice) => {
                  setQuote(updatedQuote);
                  setActionError(null);
                  setStatusNotice(notice);
                }}
                onError={(msg) => setActionError(msg)}
                onBindTira={handleBindTira}
              />
            </div>
          </aside>
        </section>
      )}

      {/* =================================================================== */}
      {/* STEP 4: ISSUED DIGITAL STICKERS + TIRA MIS COMMUNICATION LOG        */}
      {/* =================================================================== */}
      {step === 4 && quote && (
        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2
                ref={stepHeadingRef}
                tabIndex={-1}
                className="text-2xl font-extrabold text-slate-900 outline-none"
              >
                {quote.policies.length > 0
                  ? 'Cover Issued & TIRA Verified!'
                  : 'TIRA MIS Submission Requires Attention'}
              </h2>
              <p className="text-sm text-slate-500">
                Quote {quote.quoteNumber} · Status: <strong>{quote.statusLabel}</strong>
              </p>
            </div>
            <div className="flex gap-2">
              {quote.status === 'TIRA_REJECTED' && (
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Fix & Retry Submission
                </button>
              )}
              <button
                type="button"
                onClick={handleResetWizard}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
              >
                + Issue Another Policy
              </button>
            </div>
          </div>

          {/* Issued Digital Sticker Cards */}
          {quote.policies.length > 0 && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {quote.policies.map((p) => (
                <StickerCard
                  key={p.id}
                  policy={{
                    ...p,
                    insurerName: quote.insurer?.name,
                    firstLossPayee: quote.firstLossPayee,
                  }}
                  onVerifyInEcosystem={mode === 'BROKER' ? onVerifyInEcosystem : undefined}
                />
              ))}
            </div>
          )}

          {/* TIRA MIS Communication Log (Exact Regulatory Audit Table) */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="text-base font-bold text-slate-900">TIRA MIS Communication Log</h3>
              <p className="text-xs text-slate-500">
                Authoritative regulator acknowledgments, cover note numbers, sticker numbers, and rejection codes.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Request ID</th>
                    <th className="px-4 py-3">Plate</th>
                    <th className="px-4 py-3">Acknowledgment ID</th>
                    <th className="px-4 py-3">TIRA MIS Status</th>
                    <th className="px-4 py-3">Cover Note No.</th>
                    <th className="px-4 py-3">Sticker No.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {quote.tiraLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-4 py-3 font-mono-code font-semibold text-slate-800">
                        {log.requestId}
                      </td>
                      <td className="px-4 py-3 font-mono-code font-bold text-slate-900">
                        {log.normalizedPlate}
                      </td>
                      <td className="px-4 py-3 font-mono-code text-slate-600">
                        {log.acknowledgmentId}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 font-bold ${
                            log.success
                              ? 'bg-emerald-50 text-emerald-800'
                              : 'bg-rose-50 text-rose-800'
                          }`}
                        >
                          {log.tiraStatusMessage}
                        </span>
                        {log.actionableNextStep && (
                          <div className="mt-1 text-[11px] text-rose-700">
                            Next step: {log.actionableNextStep}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono-code font-bold text-slate-900">
                        {log.coverNoteNo ?? '—'}
                      </td>
                      <td className="px-4 py-3 font-mono-code font-bold text-slate-900">
                        {log.stickerNo ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

import { z } from 'zod';

/**
 * Canonical Motor Vehicle Classes matching TIRA MRO Motor Insurance Rates
 */
export const VehicleClassSchema = z.enum([
  'PRIVATE_CAR',
  'MOTORCYCLE_2W',
  'THREE_WHEELER_BAJAJI',
  'COMMERCIAL_OWN_GOODS',
  'COMMERCIAL_GENERAL_CARTAGE',
  'TRAILER_UNDER_10Y',
  'TRAILER_OVER_10Y_OR_CONVERSION',
  'OIL_TANKER_STEEL_UNDER_10Y',
  'OIL_TANKER_ALUMINIUM_UNDER_10Y',
  'OIL_TANKER_OVER_10Y',
  'PASSENGER_TAXI_PRIVATE_HIRE',
  'PASSENGER_BUS_DALADALA',
  'PASSENGER_BUS_UPCOUNTRY',
  'PASSENGER_BUS_PRIVATE',
  'PASSENGER_BUS_SCHOOL',
  'SPECIAL_TYPE_VEHICLE',
]);
export type VehicleClass = z.infer<typeof VehicleClassSchema>;

export const CoverTypeSchema = z.enum(['COMPREHENSIVE', 'TPFT', 'TPO']);
export type CoverType = z.infer<typeof CoverTypeSchema>;

export const PolicyStateSchema = z.enum([
  'DRAFT',
  'LOOKUP_COMPLETE',
  'QUOTED',
  'REFERRED',
  'DECLINED',
  'ISSUE_READY',
  'PAYMENT_PENDING',
  'PAYMENT_CONFIRMED',
  'PAYMENT_REVERSED',
  'SUBMITTING_TIRA',
  'TIRA_REJECTED',
  'ISSUED',
  'DELIVERED',
  'CANCELLED',
]);
export type PolicyState = z.infer<typeof PolicyStateSchema>;

export const PaymentStateSchema = z.enum([
  'NOT_INITIATED',
  'PENDING',
  'CONFIRMED',
  'REVERSED',
  'UNAVAILABLE',
]);
export type PaymentState = z.infer<typeof PaymentStateSchema>;

export const PaymentMethodSchema = z.enum([
  'MOBILE_MONEY',
  'DIRECT_BANK_DEPOSIT',
  'CONTROL_NUMBER_BANK',
  'CARD',
  'CORPORATE_CREDIT',
]);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const ClaimsFreeStatusSchema = z.enum([
  'SELF_DECLARED_CLAIMS_FREE',
  'SELF_DECLARED_WITH_CLAIM',
  'VERIFIED_CLAIMS_FREE',
  'VERIFIED_WITH_CLAIM',
]);
export type ClaimsFreeStatus = z.infer<typeof ClaimsFreeStatusSchema>;

export const TonnageBandSchema = z.enum([
  'UP_TO_2T',
  'ABOVE_2T_TO_5T',
  'ABOVE_5T_TO_10T',
  'ABOVE_10T',
]);
export type TonnageBand = z.infer<typeof TonnageBandSchema>;

export const CoverDurationSchema = z.enum([
  'ANNUAL_12M',
  'SHORT_UNDER_1M',
  'SHORT_1_TO_2M',
  'SHORT_2_TO_3M',
  'SHORT_3_TO_4M',
  'SHORT_4_TO_5M',
  'SHORT_5_TO_6M',
  'SHORT_6_TO_7M',
  'SHORT_7_TO_8M',
]);
export type CoverDuration = z.infer<typeof CoverDurationSchema>;

export const ProposalQuestionnaireSchema = z.object({
  previousInsurer: z.string().max(120).optional().default(''),
  overnightParking: z
    .enum(['LOCKED_GARAGE', 'GATED_COMPOUND', 'STREET_OR_PUBLIC', 'COMMERCIAL_YARD'])
    .default('GATED_COMPOUND'),
  priorDeclinedOrCancelled: z.boolean().default(false),
  priorDeclinedDetails: z.string().max(300).optional().default(''),
  accidentsOrLossesLast3Years: z.boolean().default(false),
  accidentsDetails: z.string().max(300).optional().default(''),
  vehicleModifiedOrDefective: z.boolean().default(false),
  modificationDetails: z.string().max(300).optional().default(''),
  driverConvictionsOrUnder25: z.boolean().default(false),
  driverDetails: z.string().max(300).optional().default(''),
});
export type ProposalQuestionnaire = z.infer<typeof ProposalQuestionnaireSchema>;

export const AddOnsSelectionSchema = z.object({
  excessBuyBack: z.boolean().default(false),
  pvt: z.boolean().default(false),
  excessProtector: z.boolean().default(false),
  lossOfUse: z.boolean().default(false),
  geographicalExtension: z.boolean().default(false),
  increasedTppdLimitAbove50M: z.number().min(0).default(0),
  windscreenSumInsured: z.number().min(0).default(0),
  accessoriesSumInsured: z.number().min(0).default(0),
  accessoriesDescription: z.string().optional(),
});
export type AddOnsSelection = z.infer<typeof AddOnsSelectionSchema>;

export const DiscountsSelectionSchema = z.object({
  trackingDevice: z
    .object({
      requested: z.boolean().default(false),
      evidenceRef: z.string().optional(),
      providerName: z.string().optional(),
    })
    .default({ requested: false }),
  tatoaTaboaMember: z
    .object({
      requested: z.boolean().default(false),
      membershipApprovalRef: z.string().optional(),
    })
    .default({ requested: false }),
  fleetDiscount: z
    .object({
      requested: z.boolean().default(false),
      fleetSize: z.number().int().min(0).optional(),
      comprehensiveRatioPct: z.number().min(0).max(100).optional(),
      claimsRatioPct: z.number().min(0).max(100).optional(),
      committeeApprovalRef: z.string().optional(),
    })
    .default({ requested: false }),
});
export type DiscountsSelection = z.infer<typeof DiscountsSelectionSchema>;

export interface VehicleFactSnapshot {
  normalizedPlate: string;
  enteredPlate: string;
  chassisNo: string;
  engineNo: string;
  make: string;
  model: string;
  modelNumber?: string;
  bodyType: string;
  manufactureYear: number;
  fuelType: string;
  color: string;
  cc: number;
  seats: number;
  grossWeightKg: number;
  tareWeightKg: number;
  axles: number;
  registeredOwnerName: string;
  registeredUsage: string;
  suggestedClass: VehicleClass;
  source: 'TRA_LIVE' | 'TRA_MOCK' | 'MANUAL_FALLBACK';
  fetchedAt: string;
}

export interface ActiveCoverStatus {
  status: 'NO_ACTIVE_COVER' | 'ACTIVE_COVER_FOUND' | 'LOOKUP_UNAVAILABLE';
  tiraCode?: string;
  message: string;
  existingInsurer?: string;
  existingCoverNoteNo?: string;
  existingStickerNo?: string;
  expiryDate?: string; // YYYY-MM-DD
  suggestedStartDate?: string; // YYYY-MM-DD
  checkedAt: string;
}

export interface ValuationGuidance {
  minTzs: number;
  recommendedTzs: number;
  maxTzs: number;
  currency: 'TZS';
  basis: string;
}

export interface VehicleCorrectionRecord {
  id: string;
  field: 'vehicleClass' | 'actualUse' | 'seats' | 'tonnageBand';
  fetchedValue: string;
  proposedValue: string;
  reason: string;
  evidenceFileName?: string;
  proposedBy: string;
  proposedAt: string;
  status: 'PENDING_INSURER_ACCEPTANCE' | 'ACCEPTED' | 'REJECTED';
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface PremiumLineItem {
  code: string;
  label: string;
  formula: string;
  amountTzs: number;
  category: 'BASE' | 'SEAT_OR_PASSENGER' | 'MINIMUM_ADJ' | 'SHORT_PERIOD_ADJ' | 'ADDON' | 'DISCOUNT' | 'TAX';
}

export interface DiscountDecision {
  code: 'TRACKING_DEVICE' | 'TATOA_TABOA' | 'FLEET_20';
  label: string;
  applied: boolean;
  amountTzs: number;
  reason: string;
  requiresReferral: boolean;
}

export interface ExcessSummary {
  standardDescription: string;
  theftDescription: string;
  ratePct?: number;
  minTzs?: number;
}

export interface BrokerCommissionBreakdown {
  commissionRatePct: number;
  brokerCommissionTzs: number;
  vatOnCommissionPct: number;
  vatOnCommissionTzs: number;
  /** Total commission invoiceable by broker from the insurer (commission + 18% VAT) */
  totalCommissionReceivableTzs: number;
  /** 100% gross premium paid directly to the insurer under TIRA Cash-and-Carry */
  grossPayableToInsurerTzs: number;
  /** Legacy/internal analytical figure (gross minus commission & VAT on commission) */
  insurerSettlementTzs: number;
}

export interface RatingCalculationResult {
  priceable: boolean;
  referralRequired: boolean;
  referralReasons: string[];
  blockingErrors: string[];
  ruleVersion: string;
  ruleSource: string;
  insurerCode: string;
  vehicleClass: VehicleClass;
  coverType: CoverType;
  duration: CoverDuration;
  sumInsuredTzs: number;
  seatCount?: number;
  basePremiumTzs: number;
  netPremiumBeforeTaxTzs: number;
  vatRatePct: number;
  vatAmountTzs: number;
  totalPayableTzs: number;
  lineItems: PremiumLineItem[];
  discountDecisions: DiscountDecision[];
  excess: ExcessSummary;
  commission: BrokerCommissionBreakdown;
  calculatedAt: string;
}

/**
 * Canonical Ecosystem Contracts for ClaimFlow & AutoFix GMS
 */
export interface EcosystemPolicyVerification {
  found: boolean;
  policyId?: string;
  policyNo?: string;
  coverNoteNo?: string;
  stickerNo?: string;
  status?: PolicyState;
  insurerCode?: string;
  insurerName?: string;
  coverType?: CoverType;
  vehicleClass?: VehicleClass;
  startDate?: string;
  endDate?: string;
  sumInsuredTzs?: number;
  excess?: ExcessSummary;
  firstLossPayee?: string | null;
  claimsFreeDeclaration?: {
    status: ClaimsFreeStatus;
    declaredAt: string;
  };
  vehicle?: {
    normalizedPlate: string;
    chassisNo: string;
    engineNo: string;
    make: string;
    model: string;
    manufactureYear: number;
    bodyType: string;
    color: string;
  };
  insured?: {
    fullName: string;
    phone: string;
    email?: string | null;
  };
  preCoverPhotos?: Array<{
    id: string;
    angle: string;
    capturedAt: string;
    url: string;
    consentGiven: boolean;
  }>;
}

export interface ClaimsFeedbackPayload {
  normalizedPlate: string;
  policyNo?: string;
  claimFlowClaimId: string;
  lossDate: string;
  claimStatus: 'OPEN' | 'SETTLED' | 'CLOSED_NO_PAYMENT';
  verifiedAt: string;
}

export function normalizePlate(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function computeEndDateIso(startDate: string, duration: CoverDuration): string {
  const d = new Date(`${startDate}T00:00:00Z`);
  switch (duration) {
    case 'ANNUAL_12M':
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      d.setUTCDate(d.getUTCDate() - 1);
      return d.toISOString().slice(0, 10);
    case 'SHORT_UNDER_1M':
      return addDaysIso(startDate, 29);
    case 'SHORT_1_TO_2M':
      return addDaysIso(startDate, 59);
    case 'SHORT_2_TO_3M':
      return addDaysIso(startDate, 89);
    case 'SHORT_3_TO_4M':
      return addDaysIso(startDate, 119);
    case 'SHORT_4_TO_5M':
      return addDaysIso(startDate, 149);
    case 'SHORT_5_TO_6M':
      return addDaysIso(startDate, 179);
    case 'SHORT_6_TO_7M':
      return addDaysIso(startDate, 209);
    case 'SHORT_7_TO_8M':
      return addDaysIso(startDate, 239);
  }
}

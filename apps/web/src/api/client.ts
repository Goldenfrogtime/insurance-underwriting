import type {
  ActiveCoverStatus,
  AddOnsSelection,
  ClaimsFreeStatus,
  CoverDuration,
  CoverType,
  DiscountsSelection,
  EcosystemPolicyVerification,
  InsurerProfile,
  PaymentMethod,
  PaymentState,
  RatingCalculationResult,
  TonnageBand,
  ValuationGuidance,
  VehicleClass,
  VehicleClassMeta,
  VehicleFactSnapshot,
} from '@coverflow/domain';

const API_BASE = '/api/v1';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`) as Error & {
      status?: number;
      data?: unknown;
    };
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data as T;
}

export interface UatUser {
  email: string;
  name: string;
  organization: string | null;
  role: 'ADMIN' | 'BROKER_TESTER' | 'CLIENT_USER';
}

export interface AllowedTesterRecord {
  id: string;
  email: string;
  name: string;
  organization: string | null;
  role: 'ADMIN' | 'BROKER_TESTER' | 'CLIENT_USER';
  active: boolean;
  expiresAt: string | null;
  lastSeenAt: string | null;
  createdAt: string;
}

export interface BrokerRemarkRecord {
  id: string;
  testerEmail: string;
  testerName: string;
  organization: string | null;
  category: 'PRICING' | 'MISSING_FIELD' | 'CONFUSING_STEP' | 'BUG' | 'GREAT';
  rating: number | null;
  mode: 'BROKER' | 'CLIENT_APP';
  screen: string;
  quoteNumber: string | null;
  plate: string | null;
  comment: string;
  status: 'NEW' | 'REVIEWED' | 'RESOLVED';
  createdAt: string;
}

export interface CatalogResponse {
  ruleVersion: string;
  ruleSource: string;
  insurers: InsurerProfile[];
  vehicleClasses: VehicleClassMeta[];
  durations: Array<{ code: CoverDuration; factor: number; label: string }>;
  tonnageBands: Array<{ code: TonnageBand; label: string; amountTzs: number }>;
  samplePlates: Array<{
    plate: string;
    label: string;
    description: string;
    suggestedClass: VehicleClass;
    hasActiveCover: boolean;
  }>;
}

export interface PlateLookupResponse {
  normalizedPlate: string;
  tra: {
    ok: boolean;
    vehicle?: VehicleFactSnapshot;
    unavailable?: boolean;
    errorMessage?: string;
  };
  activeCover: ActiveCoverStatus;
  valuation: ValuationGuidance | null;
  matchedCustomer: ClientRecord | null;
  verifiedClaimsHistory: {
    hasVerifiedClaims: boolean;
    claims: Array<{
      id: string;
      claimFlowId: string;
      lossDate: string;
      claimStatus: string;
    }>;
  };
  recommendedStartDate: string;
}

export interface ClientRecord {
  id: string;
  fullName: string;
  customerType: 'INDIVIDUAL' | 'CORPORATE';
  idType: 'NIDA' | 'TIN' | 'PASSPORT' | null;
  idNumber: string | null;
  tinNumber: string | null;
  phone: string;
  email: string | null;
  region: string | null;
  district: string | null;
  address: string | null;
}

export interface HydratedQuoteItem {
  id: string;
  version: number;
  vehicleClass: VehicleClass;
  actualUse: string;
  coverType: CoverType;
  duration: CoverDuration;
  startDate: string;
  endDate: string;
  sumInsuredTzs: number;
  seatCount: number | null;
  tonnageBand: TonnageBand | null;
  carriesPassengers2W3W: boolean;
  claimsFreeStatus: ClaimsFreeStatus;
  netPremiumTzs: number;
  vatAmountTzs: number;
  totalPayableTzs: number;
  referralRequired: boolean;
  referralApproved: boolean;
  vehicle: {
    normalizedPlate: string;
    make: string;
    model: string;
    manufactureYear: number;
    chassisNo: string;
    engineNo: string;
    bodyType: string;
    color: string;
    seats: number;
    cc: number;
    registeredOwnerName: string;
    registeredUsage: string;
  };
  addOns: Partial<AddOnsSelection>;
  discounts: Partial<DiscountsSelection>;
  activeCover: ActiveCoverStatus;
  calculation: RatingCalculationResult;
  corrections: Array<{
    id: string;
    field: string;
    fetchedValue: string;
    proposedValue: string;
    reason: string;
    evidenceFileName: string | null;
    status: string;
    reviewedBy: string | null;
  }>;
}

export interface HydratedQuote {
  id: string;
  quoteNumber: string;
  channel: 'BROKER' | 'CLIENT_APP';
  brokerName: string | null;
  insurerCode: string;
  insurer?: InsurerProfile;
  status: string;
  statusLabel: string;
  activeVersion: number;
  totalNetPremiumTzs: number;
  totalVatTzs: number;
  totalPayableTzs: number;
  totalBrokerCommissionTzs: number;
  totalVatOnCommissionTzs: number;
  totalInsurerSettlementTzs: number;
  customerId: string | null;
  customer: ClientRecord | null;
  ownerRelationship: string | null;
  ownerRelationshipConfirmed: boolean;
  firstLossPayee: string | null;
  proposalAccepted: boolean;
  proposalSignedBy: string | null;
  proposalSignedAt: string | null;
  createdAt: string;
  updatedAt: string;
  readiness: {
    issueReady: boolean;
    blockers: string[];
  };
  items: HydratedQuoteItem[];
  payments: Array<{
    id: string;
    controlNumber: string;
    providerReference: string;
    method: PaymentMethod;
    mobileNetwork: 'MPESA' | 'MIXX_YAS' | 'AIRTEL_MONEY' | 'HALOPESA' | null;
    bankName: string | null;
    depositorReference: string | null;
    proofFileName: string | null;
    proofDataUrl: string | null;
    amountTzs: number;
    payerPhone: string | null;
    state: PaymentState;
    instructions: string;
    providerReceiptNo: string | null;
    statusMessage: string | null;
    clearedAt: string | null;
    expiresAt: string;
  }>;
  preCoverPhotos: Array<{
    id: string;
    plate: string;
    angle: string;
    dataUrl: string;
    consentGiven: boolean;
    capturedAt: string;
  }>;
  policies: Array<{
    id: string;
    policyNo: string;
    coverNoteNo: string;
    stickerNo: string;
    insurerCode: string;
    vehicleClass: VehicleClass;
    coverType: CoverType;
    startDate: string;
    endDate: string;
    sumInsuredTzs: number;
    totalPayableTzs: number;
    status: string;
    issuedAt: string;
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
  }>;
  tiraLogs: Array<{
    id: string;
    requestId: string;
    normalizedPlate: string;
    acknowledgmentId: string;
    tiraStatusCode: string;
    tiraStatusMessage: string;
    coverNoteNo: string | null;
    stickerNo: string | null;
    actionableNextStep: string | null;
    success: boolean;
    createdAt: string;
  }>;
  auditEvents: Array<{
    id: string;
    actor: string;
    eventType: string;
    fromState: string | null;
    toState: string | null;
    details: string;
    createdAt: string;
  }>;
}

export const api = {
  getCatalog: () => apiFetch<CatalogResponse>('/meta/catalog'),
  lookupPlate: (plate: string, scope: 'client' | 'broker' = 'broker') =>
    apiFetch<PlateLookupResponse>('/lookup/plate', {
      method: 'POST',
      body: JSON.stringify({ plate, scope }),
    }),
  verifyKyc: (idType: 'NIDA' | 'TIN' | 'PASSPORT', idNumber: string) =>
    apiFetch<{
      found: boolean;
      fullName?: string;
      phone?: string;
      region?: string;
      district?: string;
      source: string;
    }>('/lookup/kyc', {
      method: 'POST',
      body: JSON.stringify({ idType, idNumber }),
    }),
  previewRating: (payload: Record<string, unknown>) =>
    apiFetch<{
      comparisons?: Array<{ insurer: InsurerProfile; calculation: RatingCalculationResult }>;
      insurer?: InsurerProfile;
      calculation?: RatingCalculationResult;
    }>('/rating/preview', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  listClients: (q = '') =>
    apiFetch<{ clients: ClientRecord[] }>(`/clients?scope=broker${q ? `&q=${encodeURIComponent(q)}` : ''}`),
  listQuotes: (scope: 'client' | 'broker' = 'broker') =>
    apiFetch<{ scope: 'client' | 'broker'; quotes: HydratedQuote[] }>(`/quotes?scope=${scope}`),
  getQuote: (id: string, scope: 'client' | 'broker' = 'broker') =>
    apiFetch<HydratedQuote>(`/quotes/${id}?scope=${scope}`),
  createQuote: (payload: Record<string, unknown>) =>
    apiFetch<HydratedQuote>('/quotes', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  addQuoteItem: (quoteId: string, payload: Record<string, unknown>) =>
    apiFetch<HydratedQuote>(`/quotes/${quoteId}/items`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateQuoteItem: (quoteId: string, itemId: string, payload: Record<string, unknown>) =>
    apiFetch<HydratedQuote>(`/quotes/${quoteId}/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  decideCorrection: (quoteId: string, correctionId: string, decision: 'ACCEPTED' | 'REJECTED') =>
    apiFetch<HydratedQuote>(`/quotes/${quoteId}/corrections/${correctionId}/decide`, {
      method: 'POST',
      body: JSON.stringify({ decision }),
    }),
  approveReferral: (quoteId: string) =>
    apiFetch<HydratedQuote>(`/quotes/${quoteId}/referral/approve`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  saveKycDeclaration: (quoteId: string, payload: Record<string, unknown>) =>
    apiFetch<HydratedQuote>(`/quotes/${quoteId}/kyc-declaration`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  uploadPhoto: (quoteId: string, payload: { plate: string; angle: string; dataUrl: string; consentGiven: boolean }) =>
    apiFetch<HydratedQuote>(`/quotes/${quoteId}/photos`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  initiatePayment: (
    quoteId: string,
    payload: {
      method: PaymentMethod;
      payerPhone?: string;
      mobileNetwork?: 'MPESA' | 'MIXX_YAS' | 'AIRTEL_MONEY' | 'HALOPESA';
      bankName?: string;
      depositorReference?: string;
      proofFileName?: string;
      proofDataUrl?: string;
    },
  ) =>
    apiFetch<{ payment: HydratedQuote['payments'][0]; quote: HydratedQuote }>(
      `/quotes/${quoteId}/payments/initiate`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),
  uploadPaymentProof: (
    controlNumber: string,
    payload: { depositorReference?: string; proofFileName: string; proofDataUrl: string },
  ) =>
    apiFetch<{ payment: HydratedQuote['payments'][0]; quote: HydratedQuote }>(
      `/payments/${encodeURIComponent(controlNumber)}/proof`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),
  simulatePayment: (controlNumber: string, state: PaymentState) =>
    apiFetch<{ payment: HydratedQuote['payments'][0]; quote: HydratedQuote }>(
      `/payments/${encodeURIComponent(controlNumber)}/simulate`,
      {
        method: 'POST',
        body: JSON.stringify({ state }),
      },
    ),
  bindQuote: (quoteId: string) =>
    apiFetch<{ policies: HydratedQuote['policies']; quote: HydratedQuote }>(`/quotes/${quoteId}/bind`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  listPolicies: (scope: 'client' | 'broker' = 'broker') =>
    apiFetch<{
      scope: 'client' | 'broker';
      policies: Array<
        HydratedQuote['policies'][0] & {
          insurer?: InsurerProfile;
          excess?: { standardDescription?: string; theftDescription?: string };
          photoCount: number;
          firstLossPayee?: string | null;
        }
      >;
    }>(`/policies?scope=${scope}`),
  verifyEcosystemPolicy: (plate: string) =>
    apiFetch<EcosystemPolicyVerification>(
      `/ecosystem/policies/verify?plate=${encodeURIComponent(plate)}`,
    ),
  submitClaimsFeedback: (payload: {
    normalizedPlate: string;
    policyNo?: string;
    claimFlowClaimId: string;
    lossDate: string;
    claimStatus: 'OPEN' | 'SETTLED' | 'CLOSED_NO_PAYMENT';
  }) =>
    apiFetch<{ recorded: boolean }>('/ecosystem/claims-feedback', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // UAT Access Control & Remarks
  getUatStatus: () =>
    apiFetch<{ testingOpen: boolean; sandboxBannerText: string; googleClientId: string | null }>(
      '/uat/status',
    ),
  getUatMe: () =>
    apiFetch<{ authenticated: boolean; user?: UatUser; reason?: string }>('/uat/me'),
  uatLogin: (payload: { email?: string; passcode?: string; googleIdToken?: string }) =>
    apiFetch<{ authenticated: boolean; user: UatUser }>('/uat/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  uatLogout: () => apiFetch<{ loggedOut: boolean }>('/uat/logout', { method: 'POST', body: '{}' }),

  submitRemark: (payload: {
    category: BrokerRemarkRecord['category'];
    rating?: number;
    mode: 'BROKER' | 'CLIENT_APP';
    screen: string;
    quoteNumber?: string | null;
    plate?: string | null;
    comment: string;
  }) =>
    apiFetch<{ remark: BrokerRemarkRecord }>('/uat/remarks', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getMyRemarks: () => apiFetch<{ remarks: BrokerRemarkRecord[] }>('/uat/remarks/mine'),

  getAdminOverview: () =>
    apiFetch<{
      settings: { testingOpen: boolean; brokerAccessCode: string; sandboxBannerText: string };
      testers: AllowedTesterRecord[];
      remarks: BrokerRemarkRecord[];
    }>('/uat/admin/overview'),
  updateAdminSettings: (payload: {
    testingOpen?: boolean;
    brokerAccessCode?: string;
    sandboxBannerText?: string;
  }) =>
    apiFetch<{
      settings: { testingOpen: boolean; brokerAccessCode: string; sandboxBannerText: string };
    }>('/uat/admin/settings', { method: 'PATCH', body: JSON.stringify(payload) }),
  addAllowedTester: (payload: {
    email: string;
    name: string;
    organization?: string;
    role?: 'ADMIN' | 'BROKER_TESTER' | 'CLIENT_USER';
    expiresAt?: string | null;
  }) =>
    apiFetch<{ tester: AllowedTesterRecord }>('/uat/admin/testers', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateAllowedTester: (id: string, payload: { active?: boolean; expiresAt?: string | null }) =>
    apiFetch<{ tester: AllowedTesterRecord }>(`/uat/admin/testers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteAllowedTester: (id: string) =>
    apiFetch<{ deleted: boolean }>(`/uat/admin/testers/${id}`, { method: 'DELETE' }),
  updateRemarkStatus: (id: string, status: 'NEW' | 'REVIEWED' | 'RESOLVED') =>
    apiFetch<{ remark: BrokerRemarkRecord }>(`/uat/admin/remarks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};

export function formatTzs(amount: number | undefined | null): string {
  return `TZS ${Math.round(amount ?? 0).toLocaleString('en-US')}`;
}

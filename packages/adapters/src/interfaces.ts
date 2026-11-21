import type {
  ActiveCoverStatus,
  PaymentMethod,
  PaymentState,
  ValuationGuidance,
  VehicleFactSnapshot,
} from '@coverflow/domain';

export interface TraLookupResult {
  ok: boolean;
  vehicle?: VehicleFactSnapshot;
  unavailable?: boolean;
  errorMessage?: string;
}

export interface TraVehicleAdapter {
  lookupByPlate(plate: string): Promise<TraLookupResult>;
}

export interface TiraSubmissionPayload {
  requestId: string;
  insurerCode: string;
  normalizedPlate: string;
  chassisNo: string;
  vehicleClass: string;
  coverType: string;
  startDate: string;
  endDate: string;
  sumInsuredTzs: number;
  netPremiumTzs: number;
  vatTzs: number;
  totalPayableTzs: number;
  insuredName: string;
  insuredIdNumber: string;
  paymentReference: string;
}

export interface TiraSubmissionResult {
  success: boolean;
  requestId: string;
  acknowledgmentId: string;
  tiraStatusCode: string; // e.g., TIRA001, TIRA402, TIRA2205
  tiraStatusMessage: string;
  coverNoteNo?: string;
  stickerNo?: string;
  actionableNextStep?: string;
  submittedAt: string;
}

export interface TiraMisAdapter {
  checkActiveCover(plate: string): Promise<ActiveCoverStatus>;
  submitCoverNote(payload: TiraSubmissionPayload): Promise<TiraSubmissionResult>;
}

export interface KycLookupResult {
  found: boolean;
  idType: 'NIDA' | 'TIN' | 'PASSPORT';
  idNumber: string;
  fullName?: string;
  dateOfBirth?: string;
  gender?: 'Male' | 'Female';
  nationality?: string;
  phone?: string;
  region?: string;
  district?: string;
  source: 'NIDA_MOCK' | 'TIN_MOCK' | 'MANUAL';
}

export interface KycAdapter {
  verifyIdentity(idType: 'NIDA' | 'TIN' | 'PASSPORT', idNumber: string): Promise<KycLookupResult>;
}

export interface ValuationAdapter {
  estimateMarketValue(params: {
    make: string;
    model: string;
    manufactureYear: number;
    vehicleClass: string;
  }): Promise<ValuationGuidance>;
}

export interface PaymentInitRequest {
  quoteId: string;
  quoteNumber: string;
  insurerCode: string;
  amountTzs: number;
  method: PaymentMethod;
  payerPhone?: string;
  payerName: string;
}

export interface PaymentInitResult {
  controlNumber: string;
  providerReference: string;
  state: PaymentState;
  instructions: string;
  expiresAt: string;
}

export interface PaymentGatewayAdapter {
  initiatePayment(req: PaymentInitRequest): Promise<PaymentInitResult>;
  checkPaymentStatus(controlNumber: string): Promise<{
    state: PaymentState;
    providerReceiptNo?: string;
    clearedAt?: string;
    message: string;
  }>;
}

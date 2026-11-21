import {
  addDaysIso,
  normalizePlate,
  type ActiveCoverStatus,
  type PaymentState,
  type ValuationGuidance,
  type VehicleFactSnapshot,
} from '@coverflow/domain';
import type {
  KycAdapter,
  KycLookupResult,
  PaymentGatewayAdapter,
  PaymentInitRequest,
  PaymentInitResult,
  TiraMisAdapter,
  TiraSubmissionPayload,
  TiraSubmissionResult,
  TraLookupResult,
  TraVehicleAdapter,
  ValuationAdapter,
} from './interfaces.js';

export interface MockPlateScenario {
  plate: string;
  label: string;
  scenarioDescription: string;
  vehicle: Omit<VehicleFactSnapshot, 'enteredPlate' | 'fetchedAt'>;
  activeCover?: {
    insurer: string;
    coverNoteNo: string;
    stickerNo: string;
    expiryDate: string;
  };
  simulateTiraRejection?: {
    code: string;
    message: string;
    actionableNextStep: string;
  };
  simulateTraUnavailable?: boolean;
}

export const MOCK_PLATE_SCENARIOS: MockPlateScenario[] = [
  {
    plate: 'T101ABC',
    label: 'Toyota Harrier 2019 — Clean Fast Path',
    scenarioDescription: 'Standard private car with no active cover (< 2 min happy path)',
    vehicle: {
      normalizedPlate: 'T101ABC',
      chassisNo: 'ZSU60-0148821',
      engineNo: '3ZR-B491022',
      make: 'Toyota',
      model: 'Harrier',
      modelNumber: 'DBA-ZSU60W',
      bodyType: 'STATION WAGON',
      manufactureYear: 2019,
      fuelType: 'Petrol',
      color: 'Pearl White',
      cc: 1986,
      seats: 5,
      grossWeightKg: 1920,
      tareWeightKg: 1610,
      axles: 2,
      registeredOwnerName: 'AMINA HASSAN MWANGI',
      registeredUsage: 'Private or Normal',
      suggestedClass: 'PRIVATE_CAR',
      source: 'TRA_MOCK',
    },
  },
  {
    plate: 'T999ECS',
    label: 'Toyota Landcruiser 2001 — Active TIRA Cover (2205)',
    scenarioDescription: 'Active TIRA cover until 05-Jul-2027 (tests future-dated renewal & overlap block)',
    vehicle: {
      normalizedPlate: 'T999ECS',
      chassisNo: 'UZJ1000135427',
      engineNo: '2UZEAA918176',
      make: 'Toyota',
      model: 'Landcruiser',
      modelNumber: 'GF-UZJ100W',
      bodyType: 'STATION WAGON',
      manufactureYear: 2001,
      fuelType: 'Petrol',
      color: 'Silver Metallic',
      cc: 4660,
      seats: 8,
      grossWeightKg: 2390,
      tareWeightKg: 2390,
      axles: 2,
      registeredOwnerName: 'ABUBAKAR IBRAHIM ZAKARIA',
      registeredUsage: 'Private or Normal',
      suggestedClass: 'PRIVATE_CAR',
      source: 'TRA_MOCK',
    },
    activeCover: {
      insurer: 'MUA Insurance (Tanzania) Ltd',
      coverNoteNo: '10826-24138-04120',
      stickerNo: '26002-24170-01190',
      expiryDate: '2027-07-05',
    },
  },
  {
    plate: 'T999ECX',
    label: 'Toyota IST 2006 — Multi-Vehicle Companion',
    scenarioDescription: 'Private compact hatchback ideal for testing multi-vehicle quote bundles',
    vehicle: {
      normalizedPlate: 'T999ECX',
      chassisNo: 'NCP600240098',
      engineNo: '2NZ4172857',
      make: 'Toyota',
      model: 'IST',
      modelNumber: 'NCP60',
      bodyType: 'STATION WAGON',
      manufactureYear: 2006,
      fuelType: 'Petrol',
      color: 'Silver',
      cc: 1290,
      seats: 5,
      grossWeightKg: 1000,
      tareWeightKg: 1000,
      axles: 2,
      registeredOwnerName: 'ABUBAKAR IBRAHIM ZAKARIA',
      registeredUsage: 'Private or Normal',
      suggestedClass: 'PRIVATE_CAR',
      source: 'TRA_MOCK',
    },
  },
  {
    plate: 'T999EDM',
    label: 'Toyota Landcruiser 2021 — High Value (TZS 200M)',
    scenarioDescription: 'Matches Smart Policy screenshot vehicle (TZS 200M @ 3.5% = TZS 8.26M incl. VAT)',
    vehicle: {
      normalizedPlate: 'T999EDM',
      chassisNo: 'FJA3004005599',
      engineNo: 'F33A0008770',
      make: 'Toyota',
      model: 'Landcruiser',
      modelNumber: '3BA-VJA300W',
      bodyType: 'STATION WAGON',
      manufactureYear: 2021,
      fuelType: 'Diesel',
      color: 'White',
      cc: 3340,
      seats: 5,
      grossWeightKg: 2571,
      tareWeightKg: 2570,
      axles: 2,
      registeredOwnerName: 'JEREMIAH FOWAHEDI NTAKANDI',
      registeredUsage: 'Private or Normal',
      suggestedClass: 'PRIVATE_CAR',
      source: 'TRA_MOCK',
    },
  },
  {
    plate: 'T450DLD',
    label: 'Toyota Coaster 2017 — City Daladala Bus (28 Seats)',
    scenarioDescription: 'Passenger-carrying per-seat pricing (8% + TZS 15,000/seat)',
    vehicle: {
      normalizedPlate: 'T450DLD',
      chassisNo: 'HZB50-0039104',
      engineNo: '1HZ-0782210',
      make: 'Toyota',
      model: 'Coaster',
      modelNumber: 'HZB50',
      bodyType: 'BUS',
      manufactureYear: 2017,
      fuelType: 'Diesel',
      color: 'White / Blue Stripe',
      cc: 4164,
      seats: 28,
      grossWeightKg: 5400,
      tareWeightKg: 3500,
      axles: 2,
      registeredOwnerName: 'DAR EXPRESS COMMUTERS LTD',
      registeredUsage: 'Commercial Passenger Carrying',
      suggestedClass: 'PASSENGER_BUS_DALADALA',
      source: 'TRA_MOCK',
    },
  },
  {
    plate: 'T770TRK',
    label: 'Toyota Hilux 2020 — Commercial (Test Use Correction)',
    scenarioDescription: 'Fetched as Commercial Own Goods; test broker correction to Private use',
    vehicle: {
      normalizedPlate: 'T770TRK',
      chassisNo: 'GUN125-0081124',
      engineNo: '2GD-8491021',
      make: 'Toyota',
      model: 'Hilux Double Cab',
      modelNumber: 'GUN125R',
      bodyType: 'PICK-UP',
      manufactureYear: 2020,
      fuelType: 'Diesel',
      color: 'Graphite Grey',
      cc: 2393,
      seats: 5,
      grossWeightKg: 2910,
      tareWeightKg: 2040,
      axles: 2,
      registeredOwnerName: 'JOHNSON PETER KWEKA',
      registeredUsage: 'Commercial Goods Carrying',
      suggestedClass: 'COMMERCIAL_OWN_GOODS',
      source: 'TRA_MOCK',
    },
  },
  {
    plate: 'T880TNK',
    label: 'Scania R450 2020 — Steel Oil Tanker (<10y)',
    scenarioDescription: 'High-risk commercial tanker (6% min TZS 2M, 15% SI excess)',
    vehicle: {
      normalizedPlate: 'T880TNK',
      chassisNo: 'YS2R4X20005591024',
      engineNo: 'DC13-148-9012',
      make: 'Scania',
      model: 'R450 Tanker',
      modelNumber: 'R450LA',
      bodyType: 'TANKER',
      manufactureYear: 2020,
      fuelType: 'Diesel',
      color: 'White / Red',
      cc: 12742,
      seats: 2,
      grossWeightKg: 26000,
      tareWeightKg: 11200,
      axles: 3,
      registeredOwnerName: 'ASAMOIL COMPANY LIMITED',
      registeredUsage: 'Oil Tanker',
      suggestedClass: 'OIL_TANKER_STEEL_UNDER_10Y',
      source: 'TRA_MOCK',
    },
  },
  {
    plate: 'MC204BDA',
    label: 'Boxer BM150 2023 — Motorcycle / Bodaboda',
    scenarioDescription: 'Two-wheeler with optional TZS 15,000 Bodaboda passenger extension',
    vehicle: {
      normalizedPlate: 'MC204BDA',
      chassisNo: 'MD2A21BX9PWC40112',
      engineNo: 'DUZWPC99104',
      make: 'Bajaj',
      model: 'Boxer BM150',
      modelNumber: 'BM150',
      bodyType: 'MOTORCYCLE',
      manufactureYear: 2023,
      fuelType: 'Petrol',
      color: 'Red',
      cc: 145,
      seats: 2,
      grossWeightKg: 280,
      tareWeightKg: 125,
      axles: 2,
      registeredOwnerName: 'JUMA SAIDI ALLY',
      registeredUsage: 'Motorcycle Commercial',
      suggestedClass: 'MOTORCYCLE_2W',
      source: 'TRA_MOCK',
    },
  },
  {
    plate: 'T999ERR',
    label: 'Subaru Forester 2018 — TIRA Rejection Test',
    scenarioDescription: 'Simulates TIRA MIS rejection code TIRA402 on submission with actionable recovery',
    vehicle: {
      normalizedPlate: 'T999ERR',
      chassisNo: 'SJ5-0991142',
      engineNo: 'FB20-881203',
      make: 'Subaru',
      model: 'Forester',
      modelNumber: 'DBA-SJ5',
      bodyType: 'STATION WAGON',
      manufactureYear: 2018,
      fuelType: 'Petrol',
      color: 'Dark Blue',
      cc: 1995,
      seats: 5,
      grossWeightKg: 1780,
      tareWeightKg: 1490,
      axles: 2,
      registeredOwnerName: 'NEEMA CHARLES MSOFFE',
      registeredUsage: 'Private or Normal',
      suggestedClass: 'PRIVATE_CAR',
      source: 'TRA_MOCK',
    },
    simulateTiraRejection: {
      code: 'TIRA402',
      message: 'TIRA402 - Chassis/Engine verification mismatch on regulator gateway.',
      actionableNextStep:
        'Verify chassis & engine numbers against the TRA registration card, update details or attach card copy, and safely resubmit.',
    },
  },
];

export class MockTraVehicleAdapter implements TraVehicleAdapter {
  async lookupByPlate(rawPlate: string): Promise<TraLookupResult> {
    const normalized = normalizePlate(rawPlate);
    const nowIso = new Date().toISOString();

    if (normalized === 'T000OFF') {
      return {
        ok: false,
        unavailable: true,
        errorMessage: 'TRA Motor Registry service is temporarily unreachable. You may record a controlled manual fallback.',
      };
    }

    const found = MOCK_PLATE_SCENARIOS.find((s) => s.plate === normalized);
    if (found) {
      return {
        ok: true,
        vehicle: {
          ...found.vehicle,
          enteredPlate: rawPlate,
          fetchedAt: nowIso,
        },
      };
    }

    // Dynamic deterministic vehicle for any valid Tanzanian plate pattern (e.g. T123XYZ / MC123XYZ)
    if (/^(T\d{3}[A-Z]{3}|MC\d{3}[A-Z]{3})$/.test(normalized)) {
      const isMoto = normalized.startsWith('MC');
      return {
        ok: true,
        vehicle: {
          normalizedPlate: normalized,
          enteredPlate: rawPlate,
          chassisNo: isMoto ? `MD2A${normalized}881` : `JTM${normalized}004921`,
          engineNo: isMoto ? `DZ${normalized}41` : `1NZ-${normalized.slice(1)}90`,
          make: isMoto ? 'Bajaj' : 'Toyota',
          model: isMoto ? 'Boxer BM150' : 'RAV4',
          modelNumber: isMoto ? 'BM150' : 'ACA31W',
          bodyType: isMoto ? 'MOTORCYCLE' : 'STATION WAGON',
          manufactureYear: isMoto ? 2022 : 2016,
          fuelType: 'Petrol',
          color: isMoto ? 'Black' : 'Silver',
          cc: isMoto ? 150 : 1998,
          seats: isMoto ? 2 : 5,
          grossWeightKg: isMoto ? 270 : 1890,
          tareWeightKg: isMoto ? 123 : 1540,
          axles: 2,
          registeredOwnerName: 'REGISTERED MOTOR OWNER',
          registeredUsage: isMoto ? 'Motorcycle' : 'Private or Normal',
          suggestedClass: isMoto ? 'MOTORCYCLE_2W' : 'PRIVATE_CAR',
          source: 'TRA_MOCK',
          fetchedAt: nowIso,
        },
      };
    }

    return {
      ok: false,
      errorMessage: `No TRA record found for "${rawPlate}". Use a Tanzanian format like T101ABC or MC204BDA, or choose a sample plate.`,
    };
  }
}

export class MockTiraMisAdapter implements TiraMisAdapter {
  private seq = 8710;

  async checkActiveCover(rawPlate: string): Promise<ActiveCoverStatus> {
    const normalized = normalizePlate(rawPlate);
    const checkedAt = new Date().toISOString();

    if (normalized === 'T000OFF') {
      return {
        status: 'LOOKUP_UNAVAILABLE',
        message: 'TIRA MIS active-cover check is temporarily unavailable. Retry before binding.',
        checkedAt,
      };
    }

    const found = MOCK_PLATE_SCENARIOS.find((s) => s.plate === normalized);
    if (found?.activeCover) {
      return {
        status: 'ACTIVE_COVER_FOUND',
        tiraCode: '2205',
        message: `2205-The cover is found Active on TIRA MIS, expiry on ${found.activeCover.expiryDate}. Continuing with overlapping dates will result in rejection from TIRA MIS.`,
        existingInsurer: found.activeCover.insurer,
        existingCoverNoteNo: found.activeCover.coverNoteNo,
        existingStickerNo: found.activeCover.stickerNo,
        expiryDate: found.activeCover.expiryDate,
        suggestedStartDate: addDaysIso(found.activeCover.expiryDate, 1),
        checkedAt,
      };
    }

    return {
      status: 'NO_ACTIVE_COVER',
      tiraCode: 'TIRA000',
      message: 'No active conflicting motor cover found on TIRA MIS.',
      checkedAt,
    };
  }

  async submitCoverNote(payload: TiraSubmissionPayload): Promise<TiraSubmissionResult> {
    const submittedAt = new Date().toISOString();
    const ackId = `${submittedAt.replace(/\D/g, '').slice(0, 14)}${Math.floor(100 + Math.random() * 899)}`;

    const scenario = MOCK_PLATE_SCENARIOS.find((s) => s.plate === payload.normalizedPlate);
    if (scenario?.simulateTiraRejection) {
      return {
        success: false,
        requestId: payload.requestId,
        acknowledgmentId: ackId,
        tiraStatusCode: scenario.simulateTiraRejection.code,
        tiraStatusMessage: scenario.simulateTiraRejection.message,
        actionableNextStep: scenario.simulateTiraRejection.actionableNextStep,
        submittedAt,
      };
    }

    this.seq += 10;
    const coverNoteNo = `10826-24138-0${this.seq}`;
    const stickerNo = `26002-24170-0${this.seq - 5500}`;

    return {
      success: true,
      requestId: payload.requestId,
      acknowledgmentId: ackId,
      tiraStatusCode: 'TIRA001',
      tiraStatusMessage: 'TIRA001 - Successful',
      coverNoteNo,
      stickerNo,
      submittedAt,
    };
  }
}

export class MockKycAdapter implements KycAdapter {
  private readonly records: Record<string, Omit<KycLookupResult, 'found' | 'idType' | 'idNumber' | 'source'>> = {
    '19900304141120000120': {
      fullName: 'ABUBAKAR IBRAHIM ZAKARIA',
      dateOfBirth: '1990-03-04',
      gender: 'Male',
      nationality: 'Tanzania',
      phone: '+255716693809',
      region: 'Dar Es Salaam',
      district: 'Kinondoni',
    },
    '20030101010134000043': {
      fullName: 'JEREMIAH FOWAHEDI NTAKANDI',
      dateOfBirth: '2003-01-01',
      gender: 'Male',
      nationality: 'Tanzania',
      phone: '+255765849609',
      region: 'Dar Es Salaam',
      district: 'Ubungo',
    },
    '19920518141020000511': {
      fullName: 'AMINA HASSAN MWANGI',
      dateOfBirth: '1992-05-18',
      gender: 'Female',
      nationality: 'Tanzania',
      phone: '+255754221908',
      region: 'Dar Es Salaam',
      district: 'Ilala',
    },
    '114-998-273': {
      fullName: 'ABUBAKAR IBRAHIM ZAKARIA',
      nationality: 'Tanzania',
      phone: '+255716693809',
      region: 'Dar Es Salaam',
      district: 'Kinondoni',
    },
  };

  async verifyIdentity(
    idType: 'NIDA' | 'TIN' | 'PASSPORT',
    idNumber: string,
  ): Promise<KycLookupResult> {
    const clean = idNumber.trim();
    const match = this.records[clean];
    if (match) {
      return {
        found: true,
        idType,
        idNumber: clean,
        ...match,
        source: idType === 'TIN' ? 'TIN_MOCK' : 'NIDA_MOCK',
      };
    }
    return {
      found: false,
      idType,
      idNumber: clean,
      source: 'MANUAL',
    };
  }
}

export class MockValuationAdapter implements ValuationAdapter {
  async estimateMarketValue(params: {
    make: string;
    model: string;
    manufactureYear: number;
    vehicleClass: string;
  }): Promise<ValuationGuidance> {
    const key = `${params.make} ${params.model}`.toLowerCase();
    let rec = 22_000_000;

    if (key.includes('landcruiser') && params.manufactureYear >= 2020) {
      rec = 200_000_000;
    } else if (key.includes('landcruiser')) {
      rec = 50_000_000;
    } else if (key.includes('harrier')) {
      rec = 48_000_000;
    } else if (key.includes('hilux')) {
      rec = 75_000_000;
    } else if (key.includes('coaster')) {
      rec = 65_000_000;
    } else if (key.includes('scania') || key.includes('tanker')) {
      rec = 180_000_000;
    } else if (key.includes('ist')) {
      rec = 15_000_000;
    } else if (key.includes('forester')) {
      rec = 32_000_000;
    } else if (key.includes('boxer') || params.vehicleClass === 'MOTORCYCLE_2W') {
      rec = 3_200_000;
    } else if (params.vehicleClass === 'THREE_WHEELER_BAJAJI') {
      rec = 8_500_000;
    }

    const minTzs = Math.round((rec * 0.85) / 100_000) * 100_000;
    const maxTzs = Math.round((rec * 1.15) / 100_000) * 100_000;

    return {
      minTzs,
      recommendedTzs: rec,
      maxTzs,
      currency: 'TZS',
      basis: `CoverFlow Tanzania market benchmark (${params.manufactureYear} ${params.make} ${params.model})`,
    };
  }
}

export class MockPaymentGatewayAdapter implements PaymentGatewayAdapter {
  private readonly store = new Map<
    string,
    { state: PaymentState; providerReceiptNo?: string; clearedAt?: string; message: string }
  >();

  async initiatePayment(req: PaymentInitRequest): Promise<PaymentInitResult> {
    const rand = Math.floor(1000000 + Math.random() * 8999999);
    const controlNumber = `CF${rand}`;
    const providerReference = `PAY-${req.quoteNumber}-${rand}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const state: PaymentState = 'PENDING';
    this.store.set(controlNumber, {
      state,
      message: `Awaiting authoritative payment confirmation for Control Number ${controlNumber}.`,
    });

    const instructions =
      req.method === 'MOBILE_MONEY'
        ? `Pay TZS ${req.amountTzs.toLocaleString()} via M-Pesa / Mixx by Yas / Airtel Money using Control Number ${controlNumber}.`
        : req.method === 'CONTROL_NUMBER_BANK'
          ? `Deposit TZS ${req.amountTzs.toLocaleString()} at CRDB / NMB / NBC using Control Number ${controlNumber}.`
          : req.method === 'CORPORATE_CREDIT'
            ? `Corporate credit clearance requested with ${req.insurerCode} for TZS ${req.amountTzs.toLocaleString()} (Ref ${controlNumber}).`
            : `Complete Visa / Mastercard checkout for TZS ${req.amountTzs.toLocaleString()} (Ref ${controlNumber}).`;

    return {
      controlNumber,
      providerReference,
      state,
      instructions,
      expiresAt,
    };
  }

  async checkPaymentStatus(controlNumber: string) {
    return (
      this.store.get(controlNumber) ?? {
        state: 'PENDING' as PaymentState,
        message: 'Awaiting payment confirmation from gateway.',
      }
    );
  }

  setSimulatedState(controlNumber: string, state: PaymentState) {
    const now = new Date().toISOString();
    const msgMap: Record<PaymentState, string> = {
      NOT_INITIATED: 'Payment not initiated.',
      PENDING: 'Payment still pending confirmation.',
      CONFIRMED: `Authoritative payment cleared by gateway at ${now}.`,
      REVERSED: 'Payment reversed by mobile money / bank network.',
      UNAVAILABLE: 'Insurer payment clearance API is temporarily unavailable.',
    };
    this.store.set(controlNumber, {
      state,
      providerReceiptNo: state === 'CONFIRMED' ? `MPESA-${Math.floor(100000 + Math.random() * 899999)}` : undefined,
      clearedAt: state === 'CONFIRMED' ? now : undefined,
      message: msgMap[state],
    });
  }
}

export function createMockAdapterRegistry() {
  return {
    tra: new MockTraVehicleAdapter(),
    tira: new MockTiraMisAdapter(),
    kyc: new MockKycAdapter(),
    valuation: new MockValuationAdapter(),
    payment: new MockPaymentGatewayAdapter(),
  };
}

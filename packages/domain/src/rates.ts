import type {
  CoverDuration,
  CoverType,
  ExcessSummary,
  TonnageBand,
  VehicleClass,
} from './types.js';

export const RATE_SCHEDULE_VERSION = 'TIRA-MRO-2015-V1';
export const RATE_SCHEDULE_SOURCE = 'TIRA Market Adopted Actuarial Insurance Rates (Motor Section, 1 Feb 2015 + Market Extensions)';

export const VAT_RATE_PCT = 18;
export const DEFAULT_BROKER_COMMISSION_PCT = 12.5;

export const SHORT_PERIOD_FACTORS: Record<CoverDuration, { factor: number; label: string }> = {
  ANNUAL_12M: { factor: 1.0, label: 'Annual (12 Months)' },
  SHORT_UNDER_1M: { factor: 0.2, label: 'Short Period (< 1 Month — 20%)' },
  SHORT_1_TO_2M: { factor: 0.3, label: 'Short Period (1–2 Months — 30%)' },
  SHORT_2_TO_3M: { factor: 0.4, label: 'Short Period (2–3 Months — 40%)' },
  SHORT_3_TO_4M: { factor: 0.5, label: 'Short Period (3–4 Months — 50%)' },
  SHORT_4_TO_5M: { factor: 0.6, label: 'Short Period (4–5 Months — 60%)' },
  SHORT_5_TO_6M: { factor: 0.7, label: 'Short Period (5–6 Months — 70%)' },
  SHORT_6_TO_7M: { factor: 0.8, label: 'Short Period (6–7 Months — 80%)' },
  SHORT_7_TO_8M: { factor: 0.9, label: 'Short Period (7–8 Months — 90%)' },
};

export interface InsurerProfile {
  code: string;
  name: string;
  shortName: string;
  tiraCode: string;
  commissionRatePct: number;
  maxAutoBindSumInsuredTzs: number;
  maxVehicleAgeComprehensiveYears: number;
  requiresPhotosForComprehensive: boolean;
  supportedClasses: VehicleClass[];
  pvtRatePct: number;
  excessProtectorRatePct: number;
  windscreenRatePct: number;
  accessoriesRatePct: number;
  tagline: string;
}

const ALL_CLASSES: VehicleClass[] = [
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
];

export const SEEDED_INSURERS: InsurerProfile[] = [
  {
    code: 'MUA_TZ',
    name: 'MUA Insurance (Tanzania) Ltd',
    shortName: 'MUA Insurance',
    tiraCode: 'INS-MUA-001',
    commissionRatePct: 12.5,
    maxAutoBindSumInsuredTzs: 250_000_000,
    maxVehicleAgeComprehensiveYears: 20,
    requiresPhotosForComprehensive: false,
    supportedClasses: ALL_CLASSES,
    pvtRatePct: 0.25,
    excessProtectorRatePct: 0.25,
    windscreenRatePct: 10,
    accessoriesRatePct: 5,
    tagline: 'Direct TIRA MIS integration · Fast comprehensive & fleet bind',
  },
  {
    code: 'SANLAM_ALLIANZ_TZ',
    name: 'Sanlam Allianz General Insurance (Tanzania) Ltd',
    shortName: 'Sanlam Allianz',
    tiraCode: 'INS-SAN-002',
    commissionRatePct: 12.5,
    maxAutoBindSumInsuredTzs: 300_000_000,
    maxVehicleAgeComprehensiveYears: 18,
    requiresPhotosForComprehensive: true,
    supportedClasses: ALL_CLASSES,
    pvtRatePct: 0.25,
    excessProtectorRatePct: 0.25,
    windscreenRatePct: 10,
    accessoriesRatePct: 5,
    tagline: 'Pan-African cover · Recommended for high-value & corporate fleets',
  },
  {
    code: 'MAYFAIR_TZ',
    name: 'Mayfair Insurance Company Tanzania Ltd',
    shortName: 'Mayfair Insurance',
    tiraCode: 'INS-MAY-003',
    commissionRatePct: 12.5,
    maxAutoBindSumInsuredTzs: 200_000_000,
    maxVehicleAgeComprehensiveYears: 15,
    requiresPhotosForComprehensive: false,
    supportedClasses: ALL_CLASSES.filter((c) => !c.startsWith('OIL_TANKER')),
    pvtRatePct: 0.25,
    excessProtectorRatePct: 0.25,
    windscreenRatePct: 10,
    accessoriesRatePct: 5,
    tagline: 'Quick private motor, commercial goods & PSV issuance',
  },
  {
    code: 'NEWTAN_TZ',
    name: 'Newtan Insurance Limited',
    shortName: 'Newtan Insurance',
    tiraCode: 'INS-NEW-004',
    commissionRatePct: 12.5,
    maxAutoBindSumInsuredTzs: 250_000_000,
    maxVehicleAgeComprehensiveYears: 20,
    requiresPhotosForComprehensive: false,
    supportedClasses: ALL_CLASSES,
    pvtRatePct: 0.25,
    excessProtectorRatePct: 0.25,
    windscreenRatePct: 10,
    accessoriesRatePct: 5,
    tagline: 'Commercial logistics, oil tankers & comprehensive motor',
  },
];

export interface VehicleClassMeta {
  code: VehicleClass;
  label: string;
  group: 'PRIVATE' | 'TWO_THREE_WHEELER' | 'COMMERCIAL_GOODS' | 'PASSENGER' | 'SPECIAL';
  requiresSeats: boolean;
  requiresTonnageForTpo: boolean;
  supportsPassengerFeeToggle?: boolean;
  supportedCovers: CoverType[];
}

export const VEHICLE_CLASS_CATALOG: Record<VehicleClass, VehicleClassMeta> = {
  PRIVATE_CAR: {
    code: 'PRIVATE_CAR',
    label: 'Private Car',
    group: 'PRIVATE',
    requiresSeats: false,
    requiresTonnageForTpo: false,
    supportedCovers: ['COMPREHENSIVE', 'TPFT', 'TPO'],
  },
  MOTORCYCLE_2W: {
    code: 'MOTORCYCLE_2W',
    label: 'Motorcycle (Two Wheeler / Bodaboda)',
    group: 'TWO_THREE_WHEELER',
    requiresSeats: false,
    requiresTonnageForTpo: false,
    supportsPassengerFeeToggle: true,
    supportedCovers: ['COMPREHENSIVE', 'TPFT', 'TPO'],
  },
  THREE_WHEELER_BAJAJI: {
    code: 'THREE_WHEELER_BAJAJI',
    label: 'Three Wheeler (Bajaji)',
    group: 'TWO_THREE_WHEELER',
    requiresSeats: false,
    requiresTonnageForTpo: false,
    supportsPassengerFeeToggle: true,
    supportedCovers: ['COMPREHENSIVE', 'TPFT', 'TPO'],
  },
  COMMERCIAL_OWN_GOODS: {
    code: 'COMMERCIAL_OWN_GOODS',
    label: 'Commercial — Own Goods Carrying',
    group: 'COMMERCIAL_GOODS',
    requiresSeats: false,
    requiresTonnageForTpo: true,
    supportedCovers: ['COMPREHENSIVE', 'TPFT', 'TPO'],
  },
  COMMERCIAL_GENERAL_CARTAGE: {
    code: 'COMMERCIAL_GENERAL_CARTAGE',
    label: 'Commercial — General Cartage',
    group: 'COMMERCIAL_GOODS',
    requiresSeats: false,
    requiresTonnageForTpo: true,
    supportedCovers: ['COMPREHENSIVE', 'TPFT', 'TPO'],
  },
  TRAILER_UNDER_10Y: {
    code: 'TRAILER_UNDER_10Y',
    label: 'Trailer (Local/Dealer, < 10 Years)',
    group: 'COMMERCIAL_GOODS',
    requiresSeats: false,
    requiresTonnageForTpo: false,
    supportedCovers: ['COMPREHENSIVE', 'TPO'],
  },
  TRAILER_OVER_10Y_OR_CONVERSION: {
    code: 'TRAILER_OVER_10Y_OR_CONVERSION',
    label: 'Trailer (Conversion or > 10 Years)',
    group: 'COMMERCIAL_GOODS',
    requiresSeats: false,
    requiresTonnageForTpo: false,
    supportedCovers: ['COMPREHENSIVE', 'TPO'],
  },
  OIL_TANKER_STEEL_UNDER_10Y: {
    code: 'OIL_TANKER_STEEL_UNDER_10Y',
    label: 'Oil Tanker — Steel (< 10 Years)',
    group: 'COMMERCIAL_GOODS',
    requiresSeats: false,
    requiresTonnageForTpo: false,
    supportedCovers: ['COMPREHENSIVE', 'TPFT', 'TPO'],
  },
  OIL_TANKER_ALUMINIUM_UNDER_10Y: {
    code: 'OIL_TANKER_ALUMINIUM_UNDER_10Y',
    label: 'Oil Tanker — Aluminium (< 10 Years)',
    group: 'COMMERCIAL_GOODS',
    requiresSeats: false,
    requiresTonnageForTpo: false,
    supportedCovers: ['COMPREHENSIVE', 'TPFT', 'TPO'],
  },
  OIL_TANKER_OVER_10Y: {
    code: 'OIL_TANKER_OVER_10Y',
    label: 'Oil Tanker — Over 10 Years',
    group: 'COMMERCIAL_GOODS',
    requiresSeats: false,
    requiresTonnageForTpo: false,
    supportedCovers: ['COMPREHENSIVE', 'TPFT', 'TPO'],
  },
  PASSENGER_TAXI_PRIVATE_HIRE: {
    code: 'PASSENGER_TAXI_PRIVATE_HIRE',
    label: 'Passenger — Public Taxi, Private Hire / Tour',
    group: 'PASSENGER',
    requiresSeats: true,
    requiresTonnageForTpo: false,
    supportedCovers: ['COMPREHENSIVE', 'TPO'],
  },
  PASSENGER_BUS_DALADALA: {
    code: 'PASSENGER_BUS_DALADALA',
    label: 'Passenger — Bus (Daladala within City)',
    group: 'PASSENGER',
    requiresSeats: true,
    requiresTonnageForTpo: false,
    supportedCovers: ['COMPREHENSIVE', 'TPO'],
  },
  PASSENGER_BUS_UPCOUNTRY: {
    code: 'PASSENGER_BUS_UPCOUNTRY',
    label: 'Passenger — Bus (Up-Country)',
    group: 'PASSENGER',
    requiresSeats: true,
    requiresTonnageForTpo: false,
    supportedCovers: ['COMPREHENSIVE', 'TPO'],
  },
  PASSENGER_BUS_PRIVATE: {
    code: 'PASSENGER_BUS_PRIVATE',
    label: 'Passenger — Bus (Private)',
    group: 'PASSENGER',
    requiresSeats: true,
    requiresTonnageForTpo: false,
    supportedCovers: ['COMPREHENSIVE', 'TPO'],
  },
  PASSENGER_BUS_SCHOOL: {
    code: 'PASSENGER_BUS_SCHOOL',
    label: 'Passenger — Bus (School)',
    group: 'PASSENGER',
    requiresSeats: true,
    requiresTonnageForTpo: false,
    supportedCovers: ['COMPREHENSIVE', 'TPO'],
  },
  SPECIAL_TYPE_VEHICLE: {
    code: 'SPECIAL_TYPE_VEHICLE',
    label: 'Special Type (Tractor, Forklift, Crane, Excavator)',
    group: 'SPECIAL',
    requiresSeats: false,
    requiresTonnageForTpo: false,
    supportedCovers: ['COMPREHENSIVE', 'TPO'],
  },
};

export const COMMERCIAL_TPO_BY_TONNAGE: Record<TonnageBand, { label: string; amountTzs: number }> = {
  UP_TO_2T: { label: 'Up to 2 tonnes', amountTzs: 150_000 },
  ABOVE_2T_TO_5T: { label: 'Above 2 to 5 tonnes', amountTzs: 200_000 },
  ABOVE_5T_TO_10T: { label: 'Above 5 to 10 tonnes', amountTzs: 250_000 },
  ABOVE_10T: { label: 'In excess of 10 tonnes', amountTzs: 300_000 },
};

export interface BaseRateRule {
  claimsFreeRatePct?: number;
  withClaimRatePct?: number;
  flatTpoTzs?: number;
  tpftRatePct?: number;
  tpftBaseTppTzs?: number;
  perSeatTzs?: number;
  passengerFlatAddonTzs?: number;
  minPremiumTzs?: number;
  excess: ExcessSummary;
}

export const MRO_MOTOR_RULES: Record<VehicleClass, Partial<Record<CoverType, BaseRateRule>>> = {
  PRIVATE_CAR: {
    COMPREHENSIVE: {
      claimsFreeRatePct: 3.5,
      withClaimRatePct: 4.0,
      minPremiumTzs: 250_000,
      excess: {
        standardDescription: '5% of claim, minimum TZS 350,000',
        theftDescription: 'Double excess (10%, min TZS 700,000) in case of total theft',
        ratePct: 5,
        minTzs: 350_000,
      },
    },
    TPFT: {
      tpftRatePct: 2.0,
      tpftBaseTppTzs: 100_000,
      minPremiumTzs: 200_000,
      excess: {
        standardDescription: '5% of claim, minimum TZS 350,000',
        theftDescription: 'Double excess in case of total theft',
        ratePct: 5,
        minTzs: 350_000,
      },
    },
    TPO: {
      flatTpoTzs: 100_000,
      minPremiumTzs: 100_000,
      excess: {
        standardDescription: 'No own-damage cover (Third-party liability only)',
        theftDescription: 'Not covered under TPO',
      },
    },
  },

  MOTORCYCLE_2W: {
    COMPREHENSIVE: {
      claimsFreeRatePct: 5.0,
      withClaimRatePct: 6.0,
      passengerFlatAddonTzs: 15_000,
      minPremiumTzs: 100_000,
      excess: {
        standardDescription: '5% of claim, minimum TZS 100,000',
        theftDescription: 'Double excess in case of total theft',
        ratePct: 5,
        minTzs: 100_000,
      },
    },
    TPFT: {
      tpftRatePct: 3.5,
      tpftBaseTppTzs: 50_000,
      passengerFlatAddonTzs: 15_000,
      minPremiumTzs: 100_000,
      excess: {
        standardDescription: '5% of claim, minimum TZS 100,000',
        theftDescription: 'Double excess in case of total theft',
        ratePct: 5,
        minTzs: 100_000,
      },
    },
    TPO: {
      flatTpoTzs: 50_000,
      passengerFlatAddonTzs: 15_000,
      minPremiumTzs: 50_000,
      excess: {
        standardDescription: 'Third-party liability only',
        theftDescription: 'Not covered under TPO',
      },
    },
  },

  THREE_WHEELER_BAJAJI: {
    COMPREHENSIVE: {
      claimsFreeRatePct: 6.0,
      withClaimRatePct: 7.0,
      passengerFlatAddonTzs: 45_000,
      minPremiumTzs: 125_000,
      excess: {
        standardDescription: '5% of claim, minimum TZS 100,000',
        theftDescription: 'Double excess in case of total theft',
        ratePct: 5,
        minTzs: 100_000,
      },
    },
    TPFT: {
      tpftRatePct: 3.5,
      tpftBaseTppTzs: 75_000,
      passengerFlatAddonTzs: 45_000,
      minPremiumTzs: 100_000,
      excess: {
        standardDescription: '5% of claim, minimum TZS 100,000',
        theftDescription: 'Double excess in case of total theft',
        ratePct: 5,
        minTzs: 100_000,
      },
    },
    TPO: {
      flatTpoTzs: 75_000,
      passengerFlatAddonTzs: 45_000,
      minPremiumTzs: 75_000,
      excess: {
        standardDescription: 'Third-party liability only',
        theftDescription: 'Not covered under TPO',
      },
    },
  },

  COMMERCIAL_OWN_GOODS: {
    COMPREHENSIVE: {
      claimsFreeRatePct: 4.25,
      withClaimRatePct: 4.75,
      minPremiumTzs: 500_000,
      excess: {
        standardDescription: '7.5% of claim, minimum TZS 500,000',
        theftDescription: '10% of claim, minimum TZS 750,000 in case of total theft',
        ratePct: 7.5,
        minTzs: 500_000,
      },
    },
    TPFT: {
      tpftRatePct: 2.5,
      minPremiumTzs: 350_000,
      excess: {
        standardDescription: '7.5% of claim, minimum TZS 500,000',
        theftDescription: '10% of claim, minimum TZS 750,000 in case of total theft',
        ratePct: 7.5,
        minTzs: 500_000,
      },
    },
    TPO: {
      minPremiumTzs: 150_000,
      excess: {
        standardDescription: 'Third-party liability only',
        theftDescription: 'Not covered under TPO',
      },
    },
  },

  COMMERCIAL_GENERAL_CARTAGE: {
    COMPREHENSIVE: {
      claimsFreeRatePct: 5.0,
      withClaimRatePct: 5.75,
      minPremiumTzs: 500_000,
      excess: {
        standardDescription: '7.5% of claim, minimum TZS 500,000',
        theftDescription: '10% of claim, minimum TZS 750,000 in case of total theft',
        ratePct: 7.5,
        minTzs: 500_000,
      },
    },
    TPFT: {
      tpftRatePct: 3.0,
      minPremiumTzs: 350_000,
      excess: {
        standardDescription: '7.5% of claim, minimum TZS 500,000',
        theftDescription: '10% of claim, minimum TZS 750,000 in case of total theft',
        ratePct: 7.5,
        minTzs: 500_000,
      },
    },
    TPO: {
      minPremiumTzs: 150_000,
      excess: {
        standardDescription: 'Third-party liability only',
        theftDescription: 'Not covered under TPO',
      },
    },
  },

  TRAILER_UNDER_10Y: {
    COMPREHENSIVE: {
      claimsFreeRatePct: 4.0,
      withClaimRatePct: 4.75,
      minPremiumTzs: 250_000,
      excess: {
        standardDescription: '15% of Sum Insured',
        theftDescription: '15% of Sum Insured',
        ratePct: 15,
      },
    },
    TPO: {
      flatTpoTzs: 100_000,
      minPremiumTzs: 100_000,
      excess: {
        standardDescription: 'Third-party liability only',
        theftDescription: 'Not covered under TPO',
      },
    },
  },

  TRAILER_OVER_10Y_OR_CONVERSION: {
    COMPREHENSIVE: {
      claimsFreeRatePct: 5.25,
      withClaimRatePct: 5.75,
      minPremiumTzs: 250_000,
      excess: {
        standardDescription: '15% of Sum Insured',
        theftDescription: '15% of Sum Insured',
        ratePct: 15,
      },
    },
    TPO: {
      flatTpoTzs: 100_000,
      minPremiumTzs: 100_000,
      excess: {
        standardDescription: 'Third-party liability only',
        theftDescription: 'Not covered under TPO',
      },
    },
  },

  OIL_TANKER_STEEL_UNDER_10Y: {
    COMPREHENSIVE: {
      claimsFreeRatePct: 6.0,
      withClaimRatePct: 6.0,
      minPremiumTzs: 2_000_000,
      excess: {
        standardDescription: '15% of Sum Insured',
        theftDescription: '15% of Sum Insured',
        ratePct: 15,
      },
    },
    TPFT: {
      tpftRatePct: 4.0,
      tpftBaseTppTzs: 750_000,
      minPremiumTzs: 1_500_000,
      excess: {
        standardDescription: '15% of Sum Insured',
        theftDescription: '15% of Sum Insured',
        ratePct: 15,
      },
    },
    TPO: {
      flatTpoTzs: 750_000,
      minPremiumTzs: 750_000,
      excess: {
        standardDescription: 'Third-party liability only',
        theftDescription: 'Not covered under TPO',
      },
    },
  },

  OIL_TANKER_ALUMINIUM_UNDER_10Y: {
    COMPREHENSIVE: {
      claimsFreeRatePct: 7.0,
      withClaimRatePct: 7.0,
      minPremiumTzs: 2_000_000,
      excess: {
        standardDescription: '15% of Sum Insured',
        theftDescription: '15% of Sum Insured',
        ratePct: 15,
      },
    },
    TPFT: {
      tpftRatePct: 4.0,
      tpftBaseTppTzs: 750_000,
      minPremiumTzs: 1_500_000,
      excess: {
        standardDescription: '15% of Sum Insured',
        theftDescription: '15% of Sum Insured',
        ratePct: 15,
      },
    },
    TPO: {
      flatTpoTzs: 750_000,
      minPremiumTzs: 750_000,
      excess: {
        standardDescription: 'Third-party liability only',
        theftDescription: 'Not covered under TPO',
      },
    },
  },

  OIL_TANKER_OVER_10Y: {
    COMPREHENSIVE: {
      claimsFreeRatePct: 8.0,
      withClaimRatePct: 8.0,
      minPremiumTzs: 2_000_000,
      excess: {
        standardDescription: '15% of Sum Insured',
        theftDescription: '15% of Sum Insured',
        ratePct: 15,
      },
    },
    TPFT: {
      tpftRatePct: 4.0,
      tpftBaseTppTzs: 750_000,
      minPremiumTzs: 1_500_000,
      excess: {
        standardDescription: '15% of Sum Insured',
        theftDescription: '15% of Sum Insured',
        ratePct: 15,
      },
    },
    TPO: {
      flatTpoTzs: 750_000,
      minPremiumTzs: 750_000,
      excess: {
        standardDescription: 'Third-party liability only',
        theftDescription: 'Not covered under TPO',
      },
    },
  },

  PASSENGER_TAXI_PRIVATE_HIRE: {
    COMPREHENSIVE: {
      claimsFreeRatePct: 5.5,
      withClaimRatePct: 6.0,
      perSeatTzs: 15_000,
      minPremiumTzs: 500_000,
      excess: {
        standardDescription: '7.5% of claim, minimum TZS 350,000',
        theftDescription: '10% of claim, minimum TZS 750,000 in case of total theft',
        ratePct: 7.5,
        minTzs: 350_000,
      },
    },
    TPO: {
      perSeatTzs: 15_000,
      minPremiumTzs: 150_000,
      excess: {
        standardDescription: 'Third-party liability only',
        theftDescription: 'Not covered under TPO',
      },
    },
  },

  PASSENGER_BUS_DALADALA: {
    COMPREHENSIVE: {
      claimsFreeRatePct: 8.0,
      withClaimRatePct: 8.0,
      perSeatTzs: 15_000,
      minPremiumTzs: 500_000,
      excess: {
        standardDescription: '10% of claim, minimum TZS 1,000,000',
        theftDescription: 'Minimum TZS 2,000,000 in case of total theft',
        ratePct: 10,
        minTzs: 1_000_000,
      },
    },
    TPO: {
      perSeatTzs: 15_000,
      minPremiumTzs: 150_000,
      excess: {
        standardDescription: 'Third-party liability only',
        theftDescription: 'Not covered under TPO',
      },
    },
  },

  PASSENGER_BUS_UPCOUNTRY: {
    COMPREHENSIVE: {
      claimsFreeRatePct: 8.0,
      withClaimRatePct: 8.0,
      perSeatTzs: 30_000,
      minPremiumTzs: 500_000,
      excess: {
        standardDescription: '10% of claim, minimum TZS 1,000,000',
        theftDescription: 'Minimum TZS 2,000,000 in case of total theft',
        ratePct: 10,
        minTzs: 1_000_000,
      },
    },
    TPO: {
      perSeatTzs: 30_000,
      minPremiumTzs: 150_000,
      excess: {
        standardDescription: 'Third-party liability only',
        theftDescription: 'Not covered under TPO',
      },
    },
  },

  PASSENGER_BUS_PRIVATE: {
    COMPREHENSIVE: {
      claimsFreeRatePct: 5.0,
      withClaimRatePct: 5.0,
      perSeatTzs: 10_000,
      minPremiumTzs: 500_000,
      excess: {
        standardDescription: '10% of claim, minimum TZS 1,000,000',
        theftDescription: 'Minimum TZS 2,000,000 in case of total theft',
        ratePct: 10,
        minTzs: 1_000_000,
      },
    },
    TPO: {
      perSeatTzs: 10_000,
      minPremiumTzs: 150_000,
      excess: {
        standardDescription: 'Third-party liability only',
        theftDescription: 'Not covered under TPO',
      },
    },
  },

  PASSENGER_BUS_SCHOOL: {
    COMPREHENSIVE: {
      claimsFreeRatePct: 5.0,
      withClaimRatePct: 5.0,
      perSeatTzs: 7_500,
      minPremiumTzs: 500_000,
      excess: {
        standardDescription: '10% of claim, minimum TZS 1,000,000',
        theftDescription: 'Minimum TZS 2,000,000 in case of total theft',
        ratePct: 10,
        minTzs: 1_000_000,
      },
    },
    TPO: {
      perSeatTzs: 7_500,
      minPremiumTzs: 150_000,
      excess: {
        standardDescription: 'Third-party liability only',
        theftDescription: 'Not covered under TPO',
      },
    },
  },

  SPECIAL_TYPE_VEHICLE: {
    COMPREHENSIVE: {
      claimsFreeRatePct: 2.0,
      withClaimRatePct: 2.0,
      minPremiumTzs: 250_000,
      excess: {
        standardDescription: '10% of claim, minimum TZS 1,000,000 each and every claim',
        theftDescription: '10% of claim, minimum TZS 1,000,000',
        ratePct: 10,
        minTzs: 1_000_000,
      },
    },
    TPO: {
      flatTpoTzs: 100_000,
      minPremiumTzs: 100_000,
      excess: {
        standardDescription: 'Third-party liability only',
        theftDescription: 'Not covered under TPO',
      },
    },
  },
};

export function getInsurerByCode(code: string): InsurerProfile | undefined {
  return SEEDED_INSURERS.find((i) => i.code === code);
}

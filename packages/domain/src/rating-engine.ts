import {
  COMMERCIAL_TPO_BY_TONNAGE,
  DEFAULT_BROKER_COMMISSION_PCT,
  getInsurerByCode,
  MRO_MOTOR_RULES,
  RATE_SCHEDULE_SOURCE,
  RATE_SCHEDULE_VERSION,
  SHORT_PERIOD_FACTORS,
  VAT_RATE_PCT,
  VEHICLE_CLASS_CATALOG,
} from './rates.js';
import type {
  AddOnsSelection,
  ClaimsFreeStatus,
  CoverDuration,
  CoverType,
  DiscountDecision,
  DiscountsSelection,
  PremiumLineItem,
  RatingCalculationResult,
  TonnageBand,
  VehicleClass,
} from './types.js';

export interface RatingInput {
  insurerCode: string;
  vehicleClass: VehicleClass;
  coverType: CoverType;
  duration?: CoverDuration;
  sumInsuredTzs?: number;
  seatCount?: number;
  tonnageBand?: TonnageBand;
  carriesPassengers2W3W?: boolean;
  manufactureYear?: number;
  claimsFreeStatus?: ClaimsFreeStatus;
  addOns?: Partial<AddOnsSelection>;
  discounts?: Partial<DiscountsSelection>;
  hasUnacceptedCorrection?: boolean;
  nowYear?: number;
}

function roundTzs(n: number): number {
  return Math.round(n);
}

export function calculateMotorPremium(input: RatingInput): RatingCalculationResult {
  const nowIso = new Date().toISOString();
  const duration: CoverDuration = input.duration ?? 'ANNUAL_12M';
  const sumInsuredTzs = input.sumInsuredTzs ?? 0;
  const claimsFree =
    input.claimsFreeStatus !== 'SELF_DECLARED_WITH_CLAIM' &&
    input.claimsFreeStatus !== 'VERIFIED_WITH_CLAIM';

  const insurer = getInsurerByCode(input.insurerCode);
  const classMeta = VEHICLE_CLASS_CATALOG[input.vehicleClass];
  const rule = MRO_MOTOR_RULES[input.vehicleClass]?.[input.coverType];

  const blockingErrors: string[] = [];
  const referralReasons: string[] = [];

  if (!insurer) {
    blockingErrors.push(`Unsupported insurer code: ${input.insurerCode}`);
  } else if (!insurer.supportedClasses.includes(input.vehicleClass)) {
    referralReasons.push(
      `${insurer.shortName} does not auto-bind ${classMeta.label}; referral required.`,
    );
  }

  if (!rule) {
    blockingErrors.push(
      `Unsupported cover combination: ${classMeta.label} + ${input.coverType}. Refer to underwriter—never price by analogy.`,
    );
  }

  if (classMeta.requiresSeats && (!input.seatCount || input.seatCount < 1)) {
    blockingErrors.push(
      `Seat count is required to price ${classMeta.label} (${input.coverType}).`,
    );
  }

  if (
    (input.coverType === 'COMPREHENSIVE' || input.coverType === 'TPFT') &&
    sumInsuredTzs <= 0
  ) {
    blockingErrors.push(`Sum insured (TZS) is required for ${input.coverType} cover.`);
  }

  if (classMeta.requiresTonnageForTpo && input.coverType === 'TPO' && !input.tonnageBand) {
    blockingErrors.push(`Tonnage band is required to price ${classMeta.label} TPO.`);
  }

  if (blockingErrors.length > 0 || !rule || !insurer) {
    return {
      priceable: false,
      referralRequired: true,
      referralReasons,
      blockingErrors,
      ruleVersion: RATE_SCHEDULE_VERSION,
      ruleSource: RATE_SCHEDULE_SOURCE,
      insurerCode: input.insurerCode,
      vehicleClass: input.vehicleClass,
      coverType: input.coverType,
      duration,
      sumInsuredTzs,
      seatCount: input.seatCount,
      basePremiumTzs: 0,
      netPremiumBeforeTaxTzs: 0,
      vatRatePct: VAT_RATE_PCT,
      vatAmountTzs: 0,
      totalPayableTzs: 0,
      lineItems: [],
      discountDecisions: [],
      excess: rule?.excess ?? {
        standardDescription: 'Pending validated rating rule',
        theftDescription: 'Pending validated rating rule',
      },
      commission: {
        commissionRatePct: insurer?.commissionRatePct ?? DEFAULT_BROKER_COMMISSION_PCT,
        brokerCommissionTzs: 0,
        vatOnCommissionPct: VAT_RATE_PCT,
        vatOnCommissionTzs: 0,
        totalCommissionReceivableTzs: 0,
        grossPayableToInsurerTzs: 0,
        insurerSettlementTzs: 0,
      },
      calculatedAt: nowIso,
    };
  }

  // Insurer referral checks (still priceable, but flagged for referral before bind)
  if (input.hasUnacceptedCorrection) {
    referralReasons.push(
      'Vehicle fact correction (use/class/seats) differs from TRA record and requires insurer/TIRA acceptance before issuance.',
    );
  }

  if (
    input.coverType === 'COMPREHENSIVE' &&
    sumInsuredTzs > insurer.maxAutoBindSumInsuredTzs
  ) {
    referralReasons.push(
      `Sum insured (TZS ${sumInsuredTzs.toLocaleString()}) exceeds ${insurer.shortName}'s auto-bind threshold (TZS ${insurer.maxAutoBindSumInsuredTzs.toLocaleString()}). Valuation/underwriter approval required.`,
    );
  }

  const currentYear = input.nowYear ?? new Date().getUTCFullYear();
  if (
    input.coverType === 'COMPREHENSIVE' &&
    input.manufactureYear &&
    currentYear - input.manufactureYear > insurer.maxVehicleAgeComprehensiveYears
  ) {
    referralReasons.push(
      `Vehicle age (${currentYear - input.manufactureYear} years) exceeds ${insurer.shortName}'s comprehensive auto-bind limit (${insurer.maxVehicleAgeComprehensiveYears} years).`,
    );
  }

  const lineItems: PremiumLineItem[] = [];
  let odPremiumTzs = 0;
  let seatOrPassengerTzs = 0;
  let baseTotalBeforeMin = 0;

  // 1. Base Premium & Seat / Passenger Charges
  if (input.coverType === 'COMPREHENSIVE') {
    const ratePct = claimsFree
      ? (rule.claimsFreeRatePct ?? 0)
      : (rule.withClaimRatePct ?? rule.claimsFreeRatePct ?? 0);
    odPremiumTzs = roundTzs((sumInsuredTzs * ratePct) / 100);
    lineItems.push({
      code: 'BASE_OD',
      label: `Comprehensive Base (${claimsFree ? 'Claims-Free' : 'With Claim Record'})`,
      formula: `${ratePct}% × TZS ${sumInsuredTzs.toLocaleString()}`,
      amountTzs: odPremiumTzs,
      category: 'BASE',
    });

    if (rule.perSeatTzs && input.seatCount) {
      seatOrPassengerTzs = roundTzs(rule.perSeatTzs * input.seatCount);
      lineItems.push({
        code: 'PER_SEAT',
        label: `Passenger Seating Charge (${input.seatCount} seats)`,
        formula: `${input.seatCount} seats × TZS ${rule.perSeatTzs.toLocaleString()}`,
        amountTzs: seatOrPassengerTzs,
        category: 'SEAT_OR_PASSENGER',
      });
    }

    if (rule.passengerFlatAddonTzs && input.carriesPassengers2W3W) {
      seatOrPassengerTzs += rule.passengerFlatAddonTzs;
      lineItems.push({
        code: 'PASSENGER_2W_3W',
        label: 'Passenger Carrying Extension (Bodaboda / Bajaji)',
        formula: `Flat TZS ${rule.passengerFlatAddonTzs.toLocaleString()}`,
        amountTzs: rule.passengerFlatAddonTzs,
        category: 'SEAT_OR_PASSENGER',
      });
    }

    baseTotalBeforeMin = odPremiumTzs + seatOrPassengerTzs;
  } else if (input.coverType === 'TPFT') {
    const tpftRate = rule.tpftRatePct ?? 0;
    odPremiumTzs = roundTzs((sumInsuredTzs * tpftRate) / 100);
    lineItems.push({
      code: 'TPFT_RATE',
      label: 'Third Party Fire & Theft Rate',
      formula: `${tpftRate}% × TZS ${sumInsuredTzs.toLocaleString()}`,
      amountTzs: odPremiumTzs,
      category: 'BASE',
    });

    const tppComponent =
      classMeta.requiresTonnageForTpo && input.tonnageBand
        ? COMMERCIAL_TPO_BY_TONNAGE[input.tonnageBand].amountTzs
        : (rule.tpftBaseTppTzs ?? 100_000);

    lineItems.push({
      code: 'TPFT_TPP',
      label: 'Third Party Liability Base (TPP)',
      formula: `Flat TZS ${tppComponent.toLocaleString()}`,
      amountTzs: tppComponent,
      category: 'BASE',
    });

    if (rule.passengerFlatAddonTzs && input.carriesPassengers2W3W) {
      seatOrPassengerTzs += rule.passengerFlatAddonTzs;
      lineItems.push({
        code: 'PASSENGER_2W_3W',
        label: 'Passenger Carrying Extension (Bodaboda / Bajaji)',
        formula: `Flat TZS ${rule.passengerFlatAddonTzs.toLocaleString()}`,
        amountTzs: rule.passengerFlatAddonTzs,
        category: 'SEAT_OR_PASSENGER',
      });
    }

    baseTotalBeforeMin = odPremiumTzs + tppComponent + seatOrPassengerTzs;
  } else {
    // TPO
    if (classMeta.requiresTonnageForTpo && input.tonnageBand) {
      const band = COMMERCIAL_TPO_BY_TONNAGE[input.tonnageBand];
      baseTotalBeforeMin = band.amountTzs;
      lineItems.push({
        code: 'TPO_TONNAGE',
        label: `Commercial TPO (${band.label})`,
        formula: `Flat TZS ${band.amountTzs.toLocaleString()}`,
        amountTzs: band.amountTzs,
        category: 'BASE',
      });
    } else if (rule.perSeatTzs && input.seatCount) {
      seatOrPassengerTzs = roundTzs(rule.perSeatTzs * input.seatCount);
      baseTotalBeforeMin = seatOrPassengerTzs;
      lineItems.push({
        code: 'TPO_PER_SEAT',
        label: `Passenger TPO (${input.seatCount} seats)`,
        formula: `${input.seatCount} seats × TZS ${rule.perSeatTzs.toLocaleString()}`,
        amountTzs: seatOrPassengerTzs,
        category: 'SEAT_OR_PASSENGER',
      });
    } else {
      const flat = rule.flatTpoTzs ?? 100_000;
      baseTotalBeforeMin = flat;
      lineItems.push({
        code: 'TPO_FLAT',
        label: `Third Party Only (${classMeta.label})`,
        formula: `Flat TZS ${flat.toLocaleString()}`,
        amountTzs: flat,
        category: 'BASE',
      });
      if (rule.passengerFlatAddonTzs && input.carriesPassengers2W3W) {
        seatOrPassengerTzs = rule.passengerFlatAddonTzs;
        baseTotalBeforeMin += seatOrPassengerTzs;
        lineItems.push({
          code: 'PASSENGER_2W_3W',
          label: 'Passenger Carrying Extension (Bodaboda / Bajaji)',
          formula: `Flat TZS ${rule.passengerFlatAddonTzs.toLocaleString()}`,
          amountTzs: seatOrPassengerTzs,
          category: 'SEAT_OR_PASSENGER',
        });
      }
    }
  }

  // 2. Apply Documented Minimum Premium
  let runningTotal = baseTotalBeforeMin;
  if (rule.minPremiumTzs && runningTotal < rule.minPremiumTzs) {
    const uplift = rule.minPremiumTzs - runningTotal;
    runningTotal = rule.minPremiumTzs;
    lineItems.push({
      code: 'MIN_PREMIUM_ADJ',
      label: 'Minimum Premium Floor Adjustment',
      formula: `Floor TZS ${rule.minPremiumTzs.toLocaleString()}`,
      amountTzs: uplift,
      category: 'MINIMUM_ADJ',
    });
  }

  const annualBasePremiumTzs = runningTotal;

  // 3. Apply Short-Period Factor if duration < 12 months
  const shortPeriod = SHORT_PERIOD_FACTORS[duration];
  if (shortPeriod.factor < 1.0) {
    const adjusted = roundTzs(runningTotal * shortPeriod.factor);
    const delta = adjusted - runningTotal;
    runningTotal = adjusted;
    odPremiumTzs = roundTzs(odPremiumTzs * shortPeriod.factor);
    lineItems.push({
      code: 'SHORT_PERIOD',
      label: shortPeriod.label,
      formula: `${Math.round(shortPeriod.factor * 100)}% of annual base`,
      amountTzs: delta,
      category: 'SHORT_PERIOD_ADJ',
    });
  }

  // 4. Add-ons & Market Extensions (V1 #1)
  const addOns: AddOnsSelection = {
    excessBuyBack: input.addOns?.excessBuyBack ?? false,
    pvt: input.addOns?.pvt ?? false,
    excessProtector: input.addOns?.excessProtector ?? false,
    lossOfUse: input.addOns?.lossOfUse ?? false,
    geographicalExtension: input.addOns?.geographicalExtension ?? false,
    increasedTppdLimitAbove50M: input.addOns?.increasedTppdLimitAbove50M ?? 0,
    windscreenSumInsured: input.addOns?.windscreenSumInsured ?? 0,
    accessoriesSumInsured: input.addOns?.accessoriesSumInsured ?? 0,
    accessoriesDescription: input.addOns?.accessoriesDescription,
  };

  if (input.coverType === 'COMPREHENSIVE') {
    if (addOns.excessBuyBack) {
      const amt = roundTzs(odPremiumTzs * 0.1);
      runningTotal += amt;
      lineItems.push({
        code: 'ADDON_EXCESS_BUYBACK',
        label: 'Excess Buy-Back',
        formula: `10% loading on OD premium`,
        amountTzs: amt,
        category: 'ADDON',
      });
    }
    if (addOns.pvt) {
      const amt = roundTzs((sumInsuredTzs * insurer.pvtRatePct) / 100 * shortPeriod.factor);
      runningTotal += amt;
      lineItems.push({
        code: 'ADDON_PVT',
        label: 'Political Violence & Terrorism (PVT)',
        formula: `${insurer.pvtRatePct}% × Sum Insured`,
        amountTzs: amt,
        category: 'ADDON',
      });
    }
    if (addOns.excessProtector) {
      const amt = roundTzs(
        ((sumInsuredTzs * insurer.excessProtectorRatePct) / 100) * shortPeriod.factor,
      );
      runningTotal += amt;
      lineItems.push({
        code: 'ADDON_EXCESS_PROTECTOR',
        label: 'Excess Protector',
        formula: `${insurer.excessProtectorRatePct}% × Sum Insured`,
        amountTzs: amt,
        category: 'ADDON',
      });
    }
    if (addOns.lossOfUse) {
      if (input.vehicleClass === 'PRIVATE_CAR') {
        const amt = 50_000;
        runningTotal += amt;
        lineItems.push({
          code: 'ADDON_LOSS_OF_USE',
          label: 'Loss of Use (max 21 days @ TZS 50,000/day)',
          formula: 'Flat TZS 50,000 (Private Cars only)',
          amountTzs: amt,
          category: 'ADDON',
        });
      }
    }
    if (addOns.geographicalExtension) {
      const amt = roundTzs(odPremiumTzs * 0.05);
      runningTotal += amt;
      lineItems.push({
        code: 'ADDON_GEO_EXT',
        label: 'Geographical Extension (Beyond East Africa)',
        formula: '5% loading on OD premium',
        amountTzs: amt,
        category: 'ADDON',
      });
    }
    if (addOns.windscreenSumInsured > 0) {
      const amt = roundTzs((addOns.windscreenSumInsured * insurer.windscreenRatePct) / 100);
      runningTotal += amt;
      lineItems.push({
        code: 'ADDON_WINDSCREEN',
        label: 'Windscreen Cover Extension',
        formula: `${insurer.windscreenRatePct}% × TZS ${addOns.windscreenSumInsured.toLocaleString()}`,
        amountTzs: amt,
        category: 'ADDON',
      });
    }
    if (addOns.accessoriesSumInsured > 0) {
      const amt = roundTzs((addOns.accessoriesSumInsured * insurer.accessoriesRatePct) / 100);
      runningTotal += amt;
      lineItems.push({
        code: 'ADDON_ACCESSORIES',
        label: 'Vehicle Accessories Cover',
        formula: `${insurer.accessoriesRatePct}% × TZS ${addOns.accessoriesSumInsured.toLocaleString()}`,
        amountTzs: amt,
        category: 'ADDON',
      });
    }
  }

  if (addOns.increasedTppdLimitAbove50M > 0) {
    const amt = roundTzs(addOns.increasedTppdLimitAbove50M * 0.005);
    runningTotal += amt;
    lineItems.push({
      code: 'ADDON_INCREASED_TPPD',
      label: 'Increased TPPD Limit (Excess of TZS 50M)',
      formula: `0.5% × TZS ${addOns.increasedTppdLimitAbove50M.toLocaleString()}`,
      amountTzs: amt,
      category: 'ADDON',
    });
  }

  // 5. Validated Discounts (strict evidence & eligibility gates — never silent manipulation)
  const discounts = input.discounts;
  const discountDecisions: DiscountDecision[] = [];
  const preDiscountSubtotal = runningTotal;

  if (discounts?.trackingDevice?.requested) {
    if (discounts.trackingDevice.evidenceRef?.trim()) {
      const amt = roundTzs(preDiscountSubtotal * 0.05);
      runningTotal -= amt;
      discountDecisions.push({
        code: 'TRACKING_DEVICE',
        label: 'Approved Car Tracking Device Discount (5%)',
        applied: true,
        amountTzs: amt,
        reason: `Applied with tracker certificate (${discounts.trackingDevice.evidenceRef}). Notification logged for ATI Secretariat.`,
        requiresReferral: false,
      });
      lineItems.push({
        code: 'DISC_TRACKER',
        label: 'Car Tracking Device Reduction (-5%)',
        formula: `-5% of TZS ${preDiscountSubtotal.toLocaleString()}`,
        amountTzs: -amt,
        category: 'DISCOUNT',
      });
    } else {
      discountDecisions.push({
        code: 'TRACKING_DEVICE',
        label: 'Car Tracking Device Discount (5%)',
        applied: false,
        amountTzs: 0,
        reason: 'Excluded: Tracker installation certificate / evidence reference is required.',
        requiresReferral: false,
      });
    }
  }

  if (discounts?.tatoaTaboaMember?.requested) {
    if (discounts.tatoaTaboaMember.membershipApprovalRef?.trim()) {
      const amt = roundTzs(preDiscountSubtotal * 0.05);
      runningTotal -= amt;
      discountDecisions.push({
        code: 'TATOA_TABOA',
        label: 'TATOA / TABOA Members Discount (5%)',
        applied: true,
        amountTzs: amt,
        reason: `Applied with membership approval (${discounts.tatoaTaboaMember.membershipApprovalRef}).`,
        requiresReferral: false,
      });
      lineItems.push({
        code: 'DISC_TATOA_TABOA',
        label: 'TATOA / TABOA Membership Discount (-5%)',
        formula: `-5% of TZS ${preDiscountSubtotal.toLocaleString()}`,
        amountTzs: -amt,
        category: 'DISCOUNT',
      });
    } else {
      discountDecisions.push({
        code: 'TATOA_TABOA',
        label: 'TATOA / TABOA Members Discount (5%)',
        applied: false,
        amountTzs: 0,
        reason: 'Excluded: Valid TATOA/TABOA membership approval document is required.',
        requiresReferral: false,
      });
    }
  }

  if (discounts?.fleetDiscount?.requested) {
    const f = discounts.fleetDiscount;
    const eligible =
      (f.fleetSize ?? 0) > 50 &&
      (f.comprehensiveRatioPct ?? 0) >= 50 &&
      (f.claimsRatioPct ?? 100) <= 45;
    if (eligible && f.committeeApprovalRef?.trim()) {
      const amt = roundTzs(preDiscountSubtotal * 0.2);
      runningTotal -= amt;
      discountDecisions.push({
        code: 'FLEET_20',
        label: 'Fleet Rating Discount (20%)',
        applied: true,
        amountTzs: amt,
        reason: `Applied (>50 vehicles, >=50% comprehensive, <=45% claims ratio, ref ${f.committeeApprovalRef}).`,
        requiresReferral: false,
      });
      lineItems.push({
        code: 'DISC_FLEET_20',
        label: 'Fleet Discount (-20%)',
        formula: `-20% of TZS ${preDiscountSubtotal.toLocaleString()}`,
        amountTzs: -amt,
        category: 'DISCOUNT',
      });
    } else {
      const missingCriteria: string[] = [];
      if ((f.fleetSize ?? 0) <= 50) missingCriteria.push('fleet > 50 vehicles');
      if ((f.comprehensiveRatioPct ?? 0) < 50) missingCriteria.push('>= 50% comprehensive');
      if ((f.claimsRatioPct ?? 100) > 45) missingCriteria.push('claims ratio <= 45%');
      if (!f.committeeApprovalRef?.trim()) missingCriteria.push('ATI/insurer approval reference');
      discountDecisions.push({
        code: 'FLEET_20',
        label: 'Fleet Rating Discount (20%)',
        applied: false,
        amountTzs: 0,
        reason: `Excluded: Missing fleet criteria (${missingCriteria.join(', ')}).`,
        requiresReferral: true,
      });
    }
  }

  const netPremiumBeforeTaxTzs = Math.max(0, roundTzs(runningTotal));

  // 6. Taxes (18% VAT — matches observed Smart Policy MUA calculation)
  const vatAmountTzs = roundTzs((netPremiumBeforeTaxTzs * VAT_RATE_PCT) / 100);
  lineItems.push({
    code: 'VAT_18',
    label: `Value Added Tax (${VAT_RATE_PCT}%)`,
    formula: `${VAT_RATE_PCT}% × TZS ${netPremiumBeforeTaxTzs.toLocaleString()}`,
    amountTzs: vatAmountTzs,
    category: 'TAX',
  });

  const totalPayableTzs = netPremiumBeforeTaxTzs + vatAmountTzs;

  // 7. Broker Commission Receivable (TIRA Cash-and-Carry: 100% gross paid to insurer;
  //    broker invoices insurer separately for commission + 18% VAT on commission)
  const brokerCommissionTzs = roundTzs(
    (netPremiumBeforeTaxTzs * insurer.commissionRatePct) / 100,
  );
  const vatOnCommissionTzs = roundTzs((brokerCommissionTzs * VAT_RATE_PCT) / 100);
  const totalCommissionReceivableTzs = brokerCommissionTzs + vatOnCommissionTzs;
  const grossPayableToInsurerTzs = totalPayableTzs;
  const insurerSettlementTzs = totalPayableTzs - totalCommissionReceivableTzs;

  return {
    priceable: true,
    referralRequired: referralReasons.length > 0,
    referralReasons,
    blockingErrors: [],
    ruleVersion: RATE_SCHEDULE_VERSION,
    ruleSource: RATE_SCHEDULE_SOURCE,
    insurerCode: insurer.code,
    vehicleClass: input.vehicleClass,
    coverType: input.coverType,
    duration,
    sumInsuredTzs,
    seatCount: input.seatCount,
    basePremiumTzs: annualBasePremiumTzs,
    netPremiumBeforeTaxTzs,
    vatRatePct: VAT_RATE_PCT,
    vatAmountTzs,
    totalPayableTzs,
    lineItems,
    discountDecisions,
    excess: rule.excess,
    commission: {
      commissionRatePct: insurer.commissionRatePct,
      brokerCommissionTzs,
      vatOnCommissionPct: VAT_RATE_PCT,
      vatOnCommissionTzs,
      totalCommissionReceivableTzs,
      grossPayableToInsurerTzs,
      insurerSettlementTzs,
    },
    calculatedAt: nowIso,
  };
}

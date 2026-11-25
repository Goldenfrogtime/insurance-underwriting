import { describe, expect, it } from 'vitest';
import {
  calculateMotorPremium,
  canBindWithPaymentState,
  canTransition,
  evaluateIssueReadiness,
  formatPolicyStatusLabel,
  normalizePlate,
} from './index.js';

describe('@coverflow/domain — Rating Engine & V1 Acceptance Scenarios', () => {
  it('matches observed Smart Policy MUA private comprehensive math (TZS 200M & 50M)', () => {
    const res200 = calculateMotorPremium({
      insurerCode: 'MUA_TZ',
      vehicleClass: 'PRIVATE_CAR',
      coverType: 'COMPREHENSIVE',
      sumInsuredTzs: 200_000_000,
      manufactureYear: 2021,
      claimsFreeStatus: 'SELF_DECLARED_CLAIMS_FREE',
      nowYear: 2026,
    });
    expect(res200.priceable).toBe(true);
    expect(res200.referralRequired).toBe(false);
    expect(res200.netPremiumBeforeTaxTzs).toBe(7_000_000);
    expect(res200.vatAmountTzs).toBe(1_260_000);
    expect(res200.totalPayableTzs).toBe(8_260_000);
    expect(res200.commission.brokerCommissionTzs).toBe(875_000);
    expect(res200.commission.vatOnCommissionTzs).toBe(157_500);
    expect(res200.commission.totalCommissionReceivableTzs).toBe(1_032_500);
    expect(res200.commission.grossPayableToInsurerTzs).toBe(8_260_000);
    expect(res200.commission.insurerSettlementTzs).toBe(7_227_500);

    const res50 = calculateMotorPremium({
      insurerCode: 'MUA_TZ',
      vehicleClass: 'PRIVATE_CAR',
      coverType: 'COMPREHENSIVE',
      sumInsuredTzs: 50_000_000,
      manufactureYear: 2018,
      claimsFreeStatus: 'SELF_DECLARED_CLAIMS_FREE',
      nowYear: 2026,
    });
    expect(res50.netPremiumBeforeTaxTzs).toBe(1_750_000);
    expect(res50.vatAmountTzs).toBe(315_000);
    expect(res50.totalPayableTzs).toBe(2_065_000);
    expect(res50.commission.brokerCommissionTzs).toBe(218_750);
    expect(res50.commission.vatOnCommissionTzs).toBe(39_375);
    expect(res50.commission.totalCommissionReceivableTzs).toBe(258_125);
    expect(res50.commission.grossPayableToInsurerTzs).toBe(2_065_000);
    expect(res50.commission.insurerSettlementTzs).toBe(1_806_875);
  });

  it('Scenario 3: City Daladala bus cannot price until seat count is known, and recalculates on seat change', () => {
    const missingSeats = calculateMotorPremium({
      insurerCode: 'MUA_TZ',
      vehicleClass: 'PASSENGER_BUS_DALADALA',
      coverType: 'COMPREHENSIVE',
      sumInsuredTzs: 40_000_000,
    });
    expect(missingSeats.priceable).toBe(false);
    expect(missingSeats.blockingErrors[0]).toMatch(/seat count/i);

    const seats28 = calculateMotorPremium({
      insurerCode: 'MUA_TZ',
      vehicleClass: 'PASSENGER_BUS_DALADALA',
      coverType: 'COMPREHENSIVE',
      sumInsuredTzs: 40_000_000,
      seatCount: 28,
    });
    // 8% * 40M = 3,200,000 + (28 * 15,000 = 420,000) = 3,620,000
    expect(seats28.priceable).toBe(true);
    expect(seats28.netPremiumBeforeTaxTzs).toBe(3_620_000);

    const seats32 = calculateMotorPremium({
      insurerCode: 'MUA_TZ',
      vehicleClass: 'PASSENGER_BUS_DALADALA',
      coverType: 'COMPREHENSIVE',
      sumInsuredTzs: 40_000_000,
      seatCount: 32,
    });
    expect(seats32.netPremiumBeforeTaxTzs).toBe(3_680_000);
    expect(seats32.totalPayableTzs).toBeGreaterThan(seats28.totalPayableTzs);
  });

  it('Scenario 4: Unaccepted vehicle correction triggers referral and blocks issue readiness', () => {
    const calc = calculateMotorPremium({
      insurerCode: 'MUA_TZ',
      vehicleClass: 'PRIVATE_CAR',
      coverType: 'COMPREHENSIVE',
      sumInsuredTzs: 30_000_000,
      hasUnacceptedCorrection: true,
    });
    expect(calc.priceable).toBe(true);
    expect(calc.referralRequired).toBe(true);
    expect(calc.referralReasons[0]).toMatch(/correction/i);

    const readiness = evaluateIssueReadiness({
      hasCustomerName: true,
      hasContactRoute: true,
      hasIdentityNumber: true,
      ownerRelationshipConfirmed: true,
      proposalAccepted: true,
      hasUnacceptedCorrection: true,
      hasPendingReferral: false,
      proposedStartDate: '2026-11-22',
      requiresPhotos: false,
      photoCount: 0,
    });
    expect(readiness.ready).toBe(false);
    expect(readiness.blockers[0]).toMatch(/correction/i);
  });

  it('Scenario 5: Undocumented or ineligible discount is excluded with explicit reason', () => {
    const res = calculateMotorPremium({
      insurerCode: 'MUA_TZ',
      vehicleClass: 'PRIVATE_CAR',
      coverType: 'COMPREHENSIVE',
      sumInsuredTzs: 20_000_000,
      discounts: {
        trackingDevice: { requested: true, evidenceRef: '' },
        tatoaTaboaMember: { requested: true },
        fleetDiscount: { requested: true, fleetSize: 12 },
      },
    });
    expect(res.priceable).toBe(true);
    expect(res.netPremiumBeforeTaxTzs).toBe(700_000); // 3.5% of 20M, zero discounts applied
    expect(res.discountDecisions).toHaveLength(3);
    expect(res.discountDecisions.every((d) => !d.applied)).toBe(true);
    expect(res.discountDecisions[0].reason).toMatch(/evidence/i);

    const withEvidence = calculateMotorPremium({
      insurerCode: 'MUA_TZ',
      vehicleClass: 'PRIVATE_CAR',
      coverType: 'COMPREHENSIVE',
      sumInsuredTzs: 20_000_000,
      discounts: {
        trackingDevice: { requested: true, evidenceRef: 'TRK-TZ-99102' },
      },
    });
    expect(withEvidence.netPremiumBeforeTaxTzs).toBe(665_000); // 700,000 - 5%
    expect(withEvidence.discountDecisions[0].applied).toBe(true);
  });

  it('Scenario 2: Active TIRA cover blocks overlapping start date but allows future-dated renewal', () => {
    const activeCover = {
      status: 'ACTIVE_COVER_FOUND' as const,
      tiraCode: '2205',
      message: 'Active cover expires on 2027-07-05',
      expiryDate: '2027-07-05',
      suggestedStartDate: '2027-07-06',
      checkedAt: '2026-11-21T12:00:00Z',
    };

    const overlapping = evaluateIssueReadiness({
      hasCustomerName: true,
      hasContactRoute: true,
      hasIdentityNumber: true,
      ownerRelationshipConfirmed: true,
      proposalAccepted: true,
      hasUnacceptedCorrection: false,
      hasPendingReferral: false,
      proposedStartDate: '2026-11-22',
      activeCover,
      requiresPhotos: false,
      photoCount: 0,
    });
    expect(overlapping.ready).toBe(false);
    expect(overlapping.blockers[0]).toMatch(/overlaps active TIRA cover/i);

    const futureDated = evaluateIssueReadiness({
      hasCustomerName: true,
      hasContactRoute: true,
      hasIdentityNumber: true,
      ownerRelationshipConfirmed: true,
      proposalAccepted: true,
      hasUnacceptedCorrection: false,
      hasPendingReferral: false,
      proposedStartDate: '2027-07-06',
      activeCover,
      requiresPhotos: false,
      photoCount: 0,
    });
    expect(futureDated.ready).toBe(true);
  });

  it('Scenario 7 & 8: Payment clearance guard & strict state labels prevent false issuance', () => {
    expect(canBindWithPaymentState('PENDING').allowed).toBe(false);
    expect(canBindWithPaymentState('REVERSED').allowed).toBe(false);
    expect(canBindWithPaymentState('UNAVAILABLE').allowed).toBe(false);
    expect(canBindWithPaymentState('CONFIRMED').allowed).toBe(true);

    expect(canTransition('QUOTED', 'ISSUED')).toBe(false);
    expect(canTransition('PAYMENT_PENDING', 'ISSUED')).toBe(false);
    expect(canTransition('PAYMENT_CONFIRMED', 'SUBMITTING_TIRA')).toBe(true);
    expect(formatPolicyStatusLabel('QUOTED')).toContain('Not Issued');
  });

  it('supports V1 #1-#3 add-ons (PVT, Excess Protector, Loss of Use, Windscreen) and Short-Period cover', () => {
    const res = calculateMotorPremium({
      insurerCode: 'MUA_TZ',
      vehicleClass: 'PRIVATE_CAR',
      coverType: 'COMPREHENSIVE',
      duration: 'SHORT_3_TO_4M', // 50% of annual
      sumInsuredTzs: 40_000_000, // annual base 1,400,000 -> short period 700,000
      addOns: {
        pvt: true, // 0.25% * 40M * 0.5 = 50,000
        excessProtector: true, // 0.25% * 40M * 0.5 = 50,000
        lossOfUse: true, // flat 50,000
        windscreenSumInsured: 1_000_000, // 10% = 100,000
      },
    });
    expect(res.priceable).toBe(true);
    expect(res.netPremiumBeforeTaxTzs).toBe(950_000);
    expect(res.vatAmountTzs).toBe(171_000);
    expect(res.totalPayableTzs).toBe(1_121_000);
  });

  it('blocks unsupported class+cover combination (never prices by analogy)', () => {
    const res = calculateMotorPremium({
      insurerCode: 'MUA_TZ',
      vehicleClass: 'PASSENGER_BUS_DALADALA',
      coverType: 'TPFT',
      sumInsuredTzs: 30_000_000,
      seatCount: 28,
    });
    expect(res.priceable).toBe(false);
    expect(res.blockingErrors[0]).toMatch(/unsupported cover combination/i);
  });

  it('normalizes Tanzanian plates cleanly', () => {
    expect(normalizePlate('t 999 ecs')).toBe('T999ECS');
    expect(normalizePlate('MC-204 BDA')).toBe('MC204BDA');
  });
});

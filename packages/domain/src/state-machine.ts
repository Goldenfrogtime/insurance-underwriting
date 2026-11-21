import type { ActiveCoverStatus, PaymentState, PolicyState } from './types.js';

const ALLOWED_TRANSITIONS: Record<PolicyState, PolicyState[]> = {
  DRAFT: ['LOOKUP_COMPLETE', 'CANCELLED'],
  LOOKUP_COMPLETE: ['QUOTED', 'REFERRED', 'CANCELLED'],
  QUOTED: ['QUOTED', 'REFERRED', 'ISSUE_READY', 'CANCELLED'],
  REFERRED: ['QUOTED', 'DECLINED', 'CANCELLED'],
  DECLINED: ['DRAFT', 'CANCELLED'],
  ISSUE_READY: ['PAYMENT_PENDING', 'QUOTED', 'REFERRED', 'CANCELLED'],
  PAYMENT_PENDING: ['PAYMENT_CONFIRMED', 'PAYMENT_REVERSED', 'ISSUE_READY', 'CANCELLED'],
  PAYMENT_REVERSED: ['ISSUE_READY', 'PAYMENT_PENDING', 'CANCELLED'],
  PAYMENT_CONFIRMED: ['SUBMITTING_TIRA', 'CANCELLED'],
  SUBMITTING_TIRA: ['ISSUED', 'TIRA_REJECTED'],
  TIRA_REJECTED: ['ISSUE_READY', 'SUBMITTING_TIRA', 'CANCELLED'],
  ISSUED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['CANCELLED'],
  CANCELLED: [],
};

export function canTransition(from: PolicyState, to: PolicyState): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: PolicyState, to: PolicyState): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid policy state transition: ${from} -> ${to}`);
  }
}

export interface IssueReadinessCheckInput {
  hasCustomerName: boolean;
  hasContactRoute: boolean; // phone or email
  hasIdentityNumber: boolean; // NIDA or TIN
  ownerRelationshipConfirmed: boolean;
  proposalAccepted: boolean;
  hasUnacceptedCorrection: boolean;
  hasPendingReferral: boolean;
  proposedStartDate: string; // YYYY-MM-DD
  activeCover?: ActiveCoverStatus;
  requiresPhotos: boolean;
  photoCount: number;
}

export interface IssueReadinessResult {
  ready: boolean;
  blockers: string[];
}

export function evaluateIssueReadiness(input: IssueReadinessCheckInput): IssueReadinessResult {
  const blockers: string[] = [];

  if (!input.hasCustomerName) blockers.push('Customer full name is required before issuance.');
  if (!input.hasContactRoute) blockers.push('Customer phone number or email is required.');
  if (!input.hasIdentityNumber)
    blockers.push('Valid KYC ID (NIDA, TIN, or Passport) is required before issuance.');
  if (!input.ownerRelationshipConfirmed)
    blockers.push('Confirm whether insured is the registered vehicle owner.');
  if (!input.proposalAccepted)
    blockers.push('AML/CFT digital proposal declaration must be signed/accepted.');
  if (input.hasUnacceptedCorrection)
    blockers.push(
      'Vehicle fact correction (use/class/seats) has not been accepted by the insurer/TIRA.',
    );
  if (input.hasPendingReferral)
    blockers.push('Quote has pending underwriter referral reasons that must be cleared.');

  if (
    input.activeCover?.status === 'ACTIVE_COVER_FOUND' &&
    input.activeCover.expiryDate &&
    input.proposedStartDate <= input.activeCover.expiryDate
  ) {
    blockers.push(
      `Proposed start date (${input.proposedStartDate}) overlaps active TIRA cover expiring on ${input.activeCover.expiryDate}. Set start date to ${input.activeCover.suggestedStartDate ?? 'after expiry'}.`,
    );
  }

  if (input.activeCover?.status === 'LOOKUP_UNAVAILABLE') {
    blockers.push(
      'Active cover check with TIRA MIS was unavailable. Retry lookup before binding.',
    );
  }

  if (input.requiresPhotos && input.photoCount < 4) {
    blockers.push(
      'Selected insurer requires at least 4 pre-cover inspection photos for Comprehensive issuance.',
    );
  }

  return {
    ready: blockers.length === 0,
    blockers,
  };
}

export function canBindWithPaymentState(paymentState: PaymentState): {
  allowed: boolean;
  reason?: string;
} {
  if (paymentState === 'CONFIRMED') {
    return { allowed: true };
  }
  switch (paymentState) {
    case 'NOT_INITIATED':
      return { allowed: false, reason: 'Payment has not been initiated yet.' };
    case 'PENDING':
      return {
        allowed: false,
        reason: 'Payment is still pending authoritative confirmation from insurer/gateway.',
      };
    case 'REVERSED':
      return {
        allowed: false,
        reason: 'Payment was reversed. A new confirmed payment is required before binding.',
      };
    case 'UNAVAILABLE':
      return {
        allowed: false,
        reason:
          'Payment clearance service is temporarily unavailable. Do not mark cover as issued.',
      };
  }
}

export function formatPolicyStatusLabel(state: PolicyState): string {
  const labels: Record<PolicyState, string> = {
    DRAFT: 'Draft',
    LOOKUP_COMPLETE: 'Vehicle Verified',
    QUOTED: 'Quoted (Not Issued)',
    REFERRED: 'Referred to Underwriter',
    DECLINED: 'Declined',
    ISSUE_READY: 'Ready for Payment',
    PAYMENT_PENDING: 'Awaiting Payment Confirmation',
    PAYMENT_CONFIRMED: 'Payment Confirmed — Ready to Bind',
    PAYMENT_REVERSED: 'Payment Reversed',
    SUBMITTING_TIRA: 'Submitting to TIRA MIS',
    TIRA_REJECTED: 'TIRA Rejected — Action Needed',
    ISSUED: 'Cover Issued (TIRA Verified)',
    DELIVERED: 'Issued & Delivered',
    CANCELLED: 'Cancelled',
  };
  return labels[state];
}

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { z } from 'zod';
import {
  AddOnsSelectionSchema,
  calculateMotorPremium,
  canBindWithPaymentState,
  ClaimsFreeStatusSchema,
  COMMERCIAL_TPO_BY_TONNAGE,
  computeEndDateIso,
  CoverDurationSchema,
  CoverTypeSchema,
  DiscountsSelectionSchema,
  evaluateIssueReadiness,
  formatPolicyStatusLabel,
  getInsurerByCode,
  normalizePlate,
  PaymentMethodSchema,
  PaymentStateSchema,
  RATE_SCHEDULE_SOURCE,
  RATE_SCHEDULE_VERSION,
  SEEDED_INSURERS,
  SHORT_PERIOD_FACTORS,
  TonnageBandSchema,
  VEHICLE_CLASS_CATALOG,
  VehicleClassSchema,
  type ActiveCoverStatus,
  type EcosystemPolicyVerification,
  type PolicyState,
  type RatingCalculationResult,
  type VehicleClass,
} from '@coverflow/domain';
import {
  createMockAdapterRegistry,
  MOCK_PLATE_SCENARIOS,
} from '@coverflow/adapters';
import { prisma } from './db.js';
import { seedDatabase } from './seed.js';
import { generateCoverNotePdf, generateQuoteDocumentPdf } from './documents.js';
import { registerUatModule } from './uat.js';

const app = Fastify({ logger: true, trustProxy: true, bodyLimit: 15 * 1024 * 1024 });
const adapters = createMockAdapterRegistry();

await app.register(cors, { origin: true, credentials: true });
await registerUatModule(app);

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

async function recordAudit(params: {
  quoteId: string;
  actor: string;
  eventType: string;
  fromState?: string;
  toState?: string;
  details?: Record<string, unknown>;
}) {
  await prisma.auditEvent.create({
    data: {
      quoteId: params.quoteId,
      actor: params.actor,
      eventType: params.eventType,
      fromState: params.fromState,
      toState: params.toState,
      details: JSON.stringify(params.details ?? {}),
    },
  });
}

async function recalculateQuoteTotals(quoteId: string) {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      items: {
        where: { isActive: true },
        include: { corrections: true },
      },
    },
  });
  if (!quote) return null;

  let totalNet = 0;
  let totalVat = 0;
  let totalPayable = 0;
  let totalComm = 0;
  let totalVatComm = 0;
  let totalSettlement = 0;
  let anyPendingReferral = false;

  for (const item of quote.items) {
    const calc = JSON.parse(item.calculationResultJson || '{}') as Partial<RatingCalculationResult>;
    totalNet += item.netPremiumTzs;
    totalVat += item.vatAmountTzs;
    totalPayable += item.totalPayableTzs;
    totalComm += calc.commission?.brokerCommissionTzs ?? 0;
    totalVatComm += calc.commission?.vatOnCommissionTzs ?? 0;
    totalSettlement += calc.commission?.insurerSettlementTzs ?? 0;
    const hasPendingCorr = item.corrections.some((c) => c.status === 'PENDING_INSURER_ACCEPTANCE');
    if ((item.referralRequired && !item.referralApproved) || hasPendingCorr) {
      anyPendingReferral = true;
    }
  }

  const nextStatus: PolicyState =
    quote.status === 'ISSUED' || quote.status === 'DELIVERED' || quote.status === 'CANCELLED'
      ? (quote.status as PolicyState)
      : anyPendingReferral
        ? 'REFERRED'
        : quote.items.length > 0
          ? 'QUOTED'
          : 'DRAFT';

  return prisma.quote.update({
    where: { id: quoteId },
    data: {
      totalNetPremiumTzs: totalNet,
      totalVatTzs: totalVat,
      totalPayableTzs: totalPayable,
      totalBrokerCommissionTzs: totalComm,
      totalVatOnCommissionTzs: totalVatComm,
      totalInsurerSettlementTzs: totalSettlement,
      status: nextStatus,
    },
  });
}

async function hydrateQuote(quoteId: string) {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      customer: true,
      items: {
        where: { isActive: true },
        include: { vehicle: true, corrections: true },
        orderBy: { createdAt: 'asc' },
      },
      payments: { orderBy: { createdAt: 'desc' } },
      preCoverPhotos: { orderBy: { capturedAt: 'desc' } },
      policies: { include: { vehicle: true, customer: true } },
      tiraLogs: { orderBy: { createdAt: 'desc' } },
      auditEvents: { orderBy: { createdAt: 'desc' }, take: 30 },
    },
  });
  if (!quote) return null;

  const insurer = getInsurerByCode(quote.insurerCode);
  const hasUnacceptedCorrection = quote.items.some((i) =>
    i.corrections.some((c) => c.status === 'PENDING_INSURER_ACCEPTANCE'),
  );
  const hasPendingReferral = quote.items.some((i) => i.referralRequired && !i.referralApproved);

  // Evaluate readiness across all active items
  const allBlockers: string[] = [];
  if (quote.items.length === 0) {
    allBlockers.push('Add at least one vehicle to this quote.');
  }

  for (const item of quote.items) {
    const activeCover = JSON.parse(item.activeCoverJson || '{}') as ActiveCoverStatus;
    const res = evaluateIssueReadiness({
      hasCustomerName: Boolean(quote.customer?.fullName?.trim()),
      hasContactRoute: Boolean(quote.customer?.phone?.trim() || quote.customer?.email?.trim()),
      hasIdentityNumber: Boolean(quote.customer?.idNumber?.trim()),
      ownerRelationshipConfirmed: quote.ownerRelationshipConfirmed,
      proposalAccepted: quote.proposalAccepted,
      hasUnacceptedCorrection,
      hasPendingReferral,
      proposedStartDate: item.startDate,
      activeCover: activeCover.status ? activeCover : undefined,
      requiresPhotos:
        Boolean(insurer?.requiresPhotosForComprehensive) && item.coverType === 'COMPREHENSIVE',
      photoCount: quote.preCoverPhotos.filter((p) => p.plate === item.vehicle.normalizedPlate)
        .length,
    });
    for (const b of res.blockers) {
      if (!allBlockers.includes(b)) allBlockers.push(b);
    }
  }

  return {
    ...quote,
    statusLabel: formatPolicyStatusLabel(quote.status as PolicyState),
    insurer,
    readiness: {
      issueReady: allBlockers.length === 0,
      blockers: allBlockers,
    },
    items: quote.items.map((item) => ({
      ...item,
      addOns: JSON.parse(item.addOnsJson || '{}'),
      discounts: JSON.parse(item.discountsJson || '{}'),
      activeCover: JSON.parse(item.activeCoverJson || '{}'),
      calculation: JSON.parse(item.calculationResultJson || '{}'),
    })),
  };
}

// ---------------------------------------------------------------------------
// 1. Health & Catalog Metadata
// ---------------------------------------------------------------------------
app.get('/api/v1/health', async () => ({
  status: 'ok',
  service: 'CoverFlow Underwriting API',
  ruleVersion: RATE_SCHEDULE_VERSION,
  timestamp: new Date().toISOString(),
}));

app.get('/api/v1/meta/catalog', async () => ({
  ruleVersion: RATE_SCHEDULE_VERSION,
  ruleSource: RATE_SCHEDULE_SOURCE,
  insurers: SEEDED_INSURERS,
  vehicleClasses: Object.values(VEHICLE_CLASS_CATALOG),
  durations: Object.entries(SHORT_PERIOD_FACTORS).map(([code, meta]) => ({
    code,
    ...meta,
  })),
  tonnageBands: Object.entries(COMMERCIAL_TPO_BY_TONNAGE).map(([code, meta]) => ({
    code,
    ...meta,
  })),
  samplePlates: MOCK_PLATE_SCENARIOS.map((s) => ({
    plate: s.plate,
    label: s.label,
    description: s.scenarioDescription,
    suggestedClass: s.vehicle.suggestedClass,
    hasActiveCover: Boolean(s.activeCover),
  })),
}));

// ---------------------------------------------------------------------------
// 2. Plate Lookup (Parallel TRA + TIRA MIS + Valuation + ClaimFlow History)
// ---------------------------------------------------------------------------
app.post('/api/v1/lookup/plate', async (request, reply) => {
  const body = z
    .object({
      plate: z.string().min(2),
    })
    .safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({ error: 'Registration number is required.' });
  }

  const normalized = normalizePlate(body.data.plate);

  const [traResult, tiraActiveCover, priorClaims, existingPolicy] = await Promise.all([
    adapters.tra.lookupByPlate(body.data.plate),
    adapters.tira.checkActiveCover(body.data.plate),
    prisma.claimsFeedbackRecord.findMany({
      where: { normalizedPlate: normalized },
      orderBy: { lossDate: 'desc' },
    }),
    prisma.policy.findFirst({
      where: { vehicle: { normalizedPlate: normalized }, status: { in: ['ISSUED', 'DELIVERED'] } },
      include: { customer: true, vehicle: true },
      orderBy: { issuedAt: 'desc' },
    }),
  ]);

  let valuation = null;
  let matchedCustomer = null;

  if (traResult.ok && traResult.vehicle) {
    valuation = await adapters.valuation.estimateMarketValue({
      make: traResult.vehicle.make,
      model: traResult.vehicle.model,
      manufactureYear: traResult.vehicle.manufactureYear,
      vehicleClass: traResult.vehicle.suggestedClass,
    });

    // Upsert canonical Vehicle record
    await prisma.vehicle.upsert({
      where: { normalizedPlate: traResult.vehicle.normalizedPlate },
      create: {
        normalizedPlate: traResult.vehicle.normalizedPlate,
        enteredPlate: traResult.vehicle.enteredPlate,
        chassisNo: traResult.vehicle.chassisNo,
        engineNo: traResult.vehicle.engineNo,
        make: traResult.vehicle.make,
        model: traResult.vehicle.model,
        modelNumber: traResult.vehicle.modelNumber,
        bodyType: traResult.vehicle.bodyType,
        manufactureYear: traResult.vehicle.manufactureYear,
        fuelType: traResult.vehicle.fuelType,
        color: traResult.vehicle.color,
        cc: traResult.vehicle.cc,
        seats: traResult.vehicle.seats,
        grossWeightKg: traResult.vehicle.grossWeightKg,
        tareWeightKg: traResult.vehicle.tareWeightKg,
        axles: traResult.vehicle.axles,
        registeredOwnerName: traResult.vehicle.registeredOwnerName,
        registeredUsage: traResult.vehicle.registeredUsage,
        suggestedClass: traResult.vehicle.suggestedClass,
        source: traResult.vehicle.source,
        traRawSnapshot: JSON.stringify(traResult.vehicle),
      },
      update: {
        enteredPlate: traResult.vehicle.enteredPlate,
        traFetchedAt: new Date(),
        traRawSnapshot: JSON.stringify(traResult.vehicle),
      },
    });

    matchedCustomer = await prisma.customer.findFirst({
      where: {
        fullName: traResult.vehicle.registeredOwnerName,
      },
    });
  }

  // If we issued a policy locally on CoverFlow for this plate, also surface it as active cover
  let effectiveActiveCover: ActiveCoverStatus = tiraActiveCover;
  if (
    effectiveActiveCover.status === 'NO_ACTIVE_COVER' &&
    existingPolicy &&
    existingPolicy.endDate >= todayIso()
  ) {
    const nextDay = new Date(`${existingPolicy.endDate}T00:00:00Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    effectiveActiveCover = {
      status: 'ACTIVE_COVER_FOUND',
      tiraCode: '2205',
      message: `2205-Active cover issued on CoverFlow (${existingPolicy.coverNoteNo}), expires on ${existingPolicy.endDate}.`,
      existingInsurer: getInsurerByCode(existingPolicy.insurerCode)?.name ?? existingPolicy.insurerCode,
      existingCoverNoteNo: existingPolicy.coverNoteNo,
      existingStickerNo: existingPolicy.stickerNo,
      expiryDate: existingPolicy.endDate,
      suggestedStartDate: nextDay.toISOString().slice(0, 10),
      checkedAt: new Date().toISOString(),
    };
  }

  return {
    normalizedPlate: normalized,
    tra: traResult,
    activeCover: effectiveActiveCover,
    valuation,
    matchedCustomer,
    verifiedClaimsHistory: {
      hasVerifiedClaims: priorClaims.length > 0,
      claims: priorClaims,
    },
    recommendedStartDate: effectiveActiveCover.suggestedStartDate ?? todayIso(),
  };
});

// ---------------------------------------------------------------------------
// 3. KYC Auto-Verify (NIDA / TIN)
// ---------------------------------------------------------------------------
app.post('/api/v1/lookup/kyc', async (request, reply) => {
  const body = z
    .object({
      idType: z.enum(['NIDA', 'TIN', 'PASSPORT']),
      idNumber: z.string().min(3),
    })
    .safeParse(request.body);
  if (!body.success) return reply.code(400).send({ error: 'Invalid KYC input.' });
  return adapters.kyc.verifyIdentity(body.data.idType, body.data.idNumber);
});

// ---------------------------------------------------------------------------
// 4. Live Rating Preview & Multi-Insurer Compare
// ---------------------------------------------------------------------------
const RatingPreviewSchema = z.object({
  insurerCode: z.string().optional(),
  compareAllInsurers: z.boolean().default(false),
  vehicleClass: VehicleClassSchema,
  coverType: CoverTypeSchema,
  duration: CoverDurationSchema.default('ANNUAL_12M'),
  sumInsuredTzs: z.number().min(0).default(0),
  seatCount: z.number().int().min(1).optional(),
  tonnageBand: TonnageBandSchema.optional(),
  carriesPassengers2W3W: z.boolean().default(false),
  manufactureYear: z.number().int().optional(),
  claimsFreeStatus: ClaimsFreeStatusSchema.default('SELF_DECLARED_CLAIMS_FREE'),
  addOns: AddOnsSelectionSchema.partial().optional(),
  discounts: DiscountsSelectionSchema.partial().optional(),
  hasUnacceptedCorrection: z.boolean().default(false),
});

app.post('/api/v1/rating/preview', async (request, reply) => {
  const parsed = RatingPreviewSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: 'Invalid rating inputs', details: parsed.error.flatten() });
  }
  const data = parsed.data;

  if (data.compareAllInsurers) {
    const comparisons = SEEDED_INSURERS.map((insurer) => ({
      insurer,
      calculation: calculateMotorPremium({
        ...data,
        insurerCode: insurer.code,
      }),
    }));
    return { comparisons };
  }

  const insurerCode = data.insurerCode ?? 'MUA_TZ';
  const calculation = calculateMotorPremium({
    ...data,
    insurerCode,
  });
  return {
    insurer: getInsurerByCode(insurerCode),
    calculation,
  };
});

// ---------------------------------------------------------------------------
// 5. Clients Search & Reuse (Broker Portal)
// ---------------------------------------------------------------------------
app.get('/api/v1/clients', async (request) => {
  const q = ((request.query as { q?: string }).q ?? '').trim();
  const clients = await prisma.customer.findMany({
    where: q
      ? {
          OR: [
            { fullName: { contains: q } },
            { phone: { contains: q } },
            { idNumber: { contains: q } },
          ],
        }
      : undefined,
    orderBy: { updatedAt: 'desc' },
    take: 25,
  });
  return { clients };
});

// ---------------------------------------------------------------------------
// 6. Quotes CRUD, Multi-Vehicle, Versioning & Corrections
// ---------------------------------------------------------------------------
const QuoteItemInputSchema = z.object({
  normalizedPlate: z.string().min(2),
  vehicleClass: VehicleClassSchema,
  actualUse: z.string().min(1),
  coverType: CoverTypeSchema,
  duration: CoverDurationSchema.default('ANNUAL_12M'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sumInsuredTzs: z.number().min(0).default(0),
  seatCount: z.number().int().min(1).optional(),
  tonnageBand: TonnageBandSchema.optional(),
  carriesPassengers2W3W: z.boolean().default(false),
  claimsFreeStatus: ClaimsFreeStatusSchema.default('SELF_DECLARED_CLAIMS_FREE'),
  addOns: AddOnsSelectionSchema.partial().default({}),
  discounts: DiscountsSelectionSchema.partial().default({}),
  correction: z
    .object({
      field: z.enum(['vehicleClass', 'actualUse', 'seats', 'tonnageBand']),
      fetchedValue: z.string(),
      proposedValue: z.string(),
      reason: z.string().min(3),
      evidenceFileName: z.string().optional(),
    })
    .optional(),
});

app.get('/api/v1/quotes', async (request) => {
  const channel = (request.query as { channel?: string }).channel;
  const quotes = await prisma.quote.findMany({
    where: channel ? { channel } : undefined,
    include: {
      customer: true,
      items: {
        where: { isActive: true },
        include: { vehicle: true },
      },
      payments: { orderBy: { createdAt: 'desc' }, take: 1 },
      policies: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });

  return {
    quotes: quotes.map((q) => ({
      ...q,
      statusLabel: formatPolicyStatusLabel(q.status as PolicyState),
      insurer: getInsurerByCode(q.insurerCode),
    })),
  };
});

app.get('/api/v1/quotes/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const hydrated = await hydrateQuote(id);
  if (!hydrated) return reply.code(404).send({ error: 'Quote not found' });
  return hydrated;
});

app.post('/api/v1/quotes', async (request, reply) => {
  const schema = z.object({
    channel: z.enum(['BROKER', 'CLIENT_APP']).default('BROKER'),
    brokerName: z.string().optional(),
    insurerCode: z.string().default('MUA_TZ'),
    customerId: z.string().optional(),
    quickContact: z
      .object({
        fullName: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
      })
      .optional(),
    firstLossPayee: z.string().optional(),
    item: QuoteItemInputSchema,
  });

  const parsed = schema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: 'Invalid quote payload', details: parsed.error.flatten() });
  }
  const { channel, brokerName, insurerCode, customerId, quickContact, firstLossPayee, item } =
    parsed.data;

  const normPlate = normalizePlate(item.normalizedPlate);
  let vehicle = await prisma.vehicle.findUnique({ where: { normalizedPlate: normPlate } });
  if (!vehicle) {
    const tra = await adapters.tra.lookupByPlate(normPlate);
    if (!tra.ok || !tra.vehicle) {
      return reply.code(400).send({ error: tra.errorMessage ?? 'Vehicle not found in TRA.' });
    }
    vehicle = await prisma.vehicle.create({
      data: {
        normalizedPlate: tra.vehicle.normalizedPlate,
        enteredPlate: tra.vehicle.enteredPlate,
        chassisNo: tra.vehicle.chassisNo,
        engineNo: tra.vehicle.engineNo,
        make: tra.vehicle.make,
        model: tra.vehicle.model,
        modelNumber: tra.vehicle.modelNumber,
        bodyType: tra.vehicle.bodyType,
        manufactureYear: tra.vehicle.manufactureYear,
        fuelType: tra.vehicle.fuelType,
        color: tra.vehicle.color,
        cc: tra.vehicle.cc,
        seats: tra.vehicle.seats,
        grossWeightKg: tra.vehicle.grossWeightKg,
        tareWeightKg: tra.vehicle.tareWeightKg,
        axles: tra.vehicle.axles,
        registeredOwnerName: tra.vehicle.registeredOwnerName,
        registeredUsage: tra.vehicle.registeredUsage,
        suggestedClass: tra.vehicle.suggestedClass,
        source: tra.vehicle.source,
        traRawSnapshot: JSON.stringify(tra.vehicle),
      },
    });
  }

  const activeCover = await adapters.tira.checkActiveCover(normPlate);
  const hasCorrection = Boolean(item.correction);

  const calc = calculateMotorPremium({
    insurerCode,
    vehicleClass: item.vehicleClass,
    coverType: item.coverType,
    duration: item.duration,
    sumInsuredTzs: item.sumInsuredTzs,
    seatCount: item.seatCount,
    tonnageBand: item.tonnageBand,
    carriesPassengers2W3W: item.carriesPassengers2W3W,
    manufactureYear: vehicle.manufactureYear,
    claimsFreeStatus: item.claimsFreeStatus,
    addOns: item.addOns,
    discounts: item.discounts,
    hasUnacceptedCorrection: hasCorrection,
  });

  if (!calc.priceable) {
    return reply.code(422).send({
      error: calc.blockingErrors.join(' '),
      calculation: calc,
    });
  }

  // Optional lightweight customer linking at quote stage (never forces 55-field KYC modal!)
  let resolvedCustomerId = customerId;
  if (!resolvedCustomerId && (quickContact?.phone || quickContact?.fullName)) {
    const created = await prisma.customer.create({
      data: {
        fullName: quickContact.fullName?.trim() || vehicle.registeredOwnerName,
        phone: quickContact.phone?.trim() || '',
        email: quickContact.email?.trim() || null,
      },
    });
    resolvedCustomerId = created.id;
  }

  const seqNum = 7000 + (await prisma.quote.count()) + 1;
  const quoteNumber = `CF-Q-${seqNum}`;
  const endDate = computeEndDateIso(item.startDate, item.duration);

  const createdQuote = await prisma.quote.create({
    data: {
      quoteNumber,
      channel,
      brokerName: channel === 'BROKER' ? (brokerName ?? 'Kangaroo Insurance Brokers Co Ltd') : null,
      insurerCode,
      status: calc.referralRequired ? 'REFERRED' : 'QUOTED',
      activeVersion: 1,
      customerId: resolvedCustomerId,
      firstLossPayee: firstLossPayee?.trim() || null,
      items: {
        create: {
          version: 1,
          isActive: true,
          vehicleId: vehicle.id,
          vehicleClass: item.vehicleClass,
          actualUse: item.actualUse,
          coverType: item.coverType,
          duration: item.duration,
          startDate: item.startDate,
          endDate,
          sumInsuredTzs: item.sumInsuredTzs,
          seatCount: item.seatCount ?? null,
          tonnageBand: item.tonnageBand ?? null,
          carriesPassengers2W3W: item.carriesPassengers2W3W,
          claimsFreeStatus: item.claimsFreeStatus,
          addOnsJson: JSON.stringify(item.addOns),
          discountsJson: JSON.stringify(item.discounts),
          activeCoverJson: JSON.stringify(activeCover),
          calculationResultJson: JSON.stringify(calc),
          ruleVersion: calc.ruleVersion,
          netPremiumTzs: calc.netPremiumBeforeTaxTzs,
          vatAmountTzs: calc.vatAmountTzs,
          totalPayableTzs: calc.totalPayableTzs,
          referralRequired: calc.referralRequired,
          corrections: item.correction
            ? {
                create: {
                  field: item.correction.field,
                  fetchedValue: item.correction.fetchedValue,
                  proposedValue: item.correction.proposedValue,
                  reason: item.correction.reason,
                  evidenceFileName: item.correction.evidenceFileName,
                  proposedBy: channel === 'BROKER' ? 'Broker User' : 'Client App',
                  status: 'PENDING_INSURER_ACCEPTANCE',
                },
              }
            : undefined,
        },
      },
    },
  });

  await recalculateQuoteTotals(createdQuote.id);
  await recordAudit({
    quoteId: createdQuote.id,
    actor: channel === 'BROKER' ? 'Broker' : 'Client',
    eventType: 'QUOTE_CREATED',
    fromState: 'DRAFT',
    toState: calc.referralRequired ? 'REFERRED' : 'QUOTED',
    details: {
      plate: normPlate,
      version: 1,
      totalPayableTzs: calc.totalPayableTzs,
      referralRequired: calc.referralRequired,
    },
  });

  return reply.code(201).send(await hydrateQuote(createdQuote.id));
});

// Add another vehicle to an existing quote (Multi-Vehicle support)
app.post('/api/v1/quotes/:id/items', async (request, reply) => {
  const { id } = request.params as { id: string };
  const parsed = QuoteItemInputSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: 'Invalid vehicle item', details: parsed.error.flatten() });
  }
  const quote = await prisma.quote.findUnique({ where: { id } });
  if (!quote) return reply.code(404).send({ error: 'Quote not found' });

  const item = parsed.data;
  const normPlate = normalizePlate(item.normalizedPlate);
  let vehicle = await prisma.vehicle.findUnique({ where: { normalizedPlate: normPlate } });
  if (!vehicle) {
    const tra = await adapters.tra.lookupByPlate(normPlate);
    if (!tra.ok || !tra.vehicle) {
      return reply.code(400).send({ error: tra.errorMessage ?? 'Vehicle not found in TRA.' });
    }
    vehicle = await prisma.vehicle.create({
      data: {
        normalizedPlate: tra.vehicle.normalizedPlate,
        enteredPlate: tra.vehicle.enteredPlate,
        chassisNo: tra.vehicle.chassisNo,
        engineNo: tra.vehicle.engineNo,
        make: tra.vehicle.make,
        model: tra.vehicle.model,
        modelNumber: tra.vehicle.modelNumber,
        bodyType: tra.vehicle.bodyType,
        manufactureYear: tra.vehicle.manufactureYear,
        fuelType: tra.vehicle.fuelType,
        color: tra.vehicle.color,
        cc: tra.vehicle.cc,
        seats: tra.vehicle.seats,
        grossWeightKg: tra.vehicle.grossWeightKg,
        tareWeightKg: tra.vehicle.tareWeightKg,
        axles: tra.vehicle.axles,
        registeredOwnerName: tra.vehicle.registeredOwnerName,
        registeredUsage: tra.vehicle.registeredUsage,
        suggestedClass: tra.vehicle.suggestedClass,
        source: tra.vehicle.source,
        traRawSnapshot: JSON.stringify(tra.vehicle),
      },
    });
  }

  const activeCover = await adapters.tira.checkActiveCover(normPlate);
  const calc = calculateMotorPremium({
    insurerCode: quote.insurerCode,
    vehicleClass: item.vehicleClass,
    coverType: item.coverType,
    duration: item.duration,
    sumInsuredTzs: item.sumInsuredTzs,
    seatCount: item.seatCount,
    tonnageBand: item.tonnageBand,
    carriesPassengers2W3W: item.carriesPassengers2W3W,
    manufactureYear: vehicle.manufactureYear,
    claimsFreeStatus: item.claimsFreeStatus,
    addOns: item.addOns,
    discounts: item.discounts,
    hasUnacceptedCorrection: Boolean(item.correction),
  });

  if (!calc.priceable) {
    return reply.code(422).send({ error: calc.blockingErrors.join(' '), calculation: calc });
  }

  const nextVersion = quote.activeVersion + 1;
  await prisma.quote.update({ where: { id }, data: { activeVersion: nextVersion } });

  await prisma.quoteItem.create({
    data: {
      quoteId: id,
      version: nextVersion,
      isActive: true,
      vehicleId: vehicle.id,
      vehicleClass: item.vehicleClass,
      actualUse: item.actualUse,
      coverType: item.coverType,
      duration: item.duration,
      startDate: item.startDate,
      endDate: computeEndDateIso(item.startDate, item.duration),
      sumInsuredTzs: item.sumInsuredTzs,
      seatCount: item.seatCount ?? null,
      tonnageBand: item.tonnageBand ?? null,
      carriesPassengers2W3W: item.carriesPassengers2W3W,
      claimsFreeStatus: item.claimsFreeStatus,
      addOnsJson: JSON.stringify(item.addOns),
      discountsJson: JSON.stringify(item.discounts),
      activeCoverJson: JSON.stringify(activeCover),
      calculationResultJson: JSON.stringify(calc),
      ruleVersion: calc.ruleVersion,
      netPremiumTzs: calc.netPremiumBeforeTaxTzs,
      vatAmountTzs: calc.vatAmountTzs,
      totalPayableTzs: calc.totalPayableTzs,
      referralRequired: calc.referralRequired,
    },
  });

  await recalculateQuoteTotals(id);
  await recordAudit({
    quoteId: id,
    actor: 'Broker',
    eventType: 'VEHICLE_ADDED',
    details: { plate: normPlate, version: nextVersion, totalPayableTzs: calc.totalPayableTzs },
  });

  return hydrateQuote(id);
});

// Reprice/Edit a quote item (creates new version and invalidates old calculation)
app.patch('/api/v1/quotes/:id/items/:itemId', async (request, reply) => {
  const { id, itemId } = request.params as { id: string; itemId: string };
  const existing = await prisma.quoteItem.findUnique({
    where: { id: itemId },
    include: { vehicle: true, corrections: true, quote: true },
  });
  if (!existing || existing.quoteId !== id) {
    return reply.code(404).send({ error: 'Quote item not found' });
  }

  const patchSchema = z.object({
    insurerCode: z.string().optional(),
    vehicleClass: VehicleClassSchema.optional(),
    actualUse: z.string().optional(),
    coverType: CoverTypeSchema.optional(),
    duration: CoverDurationSchema.optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    sumInsuredTzs: z.number().min(0).optional(),
    seatCount: z.number().int().min(1).nullable().optional(),
    tonnageBand: TonnageBandSchema.nullable().optional(),
    carriesPassengers2W3W: z.boolean().optional(),
    claimsFreeStatus: ClaimsFreeStatusSchema.optional(),
    addOns: AddOnsSelectionSchema.partial().optional(),
    discounts: DiscountsSelectionSchema.partial().optional(),
  });
  const parsed = patchSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid update payload' });

  const p = parsed.data;
  const insurerCode = p.insurerCode ?? existing.quote.insurerCode;
  const vehicleClass = (p.vehicleClass ?? existing.vehicleClass) as VehicleClass;
  const coverType = (p.coverType ?? existing.coverType) as 'COMPREHENSIVE' | 'TPFT' | 'TPO';
  const duration = (p.duration ?? existing.duration) as Parameters<typeof computeEndDateIso>[1];
  const startDate = p.startDate ?? existing.startDate;
  const sumInsuredTzs = p.sumInsuredTzs ?? existing.sumInsuredTzs;
  const seatCount = p.seatCount === undefined ? (existing.seatCount ?? undefined) : (p.seatCount ?? undefined);
  const tonnageBand = (p.tonnageBand === undefined ? existing.tonnageBand : p.tonnageBand) as
    | 'UP_TO_2T'
    | 'ABOVE_2T_TO_5T'
    | 'ABOVE_5T_TO_10T'
    | 'ABOVE_10T'
    | undefined;
  const carriesPassengers2W3W = p.carriesPassengers2W3W ?? existing.carriesPassengers2W3W;
  const claimsFreeStatus = (p.claimsFreeStatus ?? existing.claimsFreeStatus) as
    | 'SELF_DECLARED_CLAIMS_FREE'
    | 'SELF_DECLARED_WITH_CLAIM'
    | 'VERIFIED_CLAIMS_FREE'
    | 'VERIFIED_WITH_CLAIM';
  const addOns = p.addOns ?? JSON.parse(existing.addOnsJson || '{}');
  const discounts = p.discounts ?? JSON.parse(existing.discountsJson || '{}');

  const hasPendingCorrection = existing.corrections.some(
    (c) => c.status === 'PENDING_INSURER_ACCEPTANCE',
  );

  const calc = calculateMotorPremium({
    insurerCode,
    vehicleClass,
    coverType,
    duration,
    sumInsuredTzs,
    seatCount,
    tonnageBand,
    carriesPassengers2W3W,
    manufactureYear: existing.vehicle.manufactureYear,
    claimsFreeStatus,
    addOns,
    discounts,
    hasUnacceptedCorrection: hasPendingCorrection,
  });

  if (!calc.priceable) {
    return reply.code(422).send({ error: calc.blockingErrors.join(' '), calculation: calc });
  }

  const nextVersion = existing.quote.activeVersion + 1;
  await prisma.quote.update({
    where: { id },
    data: { activeVersion: nextVersion, insurerCode },
  });

  await prisma.quoteItem.update({
    where: { id: itemId },
    data: {
      version: nextVersion,
      vehicleClass,
      actualUse: p.actualUse ?? existing.actualUse,
      coverType,
      duration,
      startDate,
      endDate: computeEndDateIso(startDate, duration),
      sumInsuredTzs,
      seatCount: seatCount ?? null,
      tonnageBand: tonnageBand ?? null,
      carriesPassengers2W3W,
      claimsFreeStatus,
      addOnsJson: JSON.stringify(addOns),
      discountsJson: JSON.stringify(discounts),
      calculationResultJson: JSON.stringify(calc),
      ruleVersion: calc.ruleVersion,
      netPremiumTzs: calc.netPremiumBeforeTaxTzs,
      vatAmountTzs: calc.vatAmountTzs,
      totalPayableTzs: calc.totalPayableTzs,
      referralRequired: calc.referralRequired,
    },
  });

  await recalculateQuoteTotals(id);
  await recordAudit({
    quoteId: id,
    actor: 'User',
    eventType: 'QUOTE_REPRICED',
    details: {
      itemId,
      previousVersion: existing.quote.activeVersion,
      newVersion: nextVersion,
      newTotalPayableTzs: calc.totalPayableTzs,
    },
  });

  return hydrateQuote(id);
});

// Approve/Reject Vehicle Correction or Referral (Simulates Insurer Workbench in V1)
app.post('/api/v1/quotes/:id/corrections/:correctionId/decide', async (request, reply) => {
  const { id, correctionId } = request.params as { id: string; correctionId: string };
  const body = z
    .object({
      decision: z.enum(['ACCEPTED', 'REJECTED']),
      reviewer: z.string().default('Underwriter (Simulated Insurer Approval)'),
    })
    .safeParse(request.body);
  if (!body.success) return reply.code(400).send({ error: 'Invalid decision' });

  const corr = await prisma.vehicleCorrection.update({
    where: { id: correctionId },
    data: {
      status: body.data.decision,
      reviewedBy: body.data.reviewer,
      reviewedAt: new Date(),
    },
    include: { quoteItem: { include: { vehicle: true, quote: true } } },
  });

  // Re-run calculation now that correction state changed
  const item = corr.quoteItem;
  const calc = calculateMotorPremium({
    insurerCode: item.quote.insurerCode,
    vehicleClass: item.vehicleClass as VehicleClass,
    coverType: item.coverType as 'COMPREHENSIVE' | 'TPFT' | 'TPO',
    duration: item.duration as Parameters<typeof computeEndDateIso>[1],
    sumInsuredTzs: item.sumInsuredTzs,
    seatCount: item.seatCount ?? undefined,
    tonnageBand: (item.tonnageBand ?? undefined) as
      | 'UP_TO_2T'
      | 'ABOVE_2T_TO_5T'
      | 'ABOVE_5T_TO_10T'
      | 'ABOVE_10T'
      | undefined,
    carriesPassengers2W3W: item.carriesPassengers2W3W,
    manufactureYear: item.vehicle.manufactureYear,
    claimsFreeStatus: item.claimsFreeStatus as
      | 'SELF_DECLARED_CLAIMS_FREE'
      | 'SELF_DECLARED_WITH_CLAIM'
      | 'VERIFIED_CLAIMS_FREE'
      | 'VERIFIED_WITH_CLAIM',
    addOns: JSON.parse(item.addOnsJson || '{}'),
    discounts: JSON.parse(item.discountsJson || '{}'),
    hasUnacceptedCorrection: body.data.decision !== 'ACCEPTED',
  });

  await prisma.quoteItem.update({
    where: { id: item.id },
    data: {
      calculationResultJson: JSON.stringify(calc),
      referralRequired: calc.referralRequired,
      referralApproved: body.data.decision === 'ACCEPTED',
    },
  });

  await recalculateQuoteTotals(id);
  await recordAudit({
    quoteId: id,
    actor: body.data.reviewer,
    eventType: `CORRECTION_${body.data.decision}`,
    details: { correctionId, field: corr.field, proposedValue: corr.proposedValue },
  });

  return hydrateQuote(id);
});

app.post('/api/v1/quotes/:id/referral/approve', async (request, reply) => {
  const { id } = request.params as { id: string };
  await prisma.quoteItem.updateMany({
    where: { quoteId: id, isActive: true },
    data: { referralApproved: true },
  });
  await recalculateQuoteTotals(id);
  await recordAudit({
    quoteId: id,
    actor: 'Underwriter (Simulated)',
    eventType: 'REFERRAL_APPROVED',
    details: { note: 'Underwriter cleared referral conditions for V1 testing.' },
  });
  return hydrateQuote(id);
});

// ---------------------------------------------------------------------------
// 7. Progressive KYC, Owner Relationship, First Loss Payee & Proposal Sign
// ---------------------------------------------------------------------------
app.patch('/api/v1/quotes/:id/kyc-declaration', async (request, reply) => {
  const { id } = request.params as { id: string };
  const schema = z.object({
    customerId: z.string().optional(),
    fullName: z.string().min(2),
    customerType: z.enum(['INDIVIDUAL', 'CORPORATE']).default('INDIVIDUAL'),
    idType: z.enum(['NIDA', 'TIN', 'PASSPORT']).default('NIDA'),
    idNumber: z.string().min(3),
    phone: z.string().min(6),
    email: z.string().optional().nullable(),
    region: z.string().optional().nullable(),
    district: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    ownerRelationship: z.string().default('REGISTERED_OWNER'),
    ownerRelationshipConfirmed: z.boolean().default(true),
    firstLossPayee: z.string().optional().nullable(),
    proposalAccepted: z.boolean(),
    proposalSignedBy: z.string().optional(),
  });

  const parsed = schema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: 'Invalid KYC / Declaration data', details: parsed.error.flatten() });
  }
  const d = parsed.data;
  const quote = await prisma.quote.findUnique({ where: { id } });
  if (!quote) return reply.code(404).send({ error: 'Quote not found' });

  let customer;
  if (d.customerId || quote.customerId) {
    customer = await prisma.customer.update({
      where: { id: d.customerId ?? quote.customerId! },
      data: {
        fullName: d.fullName.trim(),
        customerType: d.customerType,
        idType: d.idType,
        idNumber: d.idNumber.trim(),
        phone: d.phone.trim(),
        email: d.email?.trim() || null,
        region: d.region?.trim() || null,
        district: d.district?.trim() || null,
        address: d.address?.trim() || null,
      },
    });
  } else {
    customer = await prisma.customer.create({
      data: {
        fullName: d.fullName.trim(),
        customerType: d.customerType,
        idType: d.idType,
        idNumber: d.idNumber.trim(),
        phone: d.phone.trim(),
        email: d.email?.trim() || null,
        region: d.region?.trim() || null,
        district: d.district?.trim() || null,
        address: d.address?.trim() || null,
      },
    });
  }

  await prisma.quote.update({
    where: { id },
    data: {
      customerId: customer.id,
      ownerRelationship: d.ownerRelationship,
      ownerRelationshipConfirmed: d.ownerRelationshipConfirmed,
      firstLossPayee: d.firstLossPayee?.trim() || null,
      proposalAccepted: d.proposalAccepted,
      proposalSignedBy: d.proposalAccepted ? (d.proposalSignedBy?.trim() || d.fullName.trim()) : null,
      proposalSignedAt: d.proposalAccepted ? new Date() : null,
      proposalBrokerCountersign: quote.channel === 'BROKER' ? quote.brokerName : null,
    },
  });

  const hydrated = await hydrateQuote(id);
  if (hydrated?.readiness.issueReady && quote.status === 'QUOTED') {
    await prisma.quote.update({ where: { id }, data: { status: 'ISSUE_READY' } });
  }

  await recordAudit({
    quoteId: id,
    actor: d.fullName,
    eventType: 'KYC_AND_PROPOSAL_UPDATED',
    details: { proposalAccepted: d.proposalAccepted, idType: d.idType },
  });

  return hydrateQuote(id);
});

// ---------------------------------------------------------------------------
// 8. Optional Pre-Cover Baseline Photos (ClaimFlow Handoff)
// ---------------------------------------------------------------------------
app.post('/api/v1/quotes/:id/photos', async (request, reply) => {
  const { id } = request.params as { id: string };
  const schema = z.object({
    plate: z.string().min(2),
    angle: z.enum(['FRONT', 'REAR', 'LEFT', 'RIGHT', 'ODOMETER', 'LOGBOOK']),
    dataUrl: z.string().min(10),
    consentGiven: z.boolean().default(true),
  });
  const parsed = schema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid photo payload' });

  const photo = await prisma.preCoverPhoto.create({
    data: {
      quoteId: id,
      plate: normalizePlate(parsed.data.plate),
      angle: parsed.data.angle,
      dataUrl: parsed.data.dataUrl,
      consentGiven: parsed.data.consentGiven,
    },
  });

  await recordAudit({
    quoteId: id,
    actor: 'User',
    eventType: 'PRE_COVER_PHOTO_UPLOADED',
    details: { photoId: photo.id, angle: photo.angle, plate: photo.plate },
  });

  return hydrateQuote(id);
});

// ---------------------------------------------------------------------------
// 9. Payments (Control Number + Authoritative Webhook Simulator)
// ---------------------------------------------------------------------------
app.post('/api/v1/quotes/:id/payments/initiate', async (request, reply) => {
  const { id } = request.params as { id: string };
  const parsed = z
    .object({
      method: PaymentMethodSchema.default('MOBILE_MONEY'),
      payerPhone: z.string().optional(),
    })
    .safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid payment method' });

  const hydrated = await hydrateQuote(id);
  if (!hydrated) return reply.code(404).send({ error: 'Quote not found' });

  if (!hydrated.readiness.issueReady) {
    return reply.code(422).send({
      error: 'Quote is not ready for payment/issuance yet.',
      blockers: hydrated.readiness.blockers,
    });
  }

  const init = await adapters.payment.initiatePayment({
    quoteId: hydrated.id,
    quoteNumber: hydrated.quoteNumber,
    insurerCode: hydrated.insurerCode,
    amountTzs: hydrated.totalPayableTzs,
    method: parsed.data.method,
    payerPhone: parsed.data.payerPhone ?? hydrated.customer?.phone,
    payerName: hydrated.customer?.fullName ?? 'Proposer',
  });

  const tx = await prisma.paymentTransaction.create({
    data: {
      quoteId: hydrated.id,
      controlNumber: init.controlNumber,
      providerReference: init.providerReference,
      method: parsed.data.method,
      amountTzs: hydrated.totalPayableTzs,
      payerPhone: parsed.data.payerPhone ?? hydrated.customer?.phone ?? null,
      state: init.state,
      instructions: init.instructions,
      statusMessage: 'Awaiting authoritative payment confirmation.',
      expiresAt: new Date(init.expiresAt),
    },
  });

  await prisma.quote.update({
    where: { id },
    data: { status: 'PAYMENT_PENDING' },
  });

  await recordAudit({
    quoteId: id,
    actor: 'PaymentGateway',
    eventType: 'PAYMENT_CONTROL_NUMBER_CREATED',
    fromState: hydrated.status,
    toState: 'PAYMENT_PENDING',
    details: { controlNumber: tx.controlNumber, method: tx.method, amountTzs: tx.amountTzs },
  });

  return {
    payment: tx,
    quote: await hydrateQuote(id),
  };
});

app.post('/api/v1/payments/:controlNumber/simulate', async (request, reply) => {
  const { controlNumber } = request.params as { controlNumber: string };
  const parsed = z
    .object({
      state: PaymentStateSchema,
    })
    .safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid payment state' });

  const tx = await prisma.paymentTransaction.findUnique({ where: { controlNumber } });
  if (!tx) return reply.code(404).send({ error: 'Payment transaction not found' });

  adapters.payment.setSimulatedState(controlNumber, parsed.data.state);
  const status = await adapters.payment.checkPaymentStatus(controlNumber);

  const updatedTx = await prisma.paymentTransaction.update({
    where: { controlNumber },
    data: {
      state: status.state,
      providerReceiptNo: status.providerReceiptNo ?? null,
      clearedAt: status.clearedAt ? new Date(status.clearedAt) : null,
      statusMessage: status.message,
    },
  });

  const nextQuoteState: PolicyState =
    status.state === 'CONFIRMED'
      ? 'PAYMENT_CONFIRMED'
      : status.state === 'REVERSED'
        ? 'PAYMENT_REVERSED'
        : 'PAYMENT_PENDING';

  await prisma.quote.update({
    where: { id: tx.quoteId },
    data: { status: nextQuoteState },
  });

  await recordAudit({
    quoteId: tx.quoteId,
    actor: 'PaymentWebhook (Simulated)',
    eventType: `PAYMENT_${status.state}`,
    toState: nextQuoteState,
    details: { controlNumber, receipt: status.providerReceiptNo, message: status.message },
  });

  return {
    payment: updatedTx,
    quote: await hydrateQuote(tx.quoteId),
  };
});

// ---------------------------------------------------------------------------
// 10. TIRA MIS Bind & Cover Note / Sticker Issuance
// ---------------------------------------------------------------------------
app.post('/api/v1/quotes/:id/bind', async (request, reply) => {
  const { id } = request.params as { id: string };
  const hydrated = await hydrateQuote(id);
  if (!hydrated) return reply.code(404).send({ error: 'Quote not found' });

  if (!hydrated.readiness.issueReady) {
    return reply.code(422).send({
      error: 'Readiness gates not met.',
      blockers: hydrated.readiness.blockers,
    });
  }

  const latestPayment = hydrated.payments[0];
  const paymentCheck = canBindWithPaymentState(
    (latestPayment?.state as 'NOT_INITIATED' | 'PENDING' | 'CONFIRMED' | 'REVERSED' | 'UNAVAILABLE') ??
      'NOT_INITIATED',
  );
  if (!paymentCheck.allowed) {
    return reply.code(422).send({ error: paymentCheck.reason });
  }

  await prisma.quote.update({ where: { id }, data: { status: 'SUBMITTING_TIRA' } });

  const issuedPolicies = [];
  let anyRejected = false;
  let latestRejection = null;

  for (const item of hydrated.items) {
    const requestId = `CFCPL${Date.now().toString().slice(-9)}`;
    const tiraRes = await adapters.tira.submitCoverNote({
      requestId,
      insurerCode: hydrated.insurerCode,
      normalizedPlate: item.vehicle.normalizedPlate,
      chassisNo: item.vehicle.chassisNo,
      vehicleClass: item.vehicleClass,
      coverType: item.coverType,
      startDate: item.startDate,
      endDate: item.endDate,
      sumInsuredTzs: item.sumInsuredTzs,
      netPremiumTzs: item.netPremiumTzs,
      vatTzs: item.vatAmountTzs,
      totalPayableTzs: item.totalPayableTzs,
      insuredName: hydrated.customer!.fullName,
      insuredIdNumber: hydrated.customer!.idNumber ?? '',
      paymentReference: latestPayment.providerReceiptNo ?? latestPayment.controlNumber,
    });

    await prisma.tiraTransmissionLog.create({
      data: {
        quoteId: hydrated.id,
        requestId: tiraRes.requestId,
        normalizedPlate: item.vehicle.normalizedPlate,
        acknowledgmentId: tiraRes.acknowledgmentId,
        tiraStatusCode: tiraRes.tiraStatusCode,
        tiraStatusMessage: tiraRes.tiraStatusMessage,
        coverNoteNo: tiraRes.coverNoteNo ?? null,
        stickerNo: tiraRes.stickerNo ?? null,
        actionableNextStep: tiraRes.actionableNextStep ?? null,
        success: tiraRes.success,
      },
    });

    if (!tiraRes.success || !tiraRes.coverNoteNo || !tiraRes.stickerNo) {
      anyRejected = true;
      latestRejection = tiraRes;
      continue;
    }

    const policyNo = `POL-${hydrated.insurerCode.slice(0, 3)}-${Math.floor(100000 + Math.random() * 899999)}`;
    const policy = await prisma.policy.create({
      data: {
        policyNo,
        coverNoteNo: tiraRes.coverNoteNo,
        stickerNo: tiraRes.stickerNo,
        quoteId: hydrated.id,
        vehicleId: item.vehicleId,
        customerId: hydrated.customerId!,
        insurerCode: hydrated.insurerCode,
        vehicleClass: item.vehicleClass,
        coverType: item.coverType,
        duration: item.duration,
        startDate: item.startDate,
        endDate: item.endDate,
        sumInsuredTzs: item.sumInsuredTzs,
        netPremiumTzs: item.netPremiumTzs,
        vatAmountTzs: item.vatAmountTzs,
        totalPayableTzs: item.totalPayableTzs,
        excessJson: JSON.stringify(item.calculation?.excess ?? {}),
        firstLossPayee: hydrated.firstLossPayee,
        claimsFreeStatus: item.claimsFreeStatus,
        status: 'ISSUED',
      },
      include: { vehicle: true, customer: true },
    });
    issuedPolicies.push(policy);
  }

  if (anyRejected) {
    await prisma.quote.update({ where: { id }, data: { status: 'TIRA_REJECTED' } });
    await recordAudit({
      quoteId: id,
      actor: 'TIRA_MIS',
      eventType: 'TIRA_SUBMISSION_REJECTED',
      fromState: 'SUBMITTING_TIRA',
      toState: 'TIRA_REJECTED',
      details: {
        code: latestRejection?.tiraStatusCode,
        message: latestRejection?.tiraStatusMessage,
        actionableNextStep: latestRejection?.actionableNextStep,
      },
    });
    return reply.code(422).send({
      error: latestRejection?.tiraStatusMessage ?? 'TIRA MIS rejected submission.',
      tiraCode: latestRejection?.tiraStatusCode,
      actionableNextStep: latestRejection?.actionableNextStep,
      quote: await hydrateQuote(id),
    });
  }

  await prisma.quote.update({ where: { id }, data: { status: 'DELIVERED' } });
  await recordAudit({
    quoteId: id,
    actor: 'TIRA_MIS',
    eventType: 'COVER_NOTE_ISSUED',
    fromState: 'SUBMITTING_TIRA',
    toState: 'DELIVERED',
    details: {
      policies: issuedPolicies.map((p) => ({
        plate: p.vehicle.normalizedPlate,
        coverNoteNo: p.coverNoteNo,
        stickerNo: p.stickerNo,
      })),
    },
  });

  return {
    policies: issuedPolicies,
    quote: await hydrateQuote(id),
  };
});

// ---------------------------------------------------------------------------
// 11. Issued Policies (Digital Sticker Wallet & Broker Risk Notes)
// ---------------------------------------------------------------------------
app.get('/api/v1/policies', async () => {
  const policies = await prisma.policy.findMany({
    include: {
      vehicle: true,
      customer: true,
      quote: {
        include: { preCoverPhotos: true },
      },
    },
    orderBy: { issuedAt: 'desc' },
    take: 50,
  });
  return {
    policies: policies.map((p) => ({
      ...p,
      insurer: getInsurerByCode(p.insurerCode),
      excess: JSON.parse(p.excessJson || '{}'),
      photoCount: p.quote.preCoverPhotos.filter(
        (ph) => ph.plate === p.vehicle.normalizedPlate,
      ).length,
    })),
  };
});

// ---------------------------------------------------------------------------
// 12. Printable PDF Documents (Quote, Proforma, Proposal, Debit Note, Cover Note)
// ---------------------------------------------------------------------------
app.get('/api/v1/documents/quotes/:id/:docType.pdf', async (request, reply) => {
  const { id, docType } = request.params as {
    id: string;
    docType: 'quotation' | 'proforma' | 'proposal' | 'debit-note';
  };
  if (!['quotation', 'proforma', 'proposal', 'debit-note'].includes(docType)) {
    return reply.code(400).send({ error: 'Unsupported document type' });
  }
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      customer: true,
      items: { where: { isActive: true }, include: { vehicle: true } },
      payments: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  if (!quote) return reply.code(404).send({ error: 'Quote not found' });

  const pdf = await generateQuoteDocumentPdf({ docType, quote });
  return reply
    .header('Content-Type', 'application/pdf')
    .header('Content-Disposition', `inline; filename="${quote.quoteNumber}-${docType}.pdf"`)
    .send(pdf);
});

app.get('/api/v1/documents/policies/:id/cover-note.pdf', async (request, reply) => {
  const { id } = request.params as { id: string };
  const policy = await prisma.policy.findUnique({
    where: { id },
    include: { customer: true, vehicle: true },
  });
  if (!policy) return reply.code(404).send({ error: 'Policy not found' });

  const pdf = await generateCoverNotePdf(policy);
  return reply
    .header('Content-Type', 'application/pdf')
    .header('Content-Disposition', `inline; filename="${policy.coverNoteNo}-cover-note.pdf"`)
    .send(pdf);
});

// ---------------------------------------------------------------------------
// 13. Ecosystem Integration API (ClaimFlow & AutoFix GMS)
// ---------------------------------------------------------------------------
app.get('/api/v1/ecosystem/policies/verify', async (request, reply) => {
  const plateRaw = (request.query as { plate?: string }).plate;
  if (!plateRaw) return reply.code(400).send({ error: 'plate query param required' });
  const normalized = normalizePlate(plateRaw);

  const policy = await prisma.policy.findFirst({
    where: { vehicle: { normalizedPlate: normalized } },
    include: {
      vehicle: true,
      customer: true,
      quote: { include: { preCoverPhotos: true } },
    },
    orderBy: { issuedAt: 'desc' },
  });

  if (!policy) {
    const notFound: EcosystemPolicyVerification = { found: false };
    return notFound;
  }

  const insurer = getInsurerByCode(policy.insurerCode);
  const response: EcosystemPolicyVerification = {
    found: true,
    policyId: policy.id,
    policyNo: policy.policyNo,
    coverNoteNo: policy.coverNoteNo,
    stickerNo: policy.stickerNo,
    status: policy.status as PolicyState,
    insurerCode: policy.insurerCode,
    insurerName: insurer?.name ?? policy.insurerCode,
    coverType: policy.coverType as 'COMPREHENSIVE' | 'TPFT' | 'TPO',
    vehicleClass: policy.vehicleClass as VehicleClass,
    startDate: policy.startDate,
    endDate: policy.endDate,
    sumInsuredTzs: policy.sumInsuredTzs,
    excess: JSON.parse(policy.excessJson || '{}'),
    firstLossPayee: policy.firstLossPayee,
    claimsFreeDeclaration: {
      status: policy.claimsFreeStatus as
        | 'SELF_DECLARED_CLAIMS_FREE'
        | 'SELF_DECLARED_WITH_CLAIM'
        | 'VERIFIED_CLAIMS_FREE'
        | 'VERIFIED_WITH_CLAIM',
      declaredAt: policy.issuedAt.toISOString(),
    },
    vehicle: {
      normalizedPlate: policy.vehicle.normalizedPlate,
      chassisNo: policy.vehicle.chassisNo,
      engineNo: policy.vehicle.engineNo,
      make: policy.vehicle.make,
      model: policy.vehicle.model,
      manufactureYear: policy.vehicle.manufactureYear,
      bodyType: policy.vehicle.bodyType,
      color: policy.vehicle.color,
    },
    insured: {
      fullName: policy.customer.fullName,
      phone: policy.customer.phone,
      email: policy.customer.email,
    },
    preCoverPhotos: policy.quote.preCoverPhotos
      .filter((p) => p.plate === normalized)
      .map((p) => ({
        id: p.id,
        angle: p.angle,
        capturedAt: p.capturedAt.toISOString(),
        url: p.dataUrl,
        consentGiven: p.consentGiven,
      })),
  };

  return response;
});

app.post('/api/v1/ecosystem/claims-feedback', async (request, reply) => {
  const parsed = z
    .object({
      normalizedPlate: z.string().min(2),
      policyNo: z.string().optional(),
      claimFlowClaimId: z.string().min(2),
      lossDate: z.string(),
      claimStatus: z.enum(['OPEN', 'SETTLED', 'CLOSED_NO_PAYMENT']),
    })
    .safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid claims feedback payload' });

  const record = await prisma.claimsFeedbackRecord.upsert({
    where: { claimFlowId: parsed.data.claimFlowClaimId },
    create: {
      normalizedPlate: normalizePlate(parsed.data.normalizedPlate),
      policyNo: parsed.data.policyNo ?? null,
      claimFlowId: parsed.data.claimFlowClaimId,
      lossDate: parsed.data.lossDate,
      claimStatus: parsed.data.claimStatus,
    },
    update: {
      claimStatus: parsed.data.claimStatus,
      verifiedAt: new Date(),
    },
  });

  return reply.code(201).send({ recorded: true, record });
});

// ---------------------------------------------------------------------------
// 14. Serve Built Web App (Single-Port Production / Local Mode)
// ---------------------------------------------------------------------------
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDistDir = path.resolve(__dirname, '../../web/dist');
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

if (fs.existsSync(webDistDir)) {
  app.get('/*', async (request, reply) => {
    const reqPath = (request.url.split('?')[0] || '/').replace(/^\/+/, '');
    if (reqPath.startsWith('api/')) {
      return reply.code(404).send({ error: 'API route not found' });
    }
    const candidate = path.resolve(webDistDir, reqPath || 'index.html');
    const safeFile =
      candidate.startsWith(webDistDir) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()
        ? candidate
        : path.join(webDistDir, 'index.html');
    const ext = path.extname(safeFile).toLowerCase();
    const content = fs.readFileSync(safeFile);
    return reply.type(MIME_TYPES[ext] ?? 'application/octet-stream').send(content);
  });
}

// Start server
const PORT = Number(process.env.PORT ?? 4001);
await seedDatabase();
await app.listen({ port: PORT, host: '0.0.0.0' });
console.log(`CoverFlow Underwriting API running at http://localhost:${PORT}`);

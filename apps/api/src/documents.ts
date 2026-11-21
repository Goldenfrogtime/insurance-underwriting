import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import {
  getInsurerByCode,
  VEHICLE_CLASS_CATALOG,
  type RatingCalculationResult,
  type VehicleClass,
} from '@coverflow/domain';

function tzs(n: number): string {
  return `TZS ${Math.round(n).toLocaleString('en-US')}`;
}

function drawSandboxWatermark(doc: PDFKit.PDFDocument) {
  doc.save();
  doc.rotate(-35, { origin: [doc.page.width / 2, doc.page.height / 2] });
  doc
    .fontSize(38)
    .font('Helvetica-Bold')
    .fillColor('#94A3B8')
    .fillOpacity(0.16)
    .text('SANDBOX TEST — NOT LIVE TIRA', -60, doc.page.height / 2 - 20, {
      width: doc.page.width + 120,
      align: 'center',
    });
  doc.restore();
  doc.fillOpacity(1);
}

export async function generateQuoteDocumentPdf(params: {
  docType: 'quotation' | 'proforma' | 'proposal' | 'debit-note';
  quote: {
    quoteNumber: string;
    channel: string;
    brokerName: string | null;
    insurerCode: string;
    status: string;
    activeVersion: number;
    totalNetPremiumTzs: number;
    totalVatTzs: number;
    totalPayableTzs: number;
    totalBrokerCommissionTzs: number;
    totalVatOnCommissionTzs: number;
    totalInsurerSettlementTzs: number;
    firstLossPayee: string | null;
    proposalAccepted: boolean;
    proposalSignedBy: string | null;
    proposalSignedAt: Date | null;
    createdAt: Date;
    customer: {
      fullName: string;
      phone: string;
      email: string | null;
      idType: string | null;
      idNumber: string | null;
      address: string | null;
    } | null;
    items: Array<{
      vehicleClass: string;
      coverType: string;
      startDate: string;
      endDate: string;
      sumInsuredTzs: number;
      seatCount: number | null;
      netPremiumTzs: number;
      vatAmountTzs: number;
      totalPayableTzs: number;
      claimsFreeStatus: string;
      calculationResultJson: string;
      vehicle: {
        normalizedPlate: string;
        make: string;
        model: string;
        manufactureYear: number;
        chassisNo: string;
        engineNo: string;
        bodyType: string;
      };
    }>;
    payments: Array<{
      controlNumber: string;
      state: string;
      method: string;
    }>;
  };
}): Promise<Buffer> {
  const { docType, quote } = params;
  const insurer = getInsurerByCode(quote.insurerCode);
  const latestPayment = quote.payments[0];

  const titleMap: Record<typeof docType, string> = {
    quotation: 'MOTOR INSURANCE QUOTATION',
    proforma: 'PROFORMA INVOICE',
    proposal: 'MOTOR INSURANCE PROPOSAL & AML/CFT DECLARATION',
    'debit-note': 'BROKER DEBIT NOTE & SETTLEMENT ADVICE',
  };

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 45, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header banner
    doc.rect(0, 0, doc.page.width, 84).fill('#0F172A');
    doc.fillColor('#FFFFFF').fontSize(20).font('Helvetica-Bold').text('CoverFlow', 45, 24);
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#94A3B8')
      .text('Motor Underwriting Platform · TIRA Compliant Workflow', 45, 48);

    doc
      .fillColor('#38BDF8')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text(titleMap[docType], 240, 26, { align: 'right', width: 310 });
    doc
      .fillColor('#CBD5E1')
      .fontSize(9)
      .font('Helvetica')
      .text(
        `Ref: ${quote.quoteNumber} (v${quote.activeVersion}) · ${quote.createdAt.toISOString().slice(0, 10)}`,
        240,
        46,
        { align: 'right', width: 310 },
      );

    doc.moveDown(3);
    doc.fillColor('#0F172A');

    // Parties
    const topY = 104;
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#475569').text('INSURER', 45, topY);
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#0F172A')
      .text(insurer?.name ?? quote.insurerCode, 45, topY + 14);
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#475569')
      .text(
        quote.brokerName ? `Intermediary: ${quote.brokerName}` : 'Channel: CoverFlow Direct App',
        45,
        topY + 30,
      );

    doc.fontSize(9).font('Helvetica-Bold').fillColor('#475569').text('PROPOSED INSURED', 320, topY);
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#0F172A')
      .text(quote.customer?.fullName ?? 'Pending Customer Details', 320, topY + 14);
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#475569')
      .text(
        [
          quote.customer?.phone,
          quote.customer?.email,
          quote.customer?.idNumber ? `${quote.customer.idType ?? 'ID'}: ${quote.customer.idNumber}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
        320,
        topY + 30,
        { width: 230 },
      );

    if (quote.firstLossPayee) {
      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .fillColor('#0369A1')
        .text(`First Loss Payee: ${quote.firstLossPayee}`, 45, topY + 52);
    }

    if (latestPayment) {
      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .fillColor('#047857')
        .text(
          `Payment Control Number: ${latestPayment.controlNumber} (${latestPayment.state})`,
          320,
          topY + 52,
        );
    }

    // Divider
    doc
      .moveTo(45, topY + 74)
      .lineTo(550, topY + 74)
      .strokeColor('#E2E8F0')
      .stroke();

    // Vehicle Schedule
    let y = topY + 88;
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#0F172A').text('INSURED MOTOR SCHEDULE', 45, y);
    y += 20;

    for (const item of quote.items) {
      const classLabel =
        VEHICLE_CLASS_CATALOG[item.vehicleClass as VehicleClass]?.label ?? item.vehicleClass;
      const calc = JSON.parse(item.calculationResultJson || '{}') as Partial<RatingCalculationResult>;

      doc.rect(45, y, 505, 76).fillAndStroke('#F8FAFC', '#E2E8F0');
      doc
        .fillColor('#0F172A')
        .fontSize(10.5)
        .font('Helvetica-Bold')
        .text(
          `${item.vehicle.normalizedPlate} — ${item.vehicle.manufactureYear} ${item.vehicle.make} ${item.vehicle.model}`,
          56,
          y + 10,
        );
      doc
        .fontSize(8.5)
        .font('Helvetica')
        .fillColor('#475569')
        .text(
          `Class: ${classLabel} · Cover: ${item.coverType} · Period: ${item.startDate} to ${item.endDate}`,
          56,
          y + 26,
        );
      doc.text(
        `Chassis: ${item.vehicle.chassisNo} · Engine: ${item.vehicle.engineNo}${item.seatCount ? ` · Seats: ${item.seatCount}` : ''}`,
        56,
        y + 40,
      );
      doc.text(
        `Sum Insured: ${item.sumInsuredTzs > 0 ? tzs(item.sumInsuredTzs) : 'TPO Only'} · Claims Status: ${item.claimsFreeStatus.replace(/_/g, ' ')}`,
        56,
        y + 54,
      );

      doc
        .fontSize(10.5)
        .font('Helvetica-Bold')
        .fillColor('#0F172A')
        .text(tzs(item.totalPayableTzs), 410, y + 12, { align: 'right', width: 128 });
      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor('#64748B')
        .text(`Net ${tzs(item.netPremiumTzs)} + VAT ${tzs(item.vatAmountTzs)}`, 390, y + 28, {
          align: 'right',
          width: 148,
        });

      y += 86;

      if (calc.excess?.standardDescription) {
        doc
          .fontSize(8)
          .font('Helvetica-Oblique')
          .fillColor('#64748B')
          .text(`Excess: ${calc.excess.standardDescription} (${calc.excess.theftDescription})`, 52, y - 4);
        y += 14;
      }
    }

    // Totals box
    y += 6;
    doc.rect(315, y, 235, 76).fillAndStroke('#F1F5F9', '#CBD5E1');
    doc.fontSize(9).font('Helvetica').fillColor('#334155');
    doc.text('Net Premium:', 328, y + 12);
    doc.text(tzs(quote.totalNetPremiumTzs), 430, y + 12, { align: 'right', width: 108 });
    doc.text('VAT (18%):', 328, y + 28);
    doc.text(tzs(quote.totalVatTzs), 430, y + 28, { align: 'right', width: 108 });
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#0F172A');
    doc.text('TOTAL PAYABLE:', 328, y + 48);
    doc.text(tzs(quote.totalPayableTzs), 430, y + 48, { align: 'right', width: 108 });

    if (docType === 'debit-note') {
      doc.rect(45, y, 255, 76).fillAndStroke('#FFFBEB', '#FDE68A');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#92400E').text('BROKER ACCOUNTING (INTERNAL)', 56, y + 10);
      doc.font('Helvetica').fillColor('#78350F');
      doc.text(`Broker Commission (12.5%): ${tzs(quote.totalBrokerCommissionTzs)}`, 56, y + 26);
      doc.text(`VAT on Commission (18%): ${tzs(quote.totalVatOnCommissionTzs)}`, 56, y + 40);
      doc
        .font('Helvetica-Bold')
        .text(`Net Insurer Settlement: ${tzs(quote.totalInsurerSettlementTzs)}`, 56, y + 54);
    }

    y += 96;

    if (docType === 'proposal') {
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#0F172A').text('AML / CFT & PROPOSAL DECLARATION', 45, y);
      y += 16;
      doc
        .fontSize(8.5)
        .font('Helvetica')
        .fillColor('#334155')
        .text(
          'I/We hereby declare that the particulars given above are true and complete in every respect, and that I/We have not withheld any material information regarding the vehicle(s), actual usage, or prior claims history. In compliance with TIRA & FIU AML/CFT Regulations, this digital proposal forms the basis of the insurance contract.',
          45,
          y,
          { width: 505 },
        );
      y += 48;
      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .fillColor(quote.proposalAccepted ? '#047857' : '#B45309')
        .text(
          quote.proposalAccepted
            ? `Digitally Signed by: ${quote.proposalSignedBy ?? quote.customer?.fullName ?? 'Proposer'} on ${quote.proposalSignedAt?.toISOString() ?? ''}`
            : 'Status: Awaiting proposer digital signature',
          45,
          y,
        );
    }

    // Footer disclaimer
    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#94A3B8')
      .text(
        'IMPORTANT: SANDBOX TEST DOCUMENT — NOT a valid TIRA motor cover note. Cover commences only upon live payment clearance and live TIRA MIS sticker issuance.',
        45,
        doc.page.height - 54,
        { width: 505, align: 'center' },
      );

    drawSandboxWatermark(doc);
    doc.end();
  });
}

export async function generateCoverNotePdf(policy: {
  policyNo: string;
  coverNoteNo: string;
  stickerNo: string;
  insurerCode: string;
  vehicleClass: string;
  coverType: string;
  startDate: string;
  endDate: string;
  sumInsuredTzs: number;
  netPremiumTzs: number;
  vatAmountTzs: number;
  totalPayableTzs: number;
  excessJson: string;
  firstLossPayee: string | null;
  issuedAt: Date;
  customer: {
    fullName: string;
    phone: string;
    email: string | null;
    idType: string | null;
    idNumber: string | null;
  };
  vehicle: {
    normalizedPlate: string;
    make: string;
    model: string;
    manufactureYear: number;
    chassisNo: string;
    engineNo: string;
    bodyType: string;
    color: string;
    cc: number;
    seats: number;
  };
}): Promise<Buffer> {
  const insurer = getInsurerByCode(policy.insurerCode);
  const classLabel =
    VEHICLE_CLASS_CATALOG[policy.vehicleClass as VehicleClass]?.label ?? policy.vehicleClass;
  const excess = JSON.parse(policy.excessJson || '{}') as {
    standardDescription?: string;
    theftDescription?: string;
  };

  const qrPayload = JSON.stringify({
    platform: 'CoverFlow',
    tiraStatus: 'TIRA001',
    coverNoteNo: policy.coverNoteNo,
    stickerNo: policy.stickerNo,
    plate: policy.vehicle.normalizedPlate,
    validTo: policy.endDate,
  });
  const qrBuffer = await QRCode.toBuffer(qrPayload, { width: 110, margin: 1 });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 45, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Emerald verified header
    doc.rect(0, 0, doc.page.width, 96).fill('#064E3B');
    doc.fillColor('#FFFFFF').fontSize(20).font('Helvetica-Bold').text('MOTOR COVER NOTE & TIRA STICKER', 45, 24);
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#A7F3D0')
      .text(insurer?.name ?? policy.insurerCode, 45, 50);
    doc
      .fontSize(9)
      .fillColor('#D1FAE5')
      .text(`Issued via CoverFlow · TIRA MIS Status: TIRA001 - VERIFIED`, 45, 68);

    // QR Code top-right
    doc.image(qrBuffer, 468, 12, { width: 78 });

    // Key Regulatory Identifiers Card
    doc.rect(45, 114, 505, 64).fillAndStroke('#ECFDF5', '#6EE7B7');
    doc.fillColor('#065F46').fontSize(8).font('Helvetica-Bold');
    doc.text('TIRA COVER NOTE NO.', 60, 126);
    doc.text('TIRA STICKER NO.', 225, 126);
    doc.text('POLICY NO.', 390, 126);

    doc.fillColor('#0F172A').fontSize(12).font('Helvetica-Bold');
    doc.text(policy.coverNoteNo, 60, 142);
    doc.text(policy.stickerNo, 225, 142);
    doc.text(policy.policyNo, 390, 142);

    // Insured & Period
    let y = 198;
    doc.fillColor('#475569').fontSize(8.5).font('Helvetica-Bold').text('INSURED DETAILS', 45, y);
    doc.text('COVER PERIOD', 320, y);
    y += 14;
    doc.fillColor('#0F172A').fontSize(11).font('Helvetica-Bold').text(policy.customer.fullName, 45, y);
    doc
      .fontSize(11)
      .text(`${policy.startDate}  to  ${policy.endDate}`, 320, y);
    y += 16;
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#334155')
      .text(
        `${policy.customer.phone}${policy.customer.idNumber ? ` · ${policy.customer.idType ?? 'ID'}: ${policy.customer.idNumber}` : ''}`,
        45,
        y,
      );
    doc.text(`Cover: ${policy.coverType} (${classLabel})`, 320, y);

    if (policy.firstLossPayee) {
      y += 16;
      doc
        .font('Helvetica-Bold')
        .fillColor('#0369A1')
        .text(`First Loss Payee: ${policy.firstLossPayee}`, 45, y);
    }

    // Vehicle Block
    y += 28;
    doc.rect(45, y, 505, 102).fillAndStroke('#F8FAFC', '#CBD5E1');
    doc.fillColor('#0F172A').fontSize(10).font('Helvetica-Bold').text('INSURED VEHICLE DETAILS', 58, y + 12);
    doc.fontSize(9).font('Helvetica').fillColor('#334155');
    doc.text(`Registration No: ${policy.vehicle.normalizedPlate}`, 58, y + 32);
    doc.text(`Make / Model: ${policy.vehicle.make} ${policy.vehicle.model} (${policy.vehicle.manufactureYear})`, 58, y + 48);
    doc.text(`Body / Color: ${policy.vehicle.bodyType} · ${policy.vehicle.color}`, 58, y + 64);
    doc.text(`Seats / Engine CC: ${policy.vehicle.seats} seats · ${policy.vehicle.cc} cc`, 58, y + 80);

    doc.text(`Chassis No: ${policy.vehicle.chassisNo}`, 310, y + 32);
    doc.text(`Engine No: ${policy.vehicle.engineNo}`, 310, y + 48);
    doc.text(
      `Sum Insured: ${policy.sumInsuredTzs > 0 ? tzs(policy.sumInsuredTzs) : 'TPO Statutory Liability'}`,
      310,
      y + 64,
    );
    doc.text(`Issued At: ${policy.issuedAt.toISOString()}`, 310, y + 80);

    // Premium & Excess
    y += 120;
    doc.rect(45, y, 250, 88).fillAndStroke('#F8FAFC', '#E2E8F0');
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#0F172A').text('EXCESS / DEDUCTIBLE TERMS', 58, y + 12);
    doc
      .fontSize(8.5)
      .font('Helvetica')
      .fillColor('#334155')
      .text(excess.standardDescription ?? 'Standard statutory terms', 58, y + 28, { width: 224 });
    doc.text(excess.theftDescription ?? '', 58, y + 54, { width: 224 });

    doc.rect(310, y, 240, 88).fillAndStroke('#F1F5F9', '#CBD5E1');
    doc.fontSize(9).font('Helvetica').fillColor('#334155');
    doc.text('Net Premium:', 324, y + 14);
    doc.text(tzs(policy.netPremiumTzs), 430, y + 14, { align: 'right', width: 106 });
    doc.text('VAT (18%):', 324, y + 32);
    doc.text(tzs(policy.vatAmountTzs), 430, y + 32, { align: 'right', width: 106 });
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#065F46');
    doc.text('TOTAL PAID:', 324, y + 56);
    doc.text(tzs(policy.totalPayableTzs), 430, y + 56, { align: 'right', width: 106 });

    // Footer
    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#64748B')
      .text(
        'SANDBOX TEST COVER NOTE — NOT VALID FOR ROAD USE. Simulated TIRA MIS response for CoverFlow UAT verification only.',
        45,
        doc.page.height - 54,
        { width: 505, align: 'center' },
      );

    drawSandboxWatermark(doc);
    doc.end();
  });
}

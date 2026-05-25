// Mock extraction results — represents realistic IXP output for the 3 document types
// Phase 1: simulated only. Structure mirrors real UiPath IXP API responses
// (fields[], lineItems[], confidence, pageNumber, boundingBox).

const MOCK_RESULTS = {
  invoice: {
    docType: 'Invoice',
    documentMeta: {
      filename: 'Invoice-ATL-2026-08412.pdf',
      pages: 12,
      sizeKb: 1842,
      processedMs: 4280,
    },
    fields: [
      { id: 'f1', label: 'Vendor name', value: 'Atlas Logistics International, Inc.', confidence: 0.98, page: 1, bbox: 'x=148 y=92 w=412 h=28',
        snippet: 'BILL FROM\n[Atlas Logistics International, Inc.]\n2244 Pacific Coast Hwy\nLong Beach, CA 90804  USA' },
      { id: 'f2', label: 'Vendor tax ID', value: 'US-46-4789221', confidence: 0.94, page: 1, bbox: 'x=148 y=164 w=180 h=22',
        snippet: 'EIN [US-46-4789221]\nDUNS  08-247-6612' },
      { id: 'f3', label: 'Invoice number', value: 'INV-2026-08412', confidence: 0.99, page: 1, bbox: 'x=720 y=92 w=180 h=24',
        snippet: 'Invoice #  [INV-2026-08412]\nIssued    Mar 12, 2026' },
      { id: 'f4', label: 'PO number', value: 'PO-3382-A', confidence: 0.91, page: 1, bbox: 'x=720 y=124 w=140 h=22',
        snippet: 'PO Ref    [PO-3382-A]\nReleased  Mar 04, 2026' },
      { id: 'f5', label: 'Invoice date', value: '2026-03-12', confidence: 0.97, page: 1, bbox: 'x=720 y=156 w=140 h=22',
        snippet: 'Issued    Mar 12, 2026' },
      { id: 'f6', label: 'Due date', value: '2026-04-11', confidence: 0.96, page: 1, bbox: 'x=720 y=188 w=140 h=22',
        snippet: 'Due       Apr 11, 2026 (Net 30)' },
      { id: 'f7', label: 'Customer', value: 'Northwind Manufacturing Co.', confidence: 0.95, page: 1, bbox: 'x=148 y=248 w=380 h=24',
        snippet: 'BILL TO\n[Northwind Manufacturing Co.]\n1700 Industrial Blvd\nColumbus, OH 43229' },
      { id: 'f8', label: 'Customer account', value: 'NW-44218', confidence: 0.88, page: 1, bbox: 'x=148 y=304 w=120 h=22',
        snippet: 'Account [NW-44218]\nAttn:    Accounts Payable' },
      { id: 'f9', label: 'Currency', value: 'USD', confidence: 0.99, page: 4, bbox: 'x=720 y=624 w=80 h=22',
        snippet: 'Subtotal       18,442.00 [USD]' },
      { id: 'f10', label: 'Subtotal', value: '$18,442.00', confidence: 0.97, page: 11, bbox: 'x=720 y=540 w=140 h=22',
        snippet: 'Subtotal       [18,442.00]' },
      { id: 'f11', label: 'Tax (7.25%)', value: '$1,337.05', confidence: 0.93, page: 11, bbox: 'x=720 y=572 w=140 h=22',
        snippet: 'Sales Tax 7.25%  [1,337.05]' },
      { id: 'f12', label: 'Shipping', value: '$284.40', confidence: 0.84, page: 11, bbox: 'x=720 y=604 w=140 h=22',
        snippet: 'Freight & Handling  [284.40]' },
      { id: 'f13', label: 'Total due', value: '$20,063.45', confidence: 0.98, page: 11, bbox: 'x=720 y=648 w=180 h=28',
        snippet: 'TOTAL DUE      [$20,063.45]' },
      { id: 'f14', label: 'Payment terms', value: 'Net 30', confidence: 0.92, page: 11, bbox: 'x=148 y=648 w=120 h=22',
        snippet: 'Terms: [Net 30]\nRemit to:  Atlas Logistics ACH' },
      { id: 'f15', label: 'Remit-to bank', value: 'Pacific Union Bank · ****3318', confidence: 0.81, page: 12, bbox: 'x=148 y=420 w=260 h=22',
        snippet: 'Routing: 122-000-661\nAccount: [****3318]\nBank:    Pacific Union Bank' },
    ],
    lineItems: [
      { id: 'li1', sku: 'BRK-2204-A', description: 'Industrial brake actuator, Class 4', subDesc: 'Series 2200 · 24V DC', qty: 12, unit: 'ea', unitPrice: 384.0, total: 4608.0, page: 3, confidence: 0.96 },
      { id: 'li2', sku: 'HYD-1188', description: 'Hydraulic coupling, 1/2" NPT', subDesc: 'Stainless 316, ISO certified', qty: 48, unit: 'ea', unitPrice: 22.75, total: 1092.0, page: 3, confidence: 0.94 },
      { id: 'li3', sku: 'CBL-AWG6-BLK', description: 'AWG-6 power cable, black jacket', subDesc: 'UL listed · 1000 ft spool', qty: 4, unit: 'rl', unitPrice: 712.5, total: 2850.0, page: 4, confidence: 0.97 },
      { id: 'li4', sku: 'CTL-PLC-S7', description: 'PLC controller module S7-1500', subDesc: 'Siemens · 16 DI / 16 DO', qty: 2, unit: 'ea', unitPrice: 2840.0, total: 5680.0, page: 5, confidence: 0.99 },
      { id: 'li5', sku: 'SVC-INSTALL-T2', description: 'On-site installation, Tier 2', subDesc: '8 hr block, certified technician', qty: 6, unit: 'hr', unitPrice: 245.0, total: 1470.0, page: 7, confidence: 0.88 },
      { id: 'li6', sku: 'CAL-ANN-2026', description: 'Annual calibration & compliance', subDesc: 'NIST traceable · expires 03/2027', qty: 1, unit: 'lot', unitPrice: 1842.0, total: 1842.0, page: 9, confidence: 0.91 },
      { id: 'li7', sku: 'TRN-OPS-A', description: 'Operator training, Track A', subDesc: '2 day on-site curriculum', qty: 1, unit: 'lot', unitPrice: 900.0, total: 900.0, page: 10, confidence: 0.73 },
    ],
    lineItemTotals: { qty: 74, total: 18442.0, currency: 'USD' },
  },

  statement: {
    docType: 'Bank Statement',
    documentMeta: {
      filename: 'Statement-PUB-Mar2026.pdf',
      pages: 8,
      sizeKb: 642,
      processedMs: 3120,
    },
    fields: [
      { id: 'f1', label: 'Account holder', value: 'Northwind Manufacturing Co.', confidence: 0.98, page: 1, bbox: 'x=148 y=92 w=380 h=24',
        snippet: 'Statement For\n[Northwind Manufacturing Co.]\n1700 Industrial Blvd, Columbus OH' },
      { id: 'f2', label: 'Account number', value: '****-****-3318', confidence: 0.99, page: 1, bbox: 'x=720 y=92 w=160 h=22',
        snippet: 'Account [****-****-3318]\nType     Business Checking' },
      { id: 'f3', label: 'Statement period', value: '2026-03-01 → 2026-03-31', confidence: 0.97, page: 1, bbox: 'x=148 y=164 w=260 h=22',
        snippet: 'Period: [Mar 1, 2026 – Mar 31, 2026]' },
      { id: 'f4', label: 'Opening balance', value: '$142,808.22', confidence: 0.96, page: 1, bbox: 'x=720 y=164 w=160 h=22',
        snippet: 'Opening Bal  [$142,808.22]' },
      { id: 'f5', label: 'Closing balance', value: '$118,294.77', confidence: 0.98, page: 1, bbox: 'x=720 y=196 w=160 h=22',
        snippet: 'Closing Bal  [$118,294.77]' },
      { id: 'f6', label: 'Total deposits', value: '$48,210.00', confidence: 0.94, page: 7, bbox: 'x=720 y=540 w=140 h=22',
        snippet: 'Total Credits  [48,210.00]' },
      { id: 'f7', label: 'Total withdrawals', value: '$72,723.45', confidence: 0.94, page: 7, bbox: 'x=720 y=572 w=140 h=22',
        snippet: 'Total Debits   [72,723.45]' },
      { id: 'f8', label: 'Service charges', value: '$28.50', confidence: 0.87, page: 7, bbox: 'x=720 y=604 w=120 h=22',
        snippet: 'Service Fees   [28.50]' },
      { id: 'f9', label: 'Interest earned', value: '$28.00', confidence: 0.92, page: 7, bbox: 'x=720 y=636 w=120 h=22',
        snippet: 'Interest YTD   [28.00]' },
      { id: 'f10', label: 'Bank', value: 'Pacific Union Bank', confidence: 0.99, page: 1, bbox: 'x=148 y=44 w=240 h=28',
        snippet: '[Pacific Union Bank]\nBusiness Banking Statement' },
    ],
    lineItems: [
      { id: 'li1', sku: '2026-03-02', description: 'ACH credit · Customer pmt', subDesc: 'Ref: ACH-1182994', qty: 1, unit: '', unitPrice: 12400.0, total: 12400.0, page: 2, confidence: 0.97, kind: 'credit' },
      { id: 'li2', sku: '2026-03-04', description: 'Wire out · Atlas Logistics', subDesc: 'INV-2026-08412 · ACH-1183002', qty: 1, unit: '', unitPrice: -20063.45, total: -20063.45, page: 2, confidence: 0.95, kind: 'debit' },
      { id: 'li3', sku: '2026-03-07', description: 'Payroll · ADP run 09', subDesc: 'Batch: P09-026', qty: 1, unit: '', unitPrice: -38420.00, total: -38420.00, page: 3, confidence: 0.99, kind: 'debit' },
      { id: 'li4', sku: '2026-03-10', description: 'Card payment · Office Depot', subDesc: 'Auth: 482912', qty: 1, unit: '', unitPrice: -284.20, total: -284.20, page: 3, confidence: 0.92, kind: 'debit' },
      { id: 'li5', sku: '2026-03-14', description: 'ACH credit · Customer pmt', subDesc: 'Ref: ACH-1183188', qty: 1, unit: '', unitPrice: 18420.0, total: 18420.0, page: 4, confidence: 0.96, kind: 'credit' },
      { id: 'li6', sku: '2026-03-19', description: 'Wire out · Vendor pmt', subDesc: 'Hartford Insurance', qty: 1, unit: '', unitPrice: -9842.20, total: -9842.20, page: 5, confidence: 0.93, kind: 'debit' },
      { id: 'li7', sku: '2026-03-24', description: 'ACH credit · Customer pmt', subDesc: 'Ref: ACH-1183399', qty: 1, unit: '', unitPrice: 17390.0, total: 17390.0, page: 6, confidence: 0.94, kind: 'credit' },
      { id: 'li8', sku: '2026-03-29', description: 'Card payment · AWS', subDesc: 'Cloud services Mar', qty: 1, unit: '', unitPrice: -4113.60, total: -4113.60, page: 6, confidence: 0.78, kind: 'debit' },
      { id: 'li9', sku: '2026-03-31', description: 'Service fees', subDesc: 'Monthly maintenance', qty: 1, unit: '', unitPrice: -28.50, total: -28.50, page: 7, confidence: 0.83, kind: 'debit' },
    ],
    lineItemTotals: { qty: 9, total: -24513.45, currency: 'USD' },
  },

  insurance: {
    docType: 'Insurance Policy',
    documentMeta: {
      filename: 'Policy-HFI-9928142.pdf',
      pages: 16,
      sizeKb: 2204,
      processedMs: 5840,
    },
    fields: [
      { id: 'f1', label: 'Carrier', value: 'Hartford Fidelity Insurance', confidence: 0.99, page: 1, bbox: 'x=148 y=44 w=280 h=28',
        snippet: '[Hartford Fidelity Insurance]\nCommercial Property Policy' },
      { id: 'f2', label: 'Policy number', value: 'HFI-CP-9928142-26', confidence: 0.99, page: 1, bbox: 'x=720 y=92 w=200 h=22',
        snippet: 'Policy # [HFI-CP-9928142-26]\nIssued   Jan 14, 2026' },
      { id: 'f3', label: 'Policyholder', value: 'Northwind Manufacturing Co.', confidence: 0.98, page: 1, bbox: 'x=148 y=128 w=380 h=24',
        snippet: 'Named Insured\n[Northwind Manufacturing Co.]' },
      { id: 'f4', label: 'Policy type', value: 'Commercial Property — All-Risk', confidence: 0.95, page: 2, bbox: 'x=148 y=232 w=320 h=22',
        snippet: 'Coverage Form: [Commercial Property — All-Risk]\nForm #: CP-2026-AR' },
      { id: 'f5', label: 'Effective date', value: '2026-02-01', confidence: 0.97, page: 1, bbox: 'x=720 y=156 w=160 h=22',
        snippet: 'Effective    Feb 1, 2026 12:01 AM' },
      { id: 'f6', label: 'Expiration date', value: '2027-02-01', confidence: 0.97, page: 1, bbox: 'x=720 y=188 w=160 h=22',
        snippet: 'Expires      Feb 1, 2027 12:01 AM' },
      { id: 'f7', label: 'Coverage limit', value: '$8,500,000', confidence: 0.96, page: 4, bbox: 'x=720 y=300 w=180 h=26',
        snippet: 'Aggregate Limit  [$8,500,000.00]' },
      { id: 'f8', label: 'Deductible', value: '$25,000', confidence: 0.94, page: 4, bbox: 'x=720 y=336 w=160 h=22',
        snippet: 'Deductible    [$25,000]\nApplies per occurrence' },
      { id: 'f9', label: 'Annual premium', value: '$118,106.40', confidence: 0.97, page: 14, bbox: 'x=720 y=420 w=180 h=26',
        snippet: 'Annual Premium [$118,106.40]' },
      { id: 'f10', label: 'Broker', value: 'Marsh & Carrington LLC', confidence: 0.92, page: 15, bbox: 'x=148 y=540 w=240 h=22',
        snippet: 'Broker of Record: [Marsh & Carrington LLC]\nLicense #: TX-0044812' },
      { id: 'f11', label: 'Policy form #', value: 'CP-2026-AR', confidence: 0.91, page: 2, bbox: 'x=148 y=264 w=160 h=22',
        snippet: 'Form #: [CP-2026-AR]\nRev:    2026.01' },
      { id: 'f12', label: 'Property address', value: '1700 Industrial Blvd, Columbus, OH 43229', confidence: 0.93, page: 3, bbox: 'x=148 y=200 w=420 h=22',
        snippet: 'Insured Premises\n[1700 Industrial Blvd, Columbus, OH 43229]' },
    ],
    lineItems: [
      { id: 'li1', sku: 'A.1', description: 'Building & structure coverage', subDesc: 'Replacement cost basis', qty: 1, unit: '', unitPrice: 5800000.0, total: 5800000.0, page: 5, confidence: 0.97 },
      { id: 'li2', sku: 'A.2', description: 'Business personal property', subDesc: 'Including inventory & equipment', qty: 1, unit: '', unitPrice: 1800000.0, total: 1800000.0, page: 5, confidence: 0.95 },
      { id: 'li3', sku: 'B.1', description: 'Business interruption', subDesc: '12-month indemnity period', qty: 1, unit: '', unitPrice: 600000.0, total: 600000.0, page: 6, confidence: 0.93 },
      { id: 'li4', sku: 'C.1', description: 'Equipment breakdown', subDesc: 'Boiler, machinery & electronics', qty: 1, unit: '', unitPrice: 250000.0, total: 250000.0, page: 7, confidence: 0.91 },
      { id: 'li5', sku: 'C.2', description: 'Ordinance or law', subDesc: 'Coverage A, B, & C combined', qty: 1, unit: '', unitPrice: 50000.0, total: 50000.0, page: 8, confidence: 0.84 },
    ],
    lineItemTotals: { qty: 5, total: 8500000.0, currency: 'USD' },
  },
};

window.MOCK_RESULTS = MOCK_RESULTS;

// ─────────────────────────────────────────────────────────────
// Real file utilities — read actual page count + adapt mock
// data to the uploaded file so the prototype reflects reality.
// Replace MOCK_RESULTS with real IXP responses in Phase 3.
// ─────────────────────────────────────────────────────────────

/**
 * Read the real page count from an uploaded file.
 * - PDFs: parses the binary to find /Pages…/Count or counts /Type /Page objects.
 * - Images: 1.
 * Falls back to 1 on any error.
 */
window.getRealPageCount = async function getRealPageCount(file) {
  if (!file) return 1;
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const isImage = ['png','jpg','jpeg','tif','tiff','gif','webp','bmp'].includes(ext);
  if (isImage) return 1;
  if (ext !== 'pdf') return 1;
  try {
    const buf = await file.arrayBuffer();
    const text = new TextDecoder('latin1').decode(buf);
    // 1) Find the /Pages catalog (most reliable)
    const cat = text.match(/\/Type\s*\/Pages[\s\S]{0,800}?\/Count\s+(\d+)/);
    if (cat) {
      const n = parseInt(cat[1], 10);
      if (n > 0 && n < 10000) return n;
    }
    // 2) Fall back to counting individual Page objects (not /Pages catalog)
    const matches = text.match(/\/Type\s*\/Page(?![s\/a-zA-Z])/g);
    if (matches && matches.length > 0) return matches.length;
    return 1;
  } catch (err) {
    console.warn('Page count read failed', err);
    return 1;
  }
};

/**
 * Adapt mock extraction results to a real uploaded file:
 *  - documentMeta.filename, sizeKb, pages → from real file
 *  - field.page and lineItem.page proportionally remapped so a 4-page real
 *    PDF doesn't show fields pointing at "page 11" from the 12-page mock.
 *  - processedMs scaled with real page count for realism.
 */
window.adaptResultsToFile = function adaptResultsToFile(results, file, realPages) {
  if (!file) return results;
  const mockPages = results.documentMeta.pages || 1;
  const realP = Math.max(1, realPages || 1);
  const remap = (p) => {
    const safe = Math.max(1, Math.min(mockPages, Number(p) || 1));
    return Math.min(realP, Math.max(1, Math.ceil((safe / mockPages) * realP)));
  };
  const processedMs = Math.round(800 + realP * 280 + (file.size / 1024) * 0.6);
  return {
    ...results,
    documentMeta: {
      ...results.documentMeta,
      filename: file.name,
      sizeKb: Math.max(1, Math.round(file.size / 1024)),
      pages: realP,
      processedMs,
    },
    fields: results.fields.map((f) => ({ ...f, page: remap(f.page) })),
    lineItems: results.lineItems.map((l) => ({ ...l, page: remap(l.page) })),
  };
};

// Default settings shape
window.DEFAULT_SETTINGS = {
  clientId: '',
  clientSecret: '',
  tenant: '',
  folder: 'Shared',
  environment: 'production',
  customUrl: '',
  project: '',
  scopes: 'DU.IXP DU.Digitization OR.Default',
  saveLocally: true,
};

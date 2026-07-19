import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import { Ticket, Resolution, RESOLUTION_TYPE_LABELS } from "./types";

// ============================================================================
// EASY-TO-EDIT CONFIG — change these without touching the layout code below.
// ============================================================================
const CONFIG = {
  // Shown under the letterhead image. Replace with your real address/contact
  // — there was no source for this in the letterhead artwork itself.
  contactLine: "124 Malakas St. Diliman Quezon City  ·  service@mrlcybertec.com  ·  +63 XXX XXX XXXX",
  accentColor: rgb(0.06, 0.48, 0.42), // matches the app's teal accent
  inkColor: rgb(0.06, 0.15, 0.2),
  softColor: rgb(0.3, 0.42, 0.46),
  lineColor: rgb(0.83, 0.87, 0.88),
  pageMargin: 40,
  letterheadWidthPt: 200,
};

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function generateServiceReport(ticket: Ticket, resolution: Resolution, teamNames: string[]) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const margin = CONFIG.pageMargin;
  const contentWidth = width - margin * 2;

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = height - margin;

  // --- letterhead --------------------------------------------------------
  try {
    const letterheadBytes = await fetch("/letterhead.png").then((r) => r.arrayBuffer());
    const letterheadImage = await pdfDoc.embedPng(letterheadBytes);
    const scale = CONFIG.letterheadWidthPt / letterheadImage.width;
    const lhWidth = CONFIG.letterheadWidthPt;
    const lhHeight = letterheadImage.height * scale;
    page.drawImage(letterheadImage, {
      x: (width - lhWidth) / 2,
      y: y - lhHeight,
      width: lhWidth,
      height: lhHeight,
    });
    y -= lhHeight + 6;
  } catch {
    // Letterhead image missing/failed to load — fall back to plain text so
    // the report still generates instead of throwing.
    page.drawText("MRL Cybertec Corp", { x: margin, y, size: 18, font: fontBold, color: CONFIG.inkColor });
    y -= 22;
  }

  page.drawText(CONFIG.contactLine, {
    x: (width - font.widthOfTextAtSize(CONFIG.contactLine, 8)) / 2,
    y,
    size: 8,
    font,
    color: CONFIG.softColor,
  });
  y -= 20;

  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: CONFIG.lineColor });
  y -= 26;

  // --- title + ticket number ----------------------------------------------
  page.drawText("SERVICE REPORT", { x: margin, y, size: 15, font: fontBold, color: CONFIG.inkColor });
  const ticketNumWidth = font.widthOfTextAtSize(ticket.ticket_number, 11);
  page.drawText(ticket.ticket_number, {
    x: width - margin - ticketNumWidth,
    y: y + 2,
    size: 11,
    font: fontBold,
    color: CONFIG.accentColor,
  });
  y -= 28;

  // --- helpers --------------------------------------------------------------
  function sectionTitle(text: string) {
    page.drawText(text.toUpperCase(), { x: margin, y, size: 9, font: fontBold, color: CONFIG.accentColor });
    y -= 14;
  }

  function labelValueRow(pairs: [string, string][], colWidth: number) {
    const startY = y;
    let maxDrop = 0;
    pairs.forEach(([label, value], i) => {
      const x = margin + (i % 2) * colWidth;
      const rowY = startY - Math.floor(i / 2) * 30;
      page.drawText(label.toUpperCase(), { x, y: rowY, size: 7, font, color: CONFIG.softColor });
      page.drawText(value || "—", { x, y: rowY - 12, size: 10, font, color: CONFIG.inkColor });
      const drop = Math.floor(i / 2) * 30 + 30;
      if (drop > maxDrop) maxDrop = drop;
    });
    y = startY - maxDrop;
  }

  function paragraph(text: string, size = 10) {
    const lines = wrapText(text || "—", font, size, contentWidth);
    for (const line of lines) {
      page.drawText(line, { x: margin, y, size, font, color: CONFIG.inkColor });
      y -= size + 4;
    }
    y -= 6;
  }

  function divider() {
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: CONFIG.lineColor });
    y -= 18;
  }

  const m = ticket.machines!;
  const colWidth = contentWidth / 2;

  // --- machine & ticket info --------------------------------------------
  sectionTitle("Machine & Ticket Info");
  labelValueRow(
    [
      ["Customer", m.customer_name],
      ["Region", ticket.region],
      ["Brand", m.brand],
      ["Machine", m.machine_model],
      ["Serial Number", m.serial_number],
      ["Contract Type", m.contract_type || "—"],
      ["Ticket Lodged", new Date(ticket.created_at).toLocaleString()],
      ["Ticket Resolved", ticket.resolved_at ? new Date(ticket.resolved_at).toLocaleString() : "—"],
    ],
    colWidth,
  );
  divider();

  // --- reported issue -------------------------------------------------------
  sectionTitle("Reported Issue");
  paragraph(ticket.description || "—");
  divider();

  // --- resolution -------------------------------------------------------------
  sectionTitle("Resolution");
  labelValueRow(
    [
      ["Outcome", RESOLUTION_TYPE_LABELS[resolution.resolution_type]],
      ["Symptom", resolution.symptom_category],
      ["Error Code", resolution.error_code || "—"],
      ["Parts Used", resolution.parts_used && resolution.parts_used.length > 0 ? resolution.parts_used.join(", ") : "—"],
    ],
    colWidth,
  );
  y -= 4;
  page.drawText("ROOT CAUSE", { x: margin, y, size: 7, font, color: CONFIG.softColor });
  y -= 12;
  paragraph(resolution.root_cause);
  page.drawText("WORK PERFORMED", { x: margin, y, size: 7, font, color: CONFIG.softColor });
  y -= 12;
  paragraph(resolution.resolution_notes);
  divider();

  // --- technician(s) --------------------------------------------------------
  sectionTitle("Serviced By");
  const names = [ticket.technicians?.name, ...teamNames].filter(Boolean).join(", ") || "—";
  paragraph(names);

  // --- signature line, pinned near the bottom of the page -------------------
  const sigY = 90;
  page.drawLine({ start: { x: margin, y: sigY }, end: { x: margin + 200, y: sigY }, thickness: 0.8, color: CONFIG.inkColor });
  page.drawText("Customer Signature", { x: margin, y: sigY - 12, size: 8, font, color: CONFIG.softColor });

  page.drawLine({
    start: { x: width - margin - 200, y: sigY },
    end: { x: width - margin, y: sigY },
    thickness: 0.8,
    color: CONFIG.inkColor,
  });
  page.drawText("Date", { x: width - margin - 200, y: sigY - 12, size: 8, font, color: CONFIG.softColor });

  page.drawText(`Generated ${new Date().toLocaleString()}`, {
    x: margin,
    y: 40,
    size: 7,
    font,
    color: CONFIG.softColor,
  });

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

export function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

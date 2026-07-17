// Client-side PDF export.
//
// Uses html2canvas-pro, not html2canvas — Tailwind v4's default color
// palette (and any color-mix-based opacity utility) computes to oklch()/
// oklab(), which the original html2canvas (unmaintained since before the
// CSS Color 4 spec) can't parse and throws on. html2canvas-pro is a
// maintained fork with the same API that added support for those.
//
// Honest limitation worth knowing: this works by photographing the rendered
// report (via html2canvas-pro) and placing that image into a PDF page by page.
// It looks exactly like the on-screen report, but the text inside the PDF
// is a picture, not selectable/searchable text. That's a fine tradeoff for
// a "here's your report to save and share" feature — if you ever want a
// text-searchable PDF, that's a bigger rework (e.g. @react-pdf/renderer)
// generating the PDF from the data directly instead of screenshotting.

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MARGIN_MM = 10;

// Exported so callers can interleave a tab switch + capture per element —
// capturing both elements only after both tab switches (the old approach)
// meant whichever element got hidden last was photographed at 0x0.
export async function addElementAsPages(
  pdf: import("jspdf").default,
  element: HTMLElement,
  isFirstElementOverall: boolean,
) {
  const html2canvas = (await import("html2canvas-pro")).default;

  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: null,
    useCORS: true,
  });

  const usableWidthMm = A4_WIDTH_MM - MARGIN_MM * 2;
  const usableHeightMm = A4_HEIGHT_MM - MARGIN_MM * 2;
  const pxPerMm = canvas.width / usableWidthMm;
  const pageHeightPx = Math.floor(usableHeightMm * pxPerMm);

  let renderedPx = 0;
  let isFirstPage = true;

  while (renderedPx < canvas.height) {
    if (!(isFirstElementOverall && isFirstPage)) {
      pdf.addPage();
    }
    isFirstPage = false;

    const sliceHeightPx = Math.min(pageHeightPx, canvas.height - renderedPx);

    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeightPx;
    const ctx = pageCanvas.getContext("2d");
    if (!ctx) break;
    ctx.drawImage(
      canvas,
      0,
      renderedPx,
      canvas.width,
      sliceHeightPx,
      0,
      0,
      canvas.width,
      sliceHeightPx,
    );

    const sliceHeightMm = sliceHeightPx / pxPerMm;
    pdf.addImage(
      pageCanvas.toDataURL("image/jpeg", 0.92),
      "JPEG",
      MARGIN_MM,
      MARGIN_MM,
      usableWidthMm,
      sliceHeightMm,
    );

    renderedPx += sliceHeightPx;
  }
}

export async function createReportPdf() {
  const { default: jsPDF } = await import("jspdf");
  return new jsPDF({ unit: "mm", format: "a4" });
}

export function saveReportPdf(pdf: import("jspdf").default, ideaTitle: string) {
  const safeName =
    ideaTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "report";

  pdf.save(`foundercopilot-${safeName}.pdf`);
}

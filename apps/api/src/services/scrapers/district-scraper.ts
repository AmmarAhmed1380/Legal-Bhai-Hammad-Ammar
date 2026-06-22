import axios from "axios";
// @ts-ignore
import pdf from "pdf-parse";

export interface DistrictScrapedMatch {
  caseNumber: string;
  matchedTextSnippet: string;
  pageNumber: number;
}

const SCRAPER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "application/pdf,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Connection": "keep-alive",
};

async function executeWithRetry<T>(requestFn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await requestFn();
    } catch (error: any) {
      lastError = error;
      const status = error.response?.status;
      const shouldRetry = !status || status === 503 || status === 429 || status >= 500;
      if (shouldRetry && i < retries - 1) {
        const backoff = delay * Math.pow(2, i);
        console.warn(`[District Scraper Retry] Request failed with status ${status || 'network error'}. Retrying in ${backoff}ms...`);
        await new Promise((resolve) => setTimeout(resolve, backoff));
      } else {
        break;
      }
    }
  }
  throw lastError;
}

export class DistrictCourtScraper {
  private pdfUrlBase = "https://rawalpindi.dc.lhc.gov.pk/PublicPages/CauseListPdf.aspx";

  /**
   * Fetches the cause list PDF for the target date, extracts its text,
   * and searches for occurrences of the active case numbers.
   */
  async scrapeAndMatchCases(
    dateIso: string,
    activeCaseNumbers: string[]
  ): Promise<DistrictScrapedMatch[] | null> {
    try {
      // 1. Fetch the daily cause list PDF file as an ArrayBuffer
      const targetUrl = `${this.pdfUrlBase}?date=${encodeURIComponent(dateIso)}`;
      const response = await executeWithRetry(() =>
        axios.get(targetUrl, {
          responseType: "arraybuffer",
          headers: SCRAPER_HEADERS,
        })
      );

      const buffer = Buffer.from(response.data);

      // 2. Parse the PDF using pdf-parse to extract raw text content
      let textContent = "";
      try {
        const parsedPdf = await pdf(buffer);
        textContent = parsedPdf.text || "";
      } catch (pdfError) {
        console.error("[District Scraper] PDF text extraction failed:", pdfError);
        return null;
      }

      // 3. Scan the text contents using RegExp to match active case numbers
      return this.matchCaseNumbers(textContent, activeCaseNumbers);
    } catch (error) {
      console.error("[District Scraper] Error scraping and parsing PDF:", error);
      return null;
    }
  }

  /**
   * Utilizes regex to check which active case numbers are present in the PDF text body
   */
  private matchCaseNumbers(text: string, activeCases: string[]): DistrictScrapedMatch[] {
    const matches: DistrictScrapedMatch[] = [];
    const lines = text.split("\n");

    for (const caseNo of activeCases) {
      // Escape special regex characters in the case number for safe matching
      const escapedCase = caseNo.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
      const regex = new RegExp(`\\b${escapedCase}\\b`, "i");

      // Find the first line that contains the case number to extract a clean snippet
      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) {
          matches.push({
            caseNumber: caseNo,
            matchedTextSnippet: lines[i].trim(),
            pageNumber: 1, // pdf-parse extracts raw continuous text; page boundaries are optional
          });
          break;
        }
      }
    }

    return matches;
  }
}

import axios from "axios";
import * as cheerio from "cheerio";

export interface LhcScrapedRow {
  caseNumber: string;
  parties: string;
  nextDate: string;
  courtroom?: string;
  judge?: string;
}

const SCRAPER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "max-age=0",
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
        console.warn(`[LHC Scraper Retry] Request failed with status ${status || 'network error'}. Retrying in ${backoff}ms...`);
        await new Promise((resolve) => setTimeout(resolve, backoff));
      } else {
        break;
      }
    }
  }
  throw lastError;
}

export class LahoreHighCourtScraper {
  private baseUrl = "https://data.lhc.gov.pk/case_management/regular_cause_list";

  /**
   * Fetches and parses the Lahore High Court cause list for a given date.
   * Handles legacy ASP.NET viewstate extraction if POST requests are required.
   */
  async fetchCauseList(dateIso: string): Promise<LhcScrapedRow[] | null> {
    try {
      // 1. Initial GET request to retrieve __VIEWSTATE, __EVENTVALIDATION, etc.
      const landingResponse = await executeWithRetry(() =>
        axios.get(this.baseUrl, {
          headers: SCRAPER_HEADERS,
        })
      );

      let viewState = "";
      let eventValidation = "";

      try {
        const $landing = cheerio.load(landingResponse.data);
        viewState = $landing("input#__VIEWSTATE").val() as string || "";
        eventValidation = $landing("input#__EVENTVALIDATION").val() as string || "";
      } catch (parseError) {
        console.error("[LHC Scraper] Cheerio landing page parsing failed:", parseError);
        return null;
      }

      // 2. Perform POST request simulation containing ASP.NET inputs and targeted date
      const payload = new URLSearchParams({
        __VIEWSTATE: viewState,
        __EVENTVALIDATION: eventValidation,
        "ctl00$ContentPlaceHolder1$txtDate": dateIso,
        "ctl00$ContentPlaceHolder1$btnSearch": "Search",
      });

      const response = await executeWithRetry(() =>
        axios.post(this.baseUrl, payload.toString(), {
          headers: {
            ...SCRAPER_HEADERS,
            "Content-Type": "application/x-www-form-urlencoded",
          },
        })
      );

      return this.parseHtml(response.data);
    } catch (error) {
      console.error("[LHC Scraper] Error fetching or parsing cause list:", error);
      return null;
    }
  }

  /**
   * Parses the raw HTML response using Cheerio to extract case details.
   */
  private parseHtml(html: string): LhcScrapedRow[] | null {
    try {
      const $ = cheerio.load(html);
      const scrapedRows: LhcScrapedRow[] = [];

      // Select the target table rows (typically inside ASP.NET GridViews or tables)
      $("table tr").each((index, element) => {
        // Skip headers
        if (index === 0) return;

        const cells = $(element).find("td");
        if (cells.length >= 3) {
          const caseNumberText = $(cells[0]).text().trim();
          const partiesText = $(cells[1]).text().trim();
          const nextDateText = $(cells[2]).text().trim();
          
          // Simple validation filter to capture only valid rows containing case numbers
          if (caseNumberText && partiesText && nextDateText) {
            scrapedRows.push({
              caseNumber: caseNumberText,
              parties: partiesText,
              nextDate: nextDateText,
              courtroom: cells.length > 3 ? $(cells[3]).text().trim() : undefined,
              judge: cells.length > 4 ? $(cells[4]).text().trim() : undefined,
            });
          }
        }
      });

      return scrapedRows;
    } catch (parseError) {
      console.error("[LHC Scraper] Cheerio parseHtml failed:", parseError);
      return null;
    }
  }
}

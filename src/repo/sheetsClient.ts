import { google } from "googleapis";
import { readFile } from "node:fs/promises";
import type { sheets_v4 } from "googleapis";
import { withRetry } from "../utils/retry.js";

export interface SheetsClientOptions {
  serviceAccountJsonPath: string;
  spreadsheetId: string;
}

export class SheetsClient {
  private sheets: sheets_v4.Sheets;
  private spreadsheetId: string;

  constructor(options: SheetsClientOptions) {
    this.spreadsheetId = options.spreadsheetId;
    this.sheets = google.sheets({ version: "v4" });
  }

  static async create(options: SheetsClientOptions): Promise<SheetsClient> {
    const auth = await SheetsClient.buildAuth(options.serviceAccountJsonPath);
    google.options({ auth });
    return new SheetsClient(options);
  }

  private static async buildAuth(serviceAccountJsonPath: string) {
    const json = await readFile(serviceAccountJsonPath, "utf-8");
    const credentials = JSON.parse(json);
    return new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
  }

  async getSpreadsheet(): Promise<sheets_v4.Schema$Spreadsheet> {
    const response = await withRetry(() =>
      this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
        includeGridData: false,
      })
    );
    return response.data;
  }

  async getValues(range: string): Promise<string[][]> {
    const response = await withRetry(() =>
      this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range,
      })
    );
    return (response.data.values as string[][] | undefined) ?? [];
  }

  async appendValues(range: string, values: (string | number | boolean)[][]): Promise<void> {
    await withRetry(() =>
      this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range,
        valueInputOption: "RAW",
        requestBody: { values },
      })
    );
  }

  async updateValues(range: string, values: (string | number | boolean)[][]): Promise<void> {
    await withRetry(() =>
      this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range,
        valueInputOption: "RAW",
        requestBody: { values },
      })
    );
  }

  async batchUpdate(requests: sheets_v4.Schema$Request[]): Promise<void> {
    await withRetry(() =>
      this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: { requests },
      })
    );
  }
}

import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express, { Request, Response } from 'express';
import { join } from 'node:path';
import 'dotenv/config';
import ExcelJS from 'exceljs';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/api/bls/timeseries', async (req: Request, res: Response) => {
  try {
    const key = process.env['BLS_REGISTRATION_KEY'];
    if (!key) {
      return res.status(500).json({ error: 'Missing BLS_REGISTRATION_KEY on server' });
    }

    // Expect body: { seriesIds: string[], startYear: string, endYear: string }
    const { seriesIds, startYear, endYear } = req.body ?? {};

    if (!Array.isArray(seriesIds) || !seriesIds.length) {
      return res.status(400).json({ error: 'seriesIds must be a non-empty string[]' });
    }

    const payload = {
      seriesid: seriesIds,
      startyear: String(startYear ?? ''),
      endyear: String(endYear ?? ''),
      registrationkey: key,
    };

    const blsResp = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await blsResp.json();
    return res.status(blsResp.ok ? 200 : blsResp.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'BLS proxy failed', details: String(err) });
  }
  type MajorGroupRow = {
  socMajor: string;
  title: string;
  employment2024k: number;
  employment2034k: number;
  changeNumerick: number;
  changePercent: number;
  medianWage2024: number | null;
};

let cachedMajorGroups: MajorGroupRow[] | null = null;

app.get('/api/ep/major-groups', async (_req: Request, res: Response) => {
  try {
    if (cachedMajorGroups) return res.json(cachedMajorGroups);

    const url = 'https://www.bls.gov/emp/ind-occ-matrix/occupation.xlsx';
    const resp = await fetch(url);
    if (!resp.ok) {
      return res.status(502).json({ error: `Failed to fetch EP workbook (${resp.status})` });
    }

    const arrayBuffer = await resp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return res.status(500).json({ error: 'EP workbook has no worksheets' });
    }

    // Find header row dynamically
    let headerRowNumber = -1;
    worksheet.eachRow((row, rowNumber) => {
      const rowValues = row.values as any[];
      const values = (rowValues ?? [])
        .map((v: any) => String(v ?? '').toLowerCase());
      if (
        values.some((v: string) => v.includes('national employment matrix code')) &&
        values.some((v: string) => v.includes('employment, 2024')) &&
        values.some((v: string) => v.includes('employment, 2034'))
      ) {
        headerRowNumber = rowNumber;
      }
    });

    if (headerRowNumber === -1) {
      return res.status(500).json({ error: 'Could not locate Table 1.1 header row' });
    }

    const headerRow = worksheet.getRow(headerRowNumber);

    // Map header text -> column index
    const headers: { text: string; col: number }[] = [];
    headerRow.eachCell((cell, col) => {
      headers.push({ text: String(cell.value ?? '').toLowerCase().trim(), col });
    });

    const colIndex = (contains: string) =>
      headers.find(h => h.text.includes(contains))?.col;

    const idxCode = colIndex('code');
    const idxTitle = colIndex('title');
    const idxEmp2024 = colIndex('employment, 2024');
    const idxEmp2034 = colIndex('employment, 2034');
    const idxChangeNum = colIndex('change, numeric');
    const idxChangePct = colIndex('change, percent');
    const idxWage = colIndex('median annual wage');

    if (!idxCode || !idxTitle || !idxEmp2024 || !idxEmp2034 || !idxChangeNum || !idxChangePct) {
      return res.status(500).json({ error: 'Missing required EP columns' });
    }

    const num = (v: any): number => {
      if (typeof v === 'number') return v;
      const n = Number(String(v ?? '').replace(/,/g, ''));
      return Number.isFinite(n) ? n : NaN;
    };

    const parsed: MajorGroupRow[] = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRowNumber) return;

      const socMajor = String(row.getCell(idxCode).value ?? '').trim();
      if (!/^\d{2}-0000$/.test(socMajor)) return;

      const title = String(row.getCell(idxTitle).value ?? '').trim();

      const emp2024 = num(row.getCell(idxEmp2024).value);
      const emp2034 = num(row.getCell(idxEmp2034).value);
      const chNum = num(row.getCell(idxChangeNum).value);
      const chPct = num(row.getCell(idxChangePct).value);

      if (![emp2024, emp2034, chNum, chPct].every(Number.isFinite)) return;

      const wageCell = idxWage ? row.getCell(idxWage).value : null;
      const wageNum = num(wageCell);
      const wage = Number.isFinite(wageNum) ? wageNum : null;

      parsed.push({
        socMajor,
        title,
        employment2024k: emp2024,
        employment2034k: emp2034,
        changeNumerick: chNum,
        changePercent: chPct,
        medianWage2024: wage,
      });
    });

    cachedMajorGroups = parsed;
    return res.json(parsed);
  } catch (err) {
    return res.status(500).json({
      error: 'Failed to parse EP workbook safely',
      details: String(err),
    });
  }
});
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);

import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express, { Request, Response } from 'express';
import { join } from 'node:path';
import 'dotenv/config';

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

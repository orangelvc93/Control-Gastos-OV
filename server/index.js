import cors from 'cors';
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import seedData from '../src/data.json' with { type: 'json' };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const dbDir = path.join(rootDir, 'db');
const yearsDir = path.join(dbDir, 'years');
const legacyJsonPath = path.join(dbDir, 'data.json');
const defaultYear = String(new Date().getFullYear());
const port = process.env.PORT || 3002;

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

await ensureJsonDatabase(defaultYear);

app.get('/api/years', async (_request, response) => {
  response.json({ years: await listYears(), currentYear: defaultYear });
});

app.post('/api/years', async (request, response) => {
  const year = sanitizeYear(request.body?.year);
  await ensureJsonDatabase(year, true);
  response.status(201).json({ years: await listYears(), currentYear: year });
});

app.get('/api/data', async (request, response) => {
  response.json(await readJsonData(getYear(request)));
});

app.put('/api/data', async (request, response) => {
  const year = getYear(request);
  await writeJsonData(year, request.body);
  response.json(await readJsonData(year));
});

app.post('/api/reset', async (request, response) => {
  const year = getYear(request);
  await writeJsonData(year, seedData);
  response.json(await readJsonData(year));
});

app.listen(port, () => {
  console.log(`API JSON lista en http://localhost:${port}`);
  console.log(`Base por años: ${yearsDir}`);
});

async function ensureJsonDatabase(year, blank = false) {
  await fs.mkdir(yearsDir, { recursive: true });
  const jsonPath = getYearPath(year);
  try {
    await fs.access(jsonPath);
  } catch {
    if (!blank) {
      try {
        const legacy = await fs.readFile(legacyJsonPath, 'utf8');
        await fs.writeFile(jsonPath, legacy, 'utf8');
        return;
      } catch {
        // No legacy database exists; create from seed data.
      }
    }
    await writeJsonData(year, blank ? createBlankData() : seedData);
  }
}

async function listYears() {
  await fs.mkdir(yearsDir, { recursive: true });
  const files = await fs.readdir(yearsDir);
  const years = files.filter((file) => /^\d{4}\.json$/.test(file)).map((file) => file.replace('.json', '')).sort();
  return years.length ? years : [defaultYear];
}

async function readJsonData(year) {
  await ensureJsonDatabase(year);
  const raw = await fs.readFile(getYearPath(year), 'utf8');
  return normalizeData(JSON.parse(raw));
}

async function writeJsonData(year, data) {
  await fs.mkdir(yearsDir, { recursive: true });
  await fs.writeFile(getYearPath(year), `${JSON.stringify(normalizeData(data), null, 2)}\n`, 'utf8');
}

function getYear(request) {
  return sanitizeYear(request.query.year ?? defaultYear);
}

function sanitizeYear(year) {
  const value = String(year ?? defaultYear).trim();
  if (!/^\d{4}$/.test(value)) return defaultYear;
  return value;
}

function getYearPath(year) {
  return path.join(yearsDir, `${sanitizeYear(year)}.json`);
}

function createBlankData() {
  return normalizeData({ ...seedData, payments: [], income: [], debts: [], savings: [], fixedBudget: { expenses: [], income: [], distribution: [] }, journal: [] });
}

function normalizeData(data) {
  return {
    months: data.months?.length ? data.months : seedData.months,
    payments: data.payments ?? [],
    income: data.income ?? [],
    debts: data.debts ?? [],
    savings: data.savings ?? [],
    fixedBudget: {
      expenses: data.fixedBudget?.expenses ?? [],
      income: data.fixedBudget?.income ?? [],
      distribution: data.fixedBudget?.distribution ?? [],
    },
    journal: data.journal ?? [],
  };
}

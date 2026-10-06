import { readFile, writeFile, rename } from 'node:fs/promises';
import { collectPostClose } from './post-close-source.mjs';
const path = new URL('../data/post-close.json', import.meta.url);
let saved = { reports: [] }; try { saved = JSON.parse(await readFile(path, 'utf8')); } catch {}
const report = await collectPostClose(saved.reports[0]);
const reports = [report, ...saved.reports.filter(r => r.date !== report.date)].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 90);
const temp = new URL('../data/post-close.tmp', import.meta.url);
await writeFile(temp, JSON.stringify({ reports }, null, 2) + '\n'); await rename(temp, path);
console.log('Post close:', report.date, report.complete ? 'complete' : 'partial', report.message);

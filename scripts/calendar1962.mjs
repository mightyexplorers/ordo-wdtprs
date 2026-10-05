// Exports the 1962 calendar from Divinum Officium (MIT, github.com/DivinumOfficium/divinum-officium)
// into data/do/<year>-usa.json and data/do/<year>-1960.json. Run once a year:
//   npm run calendar               # last year through next year
//   npm run calendar -- 2017 2028  # a range
// Uses a local DO container with scripts/do/ordojson.pl mounted next to kalendar.pl; starts one
// if none answers at DO_URL. Nothing here touches divinumofficium.com.
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const DO_URL = process.env.DO_URL || 'http://localhost:8090';
const IMAGE = 'ghcr.io/divinumofficium/divinum-officium:master';
const CONTAINER = 'ordo-divinum-officium';
const VERSIONS = { usa: 'Rubrics 1960 - 2020 USA', 1960: 'Rubrics 1960 - 1960' };

const thisYear = new Date().getUTCFullYear();
const [from = thisYear - 1, to = thisYear + 1] = process.argv.slice(2).map(Number);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const up = () => fetch(`${DO_URL}/cgi-bin/horas/kalendar.pl`).then((r) => r.ok, () => false);

let started = false;
if (!(await up())) {
  console.log(`starting ${IMAGE} …`);
  execFileSync('docker', [
    'run', '-d', '--rm', '--name', CONTAINER, '--platform', 'linux/amd64', '-p', `${new URL(DO_URL).port}:8080`,
    '-v', `${resolve('scripts/do/ordojson.pl')}:/var/www/web/cgi-bin/horas/ordojson.pl:ro`, IMAGE,
  ], { stdio: 'inherit' });
  started = true;
  for (let i = 0; i < 90 && !(await up()); i++) await sleep(2000);
}

try {
  await mkdir('data/do', { recursive: true });
  for (let year = from; year <= to; year++) {
    for (const [tag, version] of Object.entries(VERSIONS)) {
      const res = await fetch(`${DO_URL}/cgi-bin/horas/ordojson.pl?kyear=${year}&version=${encodeURIComponent(version)}`);
      if (!res.ok) throw new Error(`${year} ${version}: HTTP ${res.status}`);
      const data = await res.json();
      await writeFile(`data/do/${year}-${tag}.json`, JSON.stringify(data, null, 0));
      console.log(`${year} ${version}: ${data.days.length} days`);
    }
  }
} finally {
  if (started) execFileSync('docker', ['stop', CONTAINER], { stdio: 'ignore' });
}

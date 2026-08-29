#!/usr/bin/env node
/* Sirāj — regenerate everything, in dependency order.
 *
 *   node tools/build.js           # rebuild the whole site
 *   node tools/build.js --check   # verify nothing is missing or orphaned
 *
 * The sitemap runs last because it has to enumerate what the others produced.
 */
'use strict';
const { execFileSync } = require('child_process');
const path = require('path');

const check = process.argv.includes('--check');
const steps = ['gen-site.js', 'gen-cities.js', 'gen-ramadan.js'];
if (!check) steps.push('gen-sitemap.js');

for (const step of steps) {
  const args = [path.join(__dirname, step)];
  if (check) args.push('--check');
  execFileSync(process.execPath, args, { stdio: 'inherit' });
}

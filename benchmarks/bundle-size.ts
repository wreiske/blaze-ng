/**
 * Bundle size analysis — measures gzipped sizes of each package.
 *
 * Runs after `pnpm build` and reports the gzipped ESM bundle size
 * for each package. Flags anything exceeding the target thresholds.
 *
 * Usage: node --import tsx benchmarks/bundle-size.ts
 *   or:  npx tsx benchmarks/bundle-size.ts
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Configuration ──────────────────────────────────────────────────────────

/** Target: core runtime packages must be under this combined gzipped size. */
const CORE_GZIP_TARGET_KB = 15;

/** Core runtime packages (what ships to the browser). */
const CORE_PACKAGES = ['core', 'htmljs', 'spacebars', 'observe-sequence'];

/** All packages to measure. */
const ALL_PACKAGES = [
  'core',
  'htmljs',
  'spacebars',
  'observe-sequence',
  'spacebars-compiler',
  'html-tools',
  'blaze-tools',
  'templating-tools',
  'templating-compiler',
  'templating-runtime',
  'templating',
  'hot',
  'compat',
  'meteor',
  'wasm',
  'html-templates',
];

// ─── Helpers ────────────────────────────────────────────────────────────────

interface PackageSize {
  name: string;
  rawBytes: number;
  gzipBytes: number;
  rawKB: string;
  gzipKB: string;
  exists: boolean;
}

function getPackageSize(pkgName: string, packagesDir: string): PackageSize {
  const esmPath = join(packagesDir, pkgName, 'dist', 'index.js');
  const result: PackageSize = {
    name: `@blaze-ng/${pkgName}`,
    rawBytes: 0,
    gzipBytes: 0,
    rawKB: '—',
    gzipKB: '—',
    exists: false,
  };

  if (!existsSync(esmPath)) {
    return result;
  }

  const content = readFileSync(esmPath);
  const gzipped = gzipSync(content, { level: 9 });

  result.exists = true;
  result.rawBytes = content.length;
  result.gzipBytes = gzipped.length;
  result.rawKB = (content.length / 1024).toFixed(1);
  result.gzipKB = (gzipped.length / 1024).toFixed(1);

  return result;
}

function padRight(str: string, len: number): string {
  return str + ' '.repeat(Math.max(0, len - str.length));
}

function padLeft(str: string, len: number): string {
  return ' '.repeat(Math.max(0, len - str.length)) + str;
}

// ─── Main ───────────────────────────────────────────────────────────────────

const packagesDir = join(__dirname, '..', 'packages');

console.log('\n📦 Blaze-NG Bundle Size Analysis\n');
console.log('='.repeat(65));

const sizes = ALL_PACKAGES.map((pkg) => getPackageSize(pkg, packagesDir));
const missing = sizes.filter((s) => !s.exists);

if (missing.length > 0) {
  console.log(`\n⚠️  ${missing.length} package(s) not built yet. Run \`pnpm build\` first.\n`);
  for (const m of missing) {
    console.log(`   - ${m.name}`);
  }
  console.log('');
}

// Print table
const COL_NAME = 30;
const COL_RAW = 12;
const COL_GZIP = 12;

console.log(
  `${padRight('Package', COL_NAME)} ${padLeft('Raw (KB)', COL_RAW)} ${padLeft('Gzip (KB)', COL_GZIP)}`,
);
console.log('-'.repeat(65));

for (const s of sizes) {
  if (!s.exists) continue;
  console.log(
    `${padRight(s.name, COL_NAME)} ${padLeft(s.rawKB, COL_RAW)} ${padLeft(s.gzipKB, COL_GZIP)}`,
  );
}

console.log('-'.repeat(65));

// Core runtime total
const coreSizes = sizes.filter((s) => CORE_PACKAGES.includes(s.name.replace('@blaze-ng/', '')));
const coreBuilt = coreSizes.filter((s) => s.exists);
const coreGzipTotal = coreBuilt.reduce((sum, s) => sum + s.gzipBytes, 0);
const coreRawTotal = coreBuilt.reduce((sum, s) => sum + s.rawBytes, 0);
const coreGzipKB = coreGzipTotal / 1024;
const coreRawKB = coreRawTotal / 1024;

console.log(
  `${padRight('CORE RUNTIME TOTAL', COL_NAME)} ${padLeft(coreRawKB.toFixed(1), COL_RAW)} ${padLeft(coreGzipKB.toFixed(1), COL_GZIP)}`,
);

// All packages total
const allBuilt = sizes.filter((s) => s.exists);
const allGzipTotal = allBuilt.reduce((sum, s) => sum + s.gzipBytes, 0);
const allRawTotal = allBuilt.reduce((sum, s) => sum + s.rawBytes, 0);

console.log(
  `${padRight('ALL PACKAGES TOTAL', COL_NAME)} ${padLeft((allRawTotal / 1024).toFixed(1), COL_RAW)} ${padLeft((allGzipTotal / 1024).toFixed(1), COL_GZIP)}`,
);

console.log('='.repeat(65));

// Check against target
const passed = coreGzipKB <= CORE_GZIP_TARGET_KB;
if (coreBuilt.length === CORE_PACKAGES.length) {
  if (passed) {
    console.log(
      `\n✅ Core runtime: ${coreGzipKB.toFixed(1)} KB gzipped — UNDER ${CORE_GZIP_TARGET_KB} KB target`,
    );
  } else {
    console.log(
      `\n❌ Core runtime: ${coreGzipKB.toFixed(1)} KB gzipped — EXCEEDS ${CORE_GZIP_TARGET_KB} KB target by ${(coreGzipKB - CORE_GZIP_TARGET_KB).toFixed(1)} KB`,
    );
  }
} else {
  console.log(
    `\n⚠️  Only ${coreBuilt.length}/${CORE_PACKAGES.length} core packages built — cannot verify target.`,
  );
}

console.log('');

// Exit with error code if target exceeded (useful in CI)
if (coreBuilt.length === CORE_PACKAGES.length && !passed) {
  process.exit(1);
}

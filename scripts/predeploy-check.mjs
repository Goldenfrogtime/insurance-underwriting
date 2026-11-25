#!/usr/bin/env node
/**
 * CoverFlow Pre-Deploy Quality & Regression Guardrails
 * Catches subtle UI, schema, privacy, and secret-leak bugs before build/push.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

function walkFiles(dir, exts) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full, exts));
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

// 1. Dual Prisma Schema Parity (SQLite vs PostgreSQL)
const sqliteSchemaPath = path.join(rootDir, 'apps/api/prisma/schema.prisma');
const pgSchemaPath = path.join(rootDir, 'apps/api/prisma/schema.postgres.prisma');
const normalizeSchema = (src) =>
  src
    .replace(/provider\s*=\s*"(sqlite|postgresql)"/g, 'provider = "<DB>"')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

if (normalizeSchema(fs.readFileSync(sqliteSchemaPath, 'utf8')) !== normalizeSchema(fs.readFileSync(pgSchemaPath, 'utf8'))) {
  failures.push(
    'Prisma schema drift detected: apps/api/prisma/schema.prisma and schema.postgres.prisma do not match!',
  );
}

// 2. Frontend Interactive & File Upload Regression Checks
const webFiles = walkFiles(path.join(rootDir, 'apps/web/src'), ['.ts', '.tsx', '.css']);
for (const file of webFiles) {
  const rel = path.relative(rootDir, file);
  const text = fs.readFileSync(file, 'utf8');

  if (text.includes('visually-hidden')) {
    failures.push(
      `${rel}: uses "visually-hidden" which can un-hide on :active and break clicks. Use Tailwind "hidden" (for file inputs) or "sr-only" (for screen-reader labels/radios).`,
    );
  }

  // Check for file inputs that reset e.target.value synchronously before async handler
  const fileInputBlocks = text.match(/type="file"[\s\S]{0,400}?\/>/g) || [];
  for (const block of fileInputBlocks) {
    if (/e\.target\.value\s*=\s*['"]['"]\s*;\s*\n\s*[a-zA-Z]/.test(block)) {
      failures.push(
        `${rel}: resets e.target.value = '' synchronously before processing the selected File.`,
      );
    }
  }
}

// 3. Backend Secret-Leak Guard
const trackedSourceFiles = [
  ...walkFiles(path.join(rootDir, 'apps'), ['.ts', '.tsx', '.js', '.mjs', '.json', '.prisma']),
  ...walkFiles(path.join(rootDir, 'packages'), ['.ts', '.tsx', '.js', '.json']),
];
for (const file of trackedSourceFiles) {
  const rel = path.relative(rootDir, file);
  const text = fs.readFileSync(file, 'utf8');
  if (/postgresql:\/\/neondb_owner:npg_/i.test(text)) {
    failures.push(`${rel}: contains a hardcoded Neon DATABASE_URL credential!`);
  }
}

// 4. Report Results
if (failures.length > 0) {
  console.error('\n❌ CoverFlow Pre-Deploy Check FAILED:\n');
  for (const f of failures) {
    console.error(`  • ${f}`);
  }
  console.error('');
  process.exit(1);
}

console.log('✅ CoverFlow Pre-Deploy Check passed (Prisma parity, file-picker safety, secret scan).');

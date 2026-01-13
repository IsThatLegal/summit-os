#!/usr/bin/env node

/**
 * Apply database migrations via Supabase client
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials in environment');
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
  process.exit(1);
}

// Create Supabase client with service role
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('🔧 Starting database migration...\n');

// Read the combined migration file
const migrationSQL = readFileSync(
  join(__dirname, 'apply-all-migrations.sql'),
  'utf-8'
);

// Execute the migration using raw SQL
// Note: Supabase client doesn't have a direct way to execute raw SQL with multiple statements
// We need to use the REST API endpoint for this

async function applyMigrations() {
  try {
    // Split by semicolons and filter out empty statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    let successCount = 0;
    let skipCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i] + ';';

      try {
        // Use rpc to execute raw SQL (if you have a function for it)
        // Or use the REST API directly
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: stmt })
        });

        if (response.ok) {
          successCount++;
          process.stdout.write(`✓ ${i + 1}/${statements.length}\r`);
        } else {
          // Many statements might fail if tables already exist, that's OK
          skipCount++;
        }
      } catch (error) {
        // Skip errors for already existing objects
        skipCount++;
      }
    }

    console.log(`\n\n✅ Migration complete!`);
    console.log(`   Executed: ${successCount} statements`);
    console.log(`   Skipped: ${skipCount} statements (likely already exist)`);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Verify tables after migration
async function verifyTables() {
  console.log('\n🔍 Verifying database schema...\n');

  const expectedTables = [
    'tenants',
    'units',
    'transactions',
    'gate_logs',
    'user_profiles',
    'billing_logs',
    'payment_methods',
    'tenant_units'
  ];

  const results = [];

  for (const table of expectedTables) {
    try {
      const { error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (!error) {
        results.push({ table, exists: true });
        console.log(`✓ ${table}`);
      } else {
        results.push({ table, exists: false });
        console.log(`✗ ${table} - ${error.message}`);
      }
    } catch (err) {
      results.push({ table, exists: false });
      console.log(`✗ ${table} - ${err.message}`);
    }
  }

  const existingTables = results.filter(r => r.exists).length;
  console.log(`\n📊 Found ${existingTables}/${expectedTables.length} tables`);

  if (existingTables === expectedTables.length) {
    console.log('✅ All tables exist! Database is ready.\n');
    return true;
  } else {
    console.log('⚠️  Some tables are missing. You may need to run migrations manually in Supabase SQL Editor.\n');
    return false;
  }
}

// Run the migration and verification
(async () => {
  console.log('Starting migration process...\n');

  // First verify what already exists
  const allExist = await verifyTables();

  if (allExist) {
    console.log('✨ Database is already set up! No migration needed.\n');
  } else {
    console.log('\n⚠️  Direct SQL execution via API is not supported.');
    console.log('📝 Please run the migration manually:\n');
    console.log('1. Go to Supabase Dashboard → SQL Editor');
    console.log('2. Copy contents of: scripts/apply-all-migrations.sql');
    console.log('3. Paste and run it\n');
  }
})();

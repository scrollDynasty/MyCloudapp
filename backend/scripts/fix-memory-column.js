#!/usr/bin/env node

/**
 * Emergency Fix: Remove duplicate memory_gb column from vps_plans
 * 
 * Issue: Table has both 'memory_gb' and 'ram_gb' columns
 * Code uses 'ram_gb' but MySQL requires 'memory_gb' (no default)
 * 
 * Solution: Drop the memory_gb column
 */

require('dotenv').config();
const db = require('../core/db/connection');

async function fixMemoryColumn() {
  console.log('🔍 Checking vps_plans table structure...\n');
  
  try {
    // Get current columns
    const columns = await db.query('DESCRIBE vps_plans');
    console.log('Current columns in vps_plans:');
    columns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type}) ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Default !== null ? `DEFAULT ${col.Default}` : ''}`);
    });
    
    // Check if memory_gb exists
    const hasMemoryGb = columns.some(col => col.Field === 'memory_gb');
    const hasRamGb = columns.some(col => col.Field === 'ram_gb');
    
    console.log('\n📊 Column status:');
    console.log(`  memory_gb: ${hasMemoryGb ? '✅ EXISTS' : '❌ NOT FOUND'}`);
    console.log(`  ram_gb: ${hasRamGb ? '✅ EXISTS' : '❌ NOT FOUND'}`);
    
    if (hasMemoryGb && hasRamGb) {
      console.log('\n⚠️  DUPLICATE COLUMNS DETECTED!');
      console.log('Both memory_gb and ram_gb exist. Dropping memory_gb...\n');
      
      await db.query('ALTER TABLE vps_plans DROP COLUMN memory_gb');
      console.log('✅ Successfully dropped memory_gb column');
      
      // Show updated structure
      const newColumns = await db.query('DESCRIBE vps_plans');
      console.log('\n📋 Updated table structure:');
      newColumns.forEach(col => {
        console.log(`  - ${col.Field} (${col.Type})`);
      });
    } else if (hasMemoryGb && !hasRamGb) {
      console.log('\n⚠️  Table has memory_gb but not ram_gb!');
      console.log('Renaming memory_gb to ram_gb...\n');
      
      await db.query('ALTER TABLE vps_plans CHANGE COLUMN memory_gb ram_gb INT NOT NULL');
      console.log('✅ Successfully renamed memory_gb to ram_gb');
    } else if (hasRamGb) {
      console.log('\n✅ Table structure is correct (only ram_gb exists)');
    } else {
      console.log('\n❌ ERROR: Table has neither memory_gb nor ram_gb!');
      process.exit(1);
    }
    
    console.log('\n✅ Fix completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the fix
fixMemoryColumn();

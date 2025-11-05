/**
 * Migration Script: Add Email Verification Support
 * Создание таблицы email_verification_tokens и обновление users
 */

const fs = require('fs');
const path = require('path');
const db = require('../core/db/connection');

async function runMigration() {
  try {
    console.log('📧 Starting email verification migration...');
    
    // Read migration file
    const migrationPath = path.join(__dirname, '../migrations/003-add-email-verification.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split by semicolons to execute each statement separately
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`\n▶️  Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        await db.query(statement);
        console.log(`✅ Statement ${i + 1} executed successfully`);
      } catch (error) {
        // Ignore errors for statements that might fail if already executed
        if (error.code === 'ER_DUP_FIELDNAME' || 
            error.code === 'ER_TABLE_EXISTS_ERROR' ||
            error.code === 'ER_DUP_KEYNAME') {
          console.log(`ℹ️  Statement ${i + 1} skipped (already exists)`);
        } else {
          throw error;
        }
      }
    }
    
    console.log('\n✅ Email verification migration completed successfully!');
    console.log('\n📊 Checking migration results...');
    
    // Verify the table exists
    const tables = await db.query('SHOW TABLES LIKE "email_verification_tokens"');
    if (tables.length > 0) {
      console.log('✅ email_verification_tokens table created');
      
      // Show table structure
      const structure = await db.query('DESCRIBE email_verification_tokens');
      console.log('\n📋 Table structure:');
      structure.forEach(col => {
        console.log(`  - ${col.Field} (${col.Type})`);
      });
    }
    
    // Check verified_at column
    const columns = await db.query('SHOW COLUMNS FROM users LIKE "verified_at"');
    if (columns.length > 0) {
      console.log('\n✅ verified_at column added to users table');
    }
    
    // Check email_verified column
    const emailVerifiedCol = await db.query('SHOW COLUMNS FROM users LIKE "email_verified"');
    if (emailVerifiedCol.length > 0) {
      console.log('✅ email_verified column exists in users table');
    }
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📧 Email verification system is now ready to use.');
    console.log('⚠️  Remember to configure SMTP settings in .env:');
    console.log('   - SMTP_HOST');
    console.log('   - SMTP_PORT');
    console.log('   - SMTP_USER');
    console.log('   - SMTP_PASS');
    console.log('   - FRONTEND_URL (for verification links)');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run migration
runMigration();


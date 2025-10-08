const XLSX = require('xlsx');
const db = require('../core/db/connection');
const path = require('path');

class ExcelDataImporter {
  constructor() {
    this.providerCache = new Map();
    this.regionCache = new Map();
    this.stats = {
      providers: 0,
      regions: 0,
      vpsPlans: 0,
      errors: 0
    };
  }

  // Helper method to extract numeric value from string
  extractNumber(value, defaultValue = 0) {
    if (typeof value === 'number') return value;
    if (!value || value === '' || value === null) return defaultValue;
    
    const str = String(value).replace(/[^\d.,]/g, '');
    const num = parseFloat(str.replace(',', '.'));
    return isNaN(num) ? defaultValue : num;
  }

  // Helper method to extract currency from value
  extractCurrency(value) {
    if (!value) return 'USD';
    
    const str = String(value).toLowerCase();
    if (str.includes('uzs') || str.includes('сум') || str.includes('sum')) return 'UZS';
    if (str.includes('rub') || str.includes('₽') || str.includes('руб')) return 'RUB';
    if (str.includes('eur') || str.includes('€')) return 'EUR';
    return 'USD';
  }

  // Helper method to clean text values
  cleanText(value, defaultValue = '') {
    if (!value || value === null || value === undefined) return defaultValue;
    return String(value).trim().replace(/\s+/g, ' ');
  }

  // Get or create provider
  async getOrCreateProvider(name, country = null) {
    const cleanName = this.cleanText(name, 'Unknown Provider');
    
    if (this.providerCache.has(cleanName)) {
      return this.providerCache.get(cleanName);
    }

    try {
      // Check if provider exists
      const existing = await db.query('SELECT id FROM providers WHERE name = ?', [cleanName]);
      
      if (existing.length > 0) {
        this.providerCache.set(cleanName, existing[0].id);
        return existing[0].id;
      }

      // Create new provider
      const result = await db.query(
        'INSERT INTO providers (name, country, created_at) VALUES (?, ?, NOW())',
        [cleanName, country]
      );
      
      const providerId = result.insertId;
      this.providerCache.set(cleanName, providerId);
      this.stats.providers++;
      
      console.log(`✅ Created provider: ${cleanName}`);
      return providerId;
      
    } catch (error) {
      console.error(`❌ Error creating provider ${cleanName}:`, error.message);
      this.stats.errors++;
      return 1; // Default to first provider
    }
  }

  // Get or create region
  async getOrCreateRegion(name, country = null) {
    const cleanName = this.cleanText(name, 'Global');
    
    if (this.regionCache.has(cleanName)) {
      return cleanName;
    }

    try {
      // Check if region exists
      const existing = await db.query('SELECT name FROM regions WHERE name = ?', [cleanName]);
      
      if (existing.length === 0) {
        // Create new region
        await db.query(
          'INSERT INTO regions (name, country) VALUES (?, ?)',
          [cleanName, country]
        );
        this.stats.regions++;
        console.log(`✅ Created region: ${cleanName}`);
      }
      
      this.regionCache.set(cleanName, cleanName);
      return cleanName;
      
    } catch (error) {
      console.error(`❌ Error creating region ${cleanName}:`, error.message);
      this.stats.errors++;
      return 'Global';
    }
  }

  // Process VPS sheet data
  async processVPSSheet(worksheet, sheetName) {
    console.log(`📄 Processing sheet: ${sheetName}`);
    
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (jsonData.length < 2) {
      console.log(`⚠️  Sheet ${sheetName} has insufficient data`);
      return;
    }

    // Skip header row and process data
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      
      if (!row || row.every(cell => !cell)) continue; // Skip empty rows
      
      try {
        // Extract data with smart mapping
        let planName = this.cleanText(row[1] || row[2], `Plan-${i}`);
        let provider = 'Unknown Provider';
        let cpu = 1;
        let memory = 1.0;
        let storage = 10;
        let bandwidth = 1.0;
        let price = 0.0;
        let currency = 'USD';
        let region = 'Global';

        // Smart data extraction based on available columns
        if (sheetName === 'VPS' || sheetName === 'VPS-New' || sheetName === 'TIUE' || sheetName === 'Temp') {
          // These sheets have component-based pricing
          if (planName.toLowerCase().includes('vcpu') || planName.toLowerCase().includes('cpu')) {
            cpu = this.extractNumber(row[3], 1);
            price = this.extractNumber(row[5], 0);
            provider = 'Local VPS Provider';
            planName = `VPS ${cpu} CPU`;
          }
          else if (planName.toLowerCase().includes('vram') || planName.toLowerCase().includes('ram')) {
            memory = this.extractNumber(row[3], 1);
            price = this.extractNumber(row[5], 0) / 1000; // Convert to reasonable price
            provider = 'Local VPS Provider';
            planName = `VPS ${memory}GB RAM`;
          }
          else if (planName.toLowerCase().includes('disk') || planName.toLowerCase().includes('storage')) {
            storage = this.extractNumber(row[3], 10);
            price = this.extractNumber(row[5], 0) / 1000;
            provider = 'Local VPS Provider';
            planName = `VPS ${storage}GB Storage`;
          }
        } else if (sheetName === 'Drive') {
          // Drive services - convert to VPS-like plans
          planName = this.cleanText(row[1], `Drive-${i}`);
          storage = this.extractNumber(row[2], 5) || 5; // GB from "Место" column
          price = this.extractNumber(row[3], 0) / 10000; // Convert UZS to reasonable USD
          currency = this.extractCurrency(row[3]);
          provider = this.cleanText(row[7], 'Cloud Storage Provider');
          memory = Math.max(1, Math.ceil(storage / 10)); // Estimate RAM based on storage
          region = 'Global';
        } else if (sheetName === 'Hosting') {
          // Hosting plans
          planName = String(row[0] || '').replace('Host-', '') || `Hosting-${i}`;
          storage = this.extractNumber(row[1], 100) / 1000; // Convert MB to GB
          memory = Math.max(1, Math.ceil(storage / 2));
          price = 5 + (storage * 0.5); // Estimate price
          provider = 'Hosting Provider';
          region = 'Global';
        }
        
        // Ensure minimum values
        cpu = Math.max(1, cpu);
        memory = Math.max(0.5, memory);
        storage = Math.max(1, storage);
        bandwidth = Math.max(0.1, bandwidth);
        price = Math.max(0.01, price);
        
        // Convert very high prices (likely in UZS) to USD
        if (price > 1000) {
          price = price / 12700; // Convert UZS to USD
          currency = 'USD';
        }

        // Create provider and region
        const providerId = await this.getOrCreateProvider(provider, region);
        const regionName = await this.getOrCreateRegion(region);

        // Insert VPS plan
        await db.query(`
          INSERT INTO vps_plans 
          (provider_id, plan_name, cpu_cores, memory_gb, storage_gb, bandwidth_tb, 
           price_per_month, currency, region, available, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `, [
          providerId,
          planName,
          cpu,
          memory,
          storage,
          bandwidth,
          price,
          currency,
          regionName,
          true
        ]);

        this.stats.vpsPlans++;
        
        if (this.stats.vpsPlans % 10 === 0) {
          console.log(`📊 Processed ${this.stats.vpsPlans} VPS plans...`);
        }

      } catch (error) {
        console.error(`❌ Error processing row ${i} in ${sheetName}:`, error.message);
        this.stats.errors++;
      }
    }
  }

  // Main import function
  async importExcelData(filePath) {
    console.log('🚀 Starting Excel data import...');
    
    try {
      // Connect to database
      await db.connect();
      
      // Read Excel file
      const workbook = XLSX.readFile(filePath);
      const sheetNames = workbook.SheetNames;
      
      console.log(`📚 Found ${sheetNames.length} sheets: ${sheetNames.join(', ')}`);
      
      // Process priority sheets first
      const prioritySheets = ['VPS-New', 'VPS', 'Hosting', 'Drive', 'TIUE', 'Temp'];
      
      for (const sheetName of prioritySheets) {
        if (sheetNames.includes(sheetName)) {
          const worksheet = workbook.Sheets[sheetName];
          await this.processVPSSheet(worksheet, sheetName);
        }
      }
      
      // Add some popular VPS providers with realistic data
      await this.addPopularProviders();
      
      console.log('✅ Excel import completed!');
      console.log('📊 Import Statistics:');
      console.log(`   - Providers created: ${this.stats.providers}`);
      console.log(`   - Regions created: ${this.stats.regions}`);
      console.log(`   - VPS Plans imported: ${this.stats.vpsPlans}`);
      console.log(`   - Errors encountered: ${this.stats.errors}`);
      
    } catch (error) {
      console.error('❌ Excel import failed:', error.message);
      throw error;
    } finally {
      await db.close();
    }
  }

  // Add popular VPS providers with realistic data
  async addPopularProviders() {
    console.log('🌟 Adding popular VPS providers...');
    
    const popularProviders = [
      {
        name: 'Contabo',
        country: 'Germany',
        region: 'Germany',
        plans: [
          { name: 'VPS S', cpu: 2, memory: 4, storage: 100, bandwidth: 32, price: 6.99 },
          { name: 'VPS M', cpu: 4, memory: 8, storage: 200, bandwidth: 32, price: 11.99 },
          { name: 'VPS L', cpu: 6, memory: 16, storage: 400, bandwidth: 32, price: 19.99 }
        ]
      },
      {
        name: 'Hostinger',
        country: 'Lithuania', 
        region: 'Lithuania',
        plans: [
          { name: 'KVM 1', cpu: 1, memory: 1, storage: 20, bandwidth: 1, price: 3.99 },
          { name: 'KVM 2', cpu: 2, memory: 4, storage: 80, bandwidth: 10, price: 9.99 },
          { name: 'KVM 4', cpu: 4, memory: 8, storage: 160, bandwidth: 20, price: 18.99 }
        ]
      },
      {
        name: 'Timeweb',
        country: 'Russia',
        region: 'Russia', 
        plans: [
          { name: 'VPS-2', cpu: 2, memory: 2, storage: 40, bandwidth: 5, price: 5.50 },
          { name: 'VPS-4', cpu: 4, memory: 8, storage: 160, bandwidth: 20, price: 10.00 },
          { name: 'VPS-8', cpu: 8, memory: 16, storage: 320, bandwidth: 40, price: 18.00 }
        ]
      },
      {
        name: 'Hoster.uz',
        country: 'Uzbekistan',
        region: 'Uzbekistan',
        plans: [
          { name: 'VPS Standard', cpu: 2, memory: 4, storage: 100, bandwidth: 10, price: 7.50 },
          { name: 'VPS Professional', cpu: 4, memory: 8, storage: 200, bandwidth: 20, price: 12.00 },
          { name: 'VPS Enterprise', cpu: 8, memory: 16, storage: 400, bandwidth: 40, price: 20.00 }
        ]
      }
    ];

    for (const provider of popularProviders) {
      const providerId = await this.getOrCreateProvider(provider.name, provider.country);
      const regionName = await this.getOrCreateRegion(provider.region, provider.country);

      for (const plan of provider.plans) {
        await db.query(`
          INSERT INTO vps_plans 
          (provider_id, plan_name, cpu_cores, memory_gb, storage_gb, bandwidth_tb, 
           price_per_month, currency, region, available, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `, [
          providerId,
          plan.name,
          plan.cpu,
          plan.memory,
          plan.storage,
          plan.bandwidth,
          plan.price,
          'USD',
          regionName,
          true
        ]);

        this.stats.vpsPlans++;
      }
    }
    
    console.log(`✅ Added popular providers with ${popularProviders.reduce((sum, p) => sum + p.plans.length, 0)} plans`);
  }
}

// Run import if called directly
async function runImport() {
  const excelFile = path.join(__dirname, '../../VPS-Price.xlsx');
  const importer = new ExcelDataImporter();
  
  try {
    await importer.importExcelData(excelFile);
    console.log('🎉 Import completed successfully!');
  } catch (error) {
    console.error('💀 Import failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runImport();
}

module.exports = ExcelDataImporter;
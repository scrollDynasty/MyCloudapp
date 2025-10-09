#!/usr/bin/env node

/**
 * Комплексное исправление таблицы vps_plans
 * 
 * Проблемы:
 * 1. Дубликаты колонок: memory_gb + ram_gb, price_per_month + price_monthly, plan_name + name
 * 2. Код использует: name, ram_gb, bandwidth_gb, price_monthly
 * 3. Таблица имеет: plan_name, memory_gb, bandwidth_tb, price_per_month
 * 
 * Решение: Оставляем только те колонки, которые использует код
 */

require('dotenv').config();
const db = require('../core/db/connection');

async function fixAllColumns() {
  console.log('🔧 Комплексное исправление таблицы vps_plans...\n');
  
  try {
    // Получаем текущую структуру
    const columns = await db.query('DESCRIBE vps_plans');
    console.log('📋 Текущие колонки:');
    columns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type})`);
    });
    console.log('');
    
    // Проверяем наличие проблемных колонок
    const columnNames = columns.map(c => c.Field);
    
    const hasPlanName = columnNames.includes('plan_name');
    const hasName = columnNames.includes('name');
    const hasMemoryGb = columnNames.includes('memory_gb');
    const hasRamGb = columnNames.includes('ram_gb');
    const hasPricePerMonth = columnNames.includes('price_per_month');
    const hasPriceMonthly = columnNames.includes('price_monthly');
    const hasBandwidthTb = columnNames.includes('bandwidth_tb');
    const hasBandwidthGb = columnNames.includes('bandwidth_gb');
    
    console.log('🔍 Анализ колонок:');
    console.log(`  plan_name: ${hasPlanName ? '✅' : '❌'} | name: ${hasName ? '✅' : '❌'} (нужен: name)`);
    console.log(`  memory_gb: ${hasMemoryGb ? '✅' : '❌'} | ram_gb: ${hasRamGb ? '✅' : '❌'} (нужен: ram_gb)`);
    console.log(`  price_per_month: ${hasPricePerMonth ? '✅' : '❌'} | price_monthly: ${hasPriceMonthly ? '✅' : '❌'} (нужен: price_monthly)`);
    console.log(`  bandwidth_tb: ${hasBandwidthTb ? '✅' : '❌'} | bandwidth_gb: ${hasBandwidthGb ? '✅' : '❌'} (нужен: bandwidth_gb)`);
    console.log('');
    
    let changesMade = false;
    
    // 1. Исправляем plan_name → name
    if (hasPlanName && !hasName) {
      console.log('🔄 Переименовываю plan_name → name');
      await db.query('ALTER TABLE vps_plans CHANGE COLUMN plan_name name VARCHAR(255) NOT NULL');
      changesMade = true;
    } else if (hasPlanName && hasName) {
      console.log('🗑️  Удаляю дубликат plan_name (оставляю name)');
      await db.query('ALTER TABLE vps_plans DROP COLUMN plan_name');
      changesMade = true;
    }
    
    // 2. Исправляем memory_gb → ram_gb
    if (hasMemoryGb && !hasRamGb) {
      console.log('🔄 Переименовываю memory_gb → ram_gb');
      await db.query('ALTER TABLE vps_plans CHANGE COLUMN memory_gb ram_gb INT NOT NULL');
      changesMade = true;
    } else if (hasMemoryGb && hasRamGb) {
      console.log('🗑️  Удаляю дубликат memory_gb (оставляю ram_gb)');
      await db.query('ALTER TABLE vps_plans DROP COLUMN memory_gb');
      changesMade = true;
    }
    
    // 3. Исправляем price_per_month → price_monthly
    if (hasPricePerMonth && !hasPriceMonthly) {
      console.log('🔄 Переименовываю price_per_month → price_monthly');
      await db.query('ALTER TABLE vps_plans CHANGE COLUMN price_per_month price_monthly DECIMAL(10,2) NOT NULL');
      changesMade = true;
    } else if (hasPricePerMonth && hasPriceMonthly) {
      console.log('🗑️  Удаляю дубликат price_per_month (оставляю price_monthly)');
      await db.query('ALTER TABLE vps_plans DROP COLUMN price_per_month');
      changesMade = true;
    }
    
    // 4. Исправляем bandwidth_tb → bandwidth_gb
    if (hasBandwidthTb && !hasBandwidthGb) {
      console.log('🔄 Переименовываю bandwidth_tb → bandwidth_gb');
      await db.query('ALTER TABLE vps_plans CHANGE COLUMN bandwidth_tb bandwidth_gb INT NOT NULL');
      changesMade = true;
    } else if (hasBandwidthTb && hasBandwidthGb) {
      console.log('🗑️  Удаляю дубликат bandwidth_tb (оставляю bandwidth_gb)');
      await db.query('ALTER TABLE vps_plans DROP COLUMN bandwidth_tb');
      changesMade = true;
    }
    
    if (!changesMade) {
      console.log('✅ Структура таблицы уже правильная!');
    } else {
      // Показываем итоговую структуру
      console.log('\n📋 Итоговая структура:');
      const finalColumns = await db.query('DESCRIBE vps_plans');
      finalColumns.forEach(col => {
        const marker = ['name', 'ram_gb', 'price_monthly', 'bandwidth_gb'].includes(col.Field) ? '✅' : '  ';
        console.log(`${marker} ${col.Field} (${col.Type})`);
      });
      
      console.log('\n✅ Все исправления применены!');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
    process.exit(1);
  }
}

// Запуск
fixAllColumns();

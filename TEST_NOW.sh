#!/bin/bash

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           🧪 Тестирование Payme Integration                  ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Check if backend server is running
if ! curl -s http://localhost:5000 > /dev/null 2>&1; then
    echo "⚠️  Backend сервер не запущен!"
    echo ""
    echo "Запустите сервер в другом терминале:"
    echo "   cd backend"
    echo "   npm start"
    echo ""
    exit 1
fi

echo "✅ Backend сервер работает на http://localhost:5000"
echo ""

# Test Payme callback
echo "🔍 Тестирование Payme callback API..."
echo ""

cd backend

if [ ! -f "test-payme-callback.js" ]; then
    echo "❌ Файл test-payme-callback.js не найден!"
    exit 1
fi

# Get order ID from argument or use default
ORDER_ID=${1:-14}
AMOUNT=${2:-65000}

echo "📋 Параметры теста:"
echo "   Order ID: $ORDER_ID"
echo "   Amount: $AMOUNT UZS"
echo ""
echo "═════════════════════════════════════════════════════════════"
echo ""

node test-payme-callback.js $ORDER_ID $AMOUNT

echo ""
echo "═════════════════════════════════════════════════════════════"
echo ""

if [ $? -eq 0 ]; then
    echo "✅ Тест успешно завершен!"
    echo ""
    echo "📝 Проверьте статус заказа $ORDER_ID - он должен быть 'paid'"
    echo ""
    echo "Следующие шаги:"
    echo "1. Проверьте заказ в приложении"
    echo "2. Попробуйте создать новый платеж через Payme"
    echo "3. Если ошибка '[object Object]' осталась - обновите Merchant ID"
    echo ""
    echo "📖 Инструкции: QUICK_START.md"
else
    echo "❌ Тест завершился с ошибкой"
    echo ""
    echo "Возможные причины:"
    echo "• Заказ $ORDER_ID не существует"
    echo "• Заказ уже оплачен"
    echo "• База данных недоступна"
    echo ""
    echo "Создайте новый заказ и попробуйте снова:"
    echo "   ./TEST_NOW.sh <new_order_id> <amount>"
fi

echo ""

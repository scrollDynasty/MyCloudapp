# MyCloud CRM System

Административная панель для управления клиентской базой данных MyCloud.

## 🚀 Функционал

### ✅ Реализовано

- **Аутентификация**: Вход только для админов (проверка роли в БД)
- **Dashboard**: Статистика по пользователям, заказам, выручке
- **Управление Пользователями**:
  - Просмотр всех пользователей
  - Поиск по имени, email, username
  - Фильтры по роли (admin/individual/company) и статусу
  - Добавление новых пользователей
  - Редактирование данных
  - Удаление пользователей
  - Статистика: всего, активных, админов, компаний
  
- **Управление Заказами**:
  - Просмотр всех заказов
  - Поиск по номеру заказа, email, ID
  - Фильтры по статусу заказа и оплаты
  - Просмотр деталей заказа
  - Обновление статуса (активация, приостановка, отмена)
  - Статистика: всего, ожидающих оплату, оплаченных, активных, выручка

- **Управление Сервисами**:
  - VPS планы
  - Группы сервисов
  - Планы сервисов

## 🛠 Технологии

- **Frontend**: React 19 + Vite 7.1.12
- **Routing**: React Router DOM
- **State Management**: TanStack Query (React Query) + Zustand
- **HTTP Client**: Axios with JWT interceptors
- **UI**: Tailwind CSS v4 (@tailwindcss/postcss)
- **Icons**: Lucide React
- **Charts**: Recharts
- **Dates**: date-fns

## 📦 Установка

```bash
# 1. Установите зависимости
npm install

# 2. Создайте файл .env
cp .env.example .env

# 3. Настройте переменные окружения в .env
VITE_API_URL=https://apibilling.mycloud.uz/api

# 4. Запустите dev сервер
npm run dev
```

Приложение откроется на http://localhost:5173

## 🏗 Сборка для продакшена

```bash
# Собрать проект
npm run build

# Папка dist/ готова к деплою
```

## 🌐 Деплой

CRM система будет доступна по адресу: **https://crm.mycloud.uz**

### Требования:

1. Загрузить содержимое папки `dist/` на сервер
2. Настроить веб-сервер (nginx/apache) для обслуживания SPA:
   - Все запросы должны перенаправляться на index.html
   - Настроить CORS заголовки

### Пример конфигурации Nginx:

```nginx
server {
    listen 80;
    server_name crm.mycloud.uz;

    root /var/www/crm/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Кэширование статических файлов
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## 🔐 Безопасность

- Доступ разрешён **только администраторам** (проверка в Login.jsx)
- JWT токены хранятся в localStorage (`crm_token`, `crm_user`)
- Автоматический logout при 401 ответе от API
- CORS настроен на бэкенде для домена crm.mycloud.uz

## 🔌 API Endpoints

Backend API: `https://apibilling.mycloud.uz/api`

### Аутентификация
- `POST /auth/login` - Вход в систему
- `GET /auth/users` - Список всех пользователей (admin only)
- `GET /auth/users/:id` - Информация о пользователе
- `POST /auth/register` - Создать пользователя
- `PUT /auth/users/:id` - Обновить пользователя
- `DELETE /auth/users/:id` - Удалить пользователя

### Заказы
- `GET /orders` - Список всех заказов
- `GET /orders/:id` - Детали заказа
- `PUT /orders/:id/status` - Обновить статус заказа

### Сервисы
- `GET /vps` - Список VPS планов
- `GET /service-groups` - Список групп сервисов
- `GET /service-plans` - Список планов сервисов

## 📁 Структура проекта

```
crm-mobile-web/
├── src/
│   ├── assets/         # Статические файлы
│   ├── components/     # React компоненты
│   │   └── Layout.jsx  # Основной лейаут с навигацией
│   ├── lib/
│   │   └── api.js      # Axios client с JWT
│   ├── pages/          # Страницы приложения
│   │   ├── Login.jsx   # Страница входа
│   │   ├── Dashboard.jsx  # Главная панель
│   │   ├── Users.jsx   # Управление пользователями
│   │   ├── Orders.jsx  # Управление заказами
│   │   ├── VPSPlans.jsx  # VPS планы
│   │   ├── ServiceGroups.jsx  # Группы сервисов
│   │   └── ServicePlans.jsx   # Планы сервисов
│   ├── App.jsx         # Главный компонент
│   ├── main.jsx        # Точка входа
│   └── index.css       # Tailwind CSS
├── .env                # Переменные окружения
├── .env.example        # Пример .env
├── package.json        # Зависимости
├── vite.config.js      # Конфигурация Vite
├── tailwind.config.js  # Конфигурация Tailwind
└── postcss.config.js   # Конфигурация PostCSS
```

## 🐛 Отладка

### Проблема: Не загружаются данные

1. Проверьте, что бэкенд API запущен: https://apibilling.mycloud.uz/api
2. Откройте DevTools → Network и проверьте запросы
3. Убедитесь, что CORS настроен правильно на бэкенде

### Проблема: 401 Unauthorized

1. Проверьте, что пользователь имеет роль `admin` в БД
2. Проверьте наличие токена в localStorage (`crm_token`)
3. Проверьте срок действия JWT токена

### Проблема: Не работает Tailwind CSS

1. Убедитесь, что установлен `@tailwindcss/postcss`
2. Проверьте postcss.config.js:
   ```javascript
   export default {
     plugins: {
       '@tailwindcss/postcss': {},
       autoprefixer: {}
     }
   }
   ```

## 📝 Лицензия

Proprietary - MyCloud Internal Use Only

## 👨‍💻 Разработка

Developed for MyCloud billing system management.

Backend: Node.js + Express + MariaDB
Frontend: React + Vite + Tailwind CSS

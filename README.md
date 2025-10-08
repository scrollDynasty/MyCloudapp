# VPS Billing System

## 🚀 Запуск

### Backend
```bash
cd backend
node app.js
# Backend: http://localhost:5000
```

### Frontend
```bash
npx expo start
# Frontend: http://localhost:8081 (нажмите 'w' для web)
```

## � Тестовые данные для входа

| Email | Password | Role |
|-------|----------|------|
| admin@vps-billing.com | admin123 | admin |
| john@individual.com | user123 | individual |
| test@test.com | test123 | individual |
| info@techcorp.uz | legal123 | legal_entity |

## 🔧 Google OAuth Настройка

**Ошибка: Error 400: redirect_uri_mismatch**

**Решение - в Google Cloud Console:**
1. https://console.cloud.google.com/apis/credentials
2. OAuth 2.0 Client: `735617581412-e8ceb269bj7qqrv9sl066q63g5dr5sne`
3. Добавьте в "Authorized redirect URIs":
   ```
   http://localhost:5000/api/auth/google/callback
   ```
4. Сохраните, перезапустите backend

## 📊 Система

- 6 пользователей, 145 VPS планов, 14 провайдеров
- База: MariaDB `vps_billing`
- Backend показывает детальные логи для отладки

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

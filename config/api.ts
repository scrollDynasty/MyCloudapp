// API Configuration
// Automatically uses correct URL from .env file

export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://apibilling.mycloud.uz';

// For local development, you can override in .env:
// EXPO_PUBLIC_API_URL=http://localhost:5000

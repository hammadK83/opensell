# OpenSell

OpenSell is a full-stack marketplace application that enables users to buy and sell items through a modern mobile experience. The project consists of a React Native mobile application backed by a scalable Node.js/Express REST API, providing secure authentication, user management, and marketplace functionality.

The project was built to demonstrate production-oriented software engineering practices including modular architecture, type safety, authentication, API design, and clean code organization.

---

## Features

- User registration and login
- Secure JWT authentication
- Refresh token support
- Email verification
- User profile management
- Create, edit, and delete marketplace listings
- Browse available listings
- Input validation
- Responsive mobile UI
- RESTful API architecture

---

## Tech Stack

### Mobile

- React Native (Expo)
- TypeScript
- Redux Toolkit
- React Navigation
- Axios
- React Hook Form
- NativeWind (Tailwind CSS)
- Expo SecureStore

### Backend

- Node.js
- Express
- TypeScript
- MongoDB
- Mongoose
- JWT Authentication
- Zod Validation
- Nodemailer
- bcrypt

---

## Architecture

The backend follows a layered architecture to improve maintainability and separation of concerns.

```
Backend
│
├── Controllers
├── Services
├── Models
├── Routes
├── Middleware
├── Validation
├── Utilities
└── Configuration
```

The mobile application is organized into feature-based modules with reusable components, centralized state management, and API services.

---

## Authentication

Authentication includes:

- JWT access tokens
- Refresh tokens
- Password hashing with bcrypt
- Protected routes
- Email verification
- Secure token storage using Expo SecureStore

---

## API

The backend exposes RESTful endpoints for:

- Authentication
- User management
- Marketplace listings
- Account operations

Communication between the mobile application and backend is handled using Axios with centralized request configuration and error handling.

---

## Future Improvements

Planned enhancements include:

- Image uploads
- Real-time messaging between buyers and sellers
- Push notifications
- Search and filtering
- Favorites and saved listings
- Pagination
- Location-based search

---

## Getting Started

### Prerequisites

- Node.js `22.13.1` and npm `10.9.2` (see `.node-version` and `packageManager`). Expo SDK 55 requires Node 20.19.x or newer, React Native requires Node `>=20.19.4`, and the MongoDB driver and test server require Node `>=20.19.0`.
- MongoDB for backend development. Backend automated tests use MongoMemoryServer, which downloads MongoDB `8.2.6` the first time; test execution needs access to that binary or an existing MongoMemoryServer cache.
- Internet access for `npm ci`, the first MongoMemoryServer run, and Expo package metadata/assets used during export.

Install dependencies once from the repository root:

```powershell
npm ci
```

Build and check commands are also run from the root. `npm run build` builds shared before backend; individual backend build, type-check, and tests require the shared package to have been built first. `npm run test:shared` also requires a prior shared build because it imports the built public package entry. `npm run verify` performs the full local verification sequence and builds shared once.

```powershell
npm run build
npm run typecheck
npm run lint
npm run test:shared
npm run test:backend
npm run test:mobile
npm run export:android
npm run export:ios
npm run verify
```

The test commands use isolated MongoMemoryServer databases and mocked SMTP; they do not need a live database or email credentials. The backend test command pins the MongoDB binary to `8.2.6` for reproducibility.

The Android and iOS exports use `https://api.example.invalid` as a non-secret verification URL, disable Expo dotenv loading, and write ignored output under `apps/mobile/.expo/verification/`. Exports verify JavaScript and asset bundling only; they do not compile native projects or validate behavior on a device. The API URL startup rules remain covered by mobile unit tests.

To run the backend locally, configure `apps/backend/.env.development` using `apps/backend/.env.example`, provision the documented database indexes with the backend `indexes:apply` command when needed, then run:

```powershell
npm run dev:backend
```

To start the mobile app, configure `EXPO_PUBLIC_API_URL` for your development API and run:

```powershell
npm run start --workspace=mobile
```

---

## Author

**Hammad Khalid**

GitHub: https://github.com/hammadK83

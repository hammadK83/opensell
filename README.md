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

- Node.js
- npm
- MongoDB
- Expo CLI

### Backend

```bash
cd backend

npm install

npm run dev
```

### Mobile

```bash
cd mobile

npm install

npx expo start
```

Configure the required environment variables before running the application.

---

## Author

**Hammad Khalid**

GitHub: https://github.com/hammadK83

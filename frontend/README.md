# Studigi frontend (placeholder)

This folder is intended for the React single-page app. Key integration points:

- Fetch branding: `GET /api/branding` — returns `{ logo, header_color }` and should be applied to the header.
- Auth: use `POST /api/auth/login` to obtain JWT; send in `Authorization: Bearer <token>`.
- Materials: access material URLs returned by `/api/materials/:id` only if purchased.

Mobile responsiveness: design mobile-first with CSS flexbox and responsive breakpoints.
# SKD CPNS Tryout Frontend

Frontend React untuk sistem tryout SKD CPNS.

## Installation

```bash
cd frontend
npm install
```

## Running

### Development mode:
```bash
npm start
```

Frontend akan berjalan di `http://localhost:3000`

### Production build:
```bash
npm run build
```

## Features

- ✅ User authentication (login, register)
- ✅ Password reset via email
- ✅ Browse and purchase packages
- ✅ Shopping cart with bulk discount
- ✅ Quiz interface dengan timer 100 menit
- ✅ Real-time score calculation
- ✅ Result pembahasan on-demand
- ✅ Admin dashboard
- ✅ Package management
- ✅ Excel question import
- ✅ Responsive design

## Project Structure

```
frontend/
├── public/
├── src/
│   ├── components/      # Reusable components
│   ├── pages/          # Page components
│   ├── services/       # API service calls
│   ├── context/        # React context
│   ├── styles/         # CSS files
│   ├── App.js          # Main app component
│   └── index.js        # Entry point
└── package.json
```

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

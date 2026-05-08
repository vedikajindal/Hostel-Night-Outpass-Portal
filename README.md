# 🏫 Hostel Outpass Approval Portal

## 📁 Project Structure

```
hostel-outpass/
├── backend/              ← Node.js + Express server (run from here)
│   ├── server.js
│   ├── package.json
│   ├── .env.example
│   ├── database/
│   │   ├── db.js
│   │   └── init.js
│   ├── middleware/
│   │   └── auth.js
│   └── routes/
│       ├── auth.js
│       ├── student.js
│       ├── parent.js
│       └── warden.js
└── frontend/
    ├── index.html
    ├── css/
    ├── js/
    └── pages/
```

---

## 🚀 Setup — Exact Commands

### Step 1 — Go into the backend folder
```
cd hostel-outpass\backend
```

### Step 2 — Install dependencies (no build tools needed!)
```
npm install
```

### Step 3 — Create your .env file
```
copy .env.example .env
```

### Step 4 — Initialize the database (ONE TIME ONLY)
```
node database/init.js
```

### Step 5 — Start the server
```
node server.js
```

### Step 6 — Open in browser
**http://localhost:3000**

---

## 🔑 Demo Credentials

| Role    | User ID | Password   |
|---------|---------|------------|
| Student | STU001  | student123 |
| Student | STU002  | student456 |
| Parent  | PAR001  | parent123  |
| Parent  | PAR002  | parent456  |
| Warden  | WAR001  | warden123  |

---

## ✅ No Visual Studio / Build Tools Required

This version uses **sql.js** (pure JavaScript SQLite) instead of better-sqlite3.
It works on any Windows machine with just Node.js installed — no C++ compiler needed.

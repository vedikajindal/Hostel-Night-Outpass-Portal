require('dotenv').config();

const express      = require('express');
const cookieParser = require('cookie-parser');
const cors         = require('cors');
const helmet       = require('helmet');
const morgan       = require('morgan');
const rateLimit    = require('express-rate-limit');
const path         = require('path');
const { initDB }   = require('./database/db');

const app  = express();
const PORT = process.env.PORT || 3000;
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc:    ["'self'"],
            scriptSrc:     ["'self'", "'unsafe-inline'"],
            scriptSrcAttr: ["'unsafe-inline'"], 
            styleSrc:      ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc:       ["'self'", "https://fonts.gstatic.com"],
            imgSrc:        ["'self'", "data:"]
        }
    }
}));
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false
});

const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: { success: false, message: 'Too many requests.' }
});

app.use(generalLimiter);
app.use(morgan('dev'));
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/api/auth',    loginLimiter, require('./routes/auth'));
app.use('/api/student', require('./routes/student'));
app.use('/api/parent',  require('./routes/parent'));
app.use('/api/warden',  require('./routes/warden'));

app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'Server is running.', timestamp: new Date() });
});
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err.stack);
    res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
});
initDB()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`\n🏫 Hostel Outpass Portal running at http://localhost:${PORT}`);
            console.log(`📂 Frontend: http://localhost:${PORT}/`);
            console.log(`🔌 API Base: http://localhost:${PORT}/api`);
            console.log(`\nSample credentials:`);
            console.log(`  Student : STU001 / student123`);
            console.log(`  Parent  : PAR001 / parent123`);
            console.log(`  Warden  : WAR001 / warden123\n`);
        });
    })
    .catch(err => {
        console.error('❌ Failed to initialise database:', err);
        process.exit(1);
    });

module.exports = app;

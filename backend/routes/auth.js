const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const router   = express.Router();

const { getDB, queryOne, run } = require('../database/db');
const { verifyToken, JWT_SECRET } = require('../middleware/auth');

function logAction(db, actorId, action, targetId, details, ip) {
    try {
        run(db, `INSERT INTO audit_logs (actor_id, action, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?)`,
            [actorId, action, targetId || null, JSON.stringify(details) || null, ip || null]);
    } catch (e) { console.error('Audit log error:', e.message); }
}

router.post('/login', async (req, res) => {
    const { user_id, password } = req.body;
    const ip = req.ip;

    if (!user_id || !password)
        return res.status(400).json({ success: false, message: 'User ID and password are required.' });

    const cleanId = String(user_id).trim().toUpperCase();
    if (cleanId.length > 20 || password.length > 128)
        return res.status(400).json({ success: false, message: 'Invalid input.' });

    const db = getDB();

    try {
        const user = queryOne(db, 'SELECT * FROM users WHERE user_id = ?', [cleanId]);

        if (!user) {
            logAction(db, cleanId, 'LOGIN_FAIL', null, { reason: 'user_not_found' }, ip);
            return res.status(401).json({ success: false, message: 'Invalid credentials. Please try again.' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            logAction(db, cleanId, 'LOGIN_FAIL', null, { reason: 'wrong_password' }, ip);
            return res.status(401).json({ success: false, message: 'Invalid credentials. Please try again.' });
        }

        const payload = { user_id: user.user_id, role: user.role, linked_id: user.linked_id };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h', issuer: 'hostel-outpass-portal' });

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 8 * 60 * 60 * 1000
        });

        logAction(db, cleanId, 'LOGIN_SUCCESS', null, { role: user.role }, ip);

        return res.json({
            success: true,
            message: 'Login successful.',
            user: { user_id: user.user_id, role: user.role, linked_id: user.linked_id }
        });

    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.post('/logout', verifyToken, (req, res) => {
    const db = getDB();
    logAction(db, req.user.user_id, 'LOGOUT', null, {}, req.ip);
    res.clearCookie('token', { httpOnly: true, sameSite: 'strict' });
    return res.json({ success: true, message: 'Logged out successfully.' });
});

router.get('/me', verifyToken, (req, res) => {
    return res.json({
        success: true,
        user: { user_id: req.user.user_id, role: req.user.role, linked_id: req.user.linked_id }
    });
});

module.exports = router;

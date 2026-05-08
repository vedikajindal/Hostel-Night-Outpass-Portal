const express = require('express');
const router  = express.Router();
const { getDB, queryOne, queryAll, run } = require('../database/db');
const { verifyToken, requireStudent } = require('../middleware/auth');

router.use(verifyToken, requireStudent);

function logAction(db, actorId, action, targetId, details, ip) {
    try { run(db, `INSERT INTO audit_logs (actor_id,action,target_id,details,ip_address) VALUES (?,?,?,?,?)`,
        [actorId, action, targetId||null, JSON.stringify(details)||null, ip||null]); } catch(e) {}
}
router.get('/profile', (req, res) => {
    const db = getDB();
    const student = queryOne(db, `
        SELECT s.*, p.full_name AS parent_name, p.phone AS parent_phone, p.email AS parent_email
        FROM students s
        LEFT JOIN parents p ON s.parent_id = p.parent_id
        WHERE s.student_id = ?
    `, [req.user.user_id]);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });
    return res.json({ success: true, student });
});

router.get('/requests', (req, res) => {
    const db = getDB();
    const requests = queryAll(db, `
        SELECT * FROM outpass_requests WHERE student_id = ? ORDER BY created_at DESC
    `, [req.user.user_id]);
    return res.json({ success: true, requests });
});

router.post('/requests', (req, res) => {
    const { reason, destination, outgoing_datetime, return_datetime } = req.body;
    if (!reason || !destination || !outgoing_datetime || !return_datetime)
        return res.status(400).json({ success: false, message: 'All fields are required.' });

    const outgoing  = new Date(outgoing_datetime);
    const returning = new Date(return_datetime);
    const now       = new Date();

    if (outgoing <= now)
        return res.status(400).json({ success: false, message: 'Outgoing time must be in the future.' });
    if (returning <= outgoing)
        return res.status(400).json({ success: false, message: 'Return time must be after outgoing time.' });

    const db = getDB();
    const result = run(db, `
        INSERT INTO outpass_requests
        (student_id, reason, destination, outgoing_datetime, return_datetime, status, parent_verified, submitted_by)
        VALUES (?, ?, ?, ?, ?, 'pending', 0, 'student')
    `, [req.user.user_id, reason.trim(), destination.trim(), outgoing_datetime, return_datetime]);

    logAction(db, req.user.user_id, 'OUTPASS_APPLIED', result.lastInsertRowid, { destination }, req.ip);

    return res.status(201).json({ success: true, message: 'Outpass request submitted successfully.', request_id: result.lastInsertRowid });
});
router.get('/requests/:id', (req, res) => {
    const db = getDB();
    const request = queryOne(db, `SELECT * FROM outpass_requests WHERE request_id = ? AND student_id = ?`,
        [req.params.id, req.user.user_id]);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found.' });
    return res.json({ success: true, request });
});

router.get('/stats', (req, res) => {
    const db = getDB();
    const all = queryAll(db, `SELECT status, parent_verified FROM outpass_requests WHERE student_id = ?`,
        [req.user.user_id]);
    const stats = {
        total:           all.length,
        pending:         all.filter(r => r.status === 'pending').length,
        approved:        all.filter(r => r.status === 'approved').length,
        rejected:        all.filter(r => r.status === 'rejected').length,
        parent_verified: all.filter(r => r.parent_verified == 1).length
    };
    return res.json({ success: true, stats });
});

module.exports = router;

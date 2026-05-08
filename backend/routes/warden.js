const express = require('express');
const router  = express.Router();
const { getDB, queryOne, queryAll, run } = require('../database/db');
const { verifyToken, requireWarden } = require('../middleware/auth');

router.use(verifyToken, requireWarden);

function logAction(db, actorId, action, targetId, details, ip) {
    try { run(db, `INSERT INTO audit_logs (actor_id,action,target_id,details,ip_address) VALUES (?,?,?,?,?)`,
        [actorId, action, targetId||null, JSON.stringify(details)||null, ip||null]); } catch(e) {}
}
router.get('/requests', (req, res) => {
    const db = getDB();
    const { status, verified, date } = req.query;

    let sql = `
        SELECT r.*, s.full_name, s.roll_number, s.room_number, s.hostel_name, s.phone AS student_phone
        FROM outpass_requests r
        JOIN students s ON r.student_id = s.student_id
        WHERE 1=1
    `;
    const params = [];
    if (status)   { sql += ' AND r.status = ?';              params.push(status); }
    if (verified !== undefined && verified !== '') { sql += ' AND r.parent_verified = ?'; params.push(Number(verified)); }
    if (date)     { sql += ' AND DATE(r.created_at) = ?';   params.push(date); }
    sql += ' ORDER BY r.parent_verified DESC, r.created_at DESC';

    const requests = queryAll(db, sql, params);
    return res.json({ success: true, requests });
});
router.patch('/requests/:id/approve', (req, res) => {
    const db = getDB();
    const { warden_note } = req.body;
    const request = queryOne(db, 'SELECT * FROM outpass_requests WHERE request_id = ?', [req.params.id]);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found.' });
    if (request.status !== 'pending') return res.status(400).json({ success: false, message: 'Request already processed.' });

    run(db, `UPDATE outpass_requests SET status = 'approved', warden_note = ?, updated_at = datetime('now') WHERE request_id = ?`,
        [warden_note || null, req.params.id]);

    logAction(db, req.user.user_id, 'APPROVED', req.params.id,
        { student: request.student_id, note: warden_note }, req.ip);
    return res.json({ success: true, message: 'Outpass approved successfully.' });
});
router.patch('/requests/:id/reject', (req, res) => {
    const db = getDB();
    const { warden_note } = req.body;
    if (!warden_note || !warden_note.trim())
        return res.status(400).json({ success: false, message: 'Rejection reason is required.' });

    const request = queryOne(db, 'SELECT * FROM outpass_requests WHERE request_id = ?', [req.params.id]);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found.' });
    if (request.status !== 'pending') return res.status(400).json({ success: false, message: 'Request already processed.' });

    run(db, `UPDATE outpass_requests SET status = 'rejected', warden_note = ?, updated_at = datetime('now') WHERE request_id = ?`,
        [warden_note.trim(), req.params.id]);

    logAction(db, req.user.user_id, 'REJECTED', req.params.id,
        { student: request.student_id, reason: warden_note }, req.ip);
    return res.json({ success: true, message: 'Outpass rejected.' });
});
router.get('/stats', (req, res) => {
    const db = getDB();
    const all   = queryAll(db, 'SELECT status, parent_verified FROM outpass_requests');
    const today = queryAll(db, `SELECT status FROM outpass_requests WHERE DATE(created_at) = DATE('now')`);
    const stats = {
        total:           all.length,
        pending:         all.filter(r => r.status === 'pending').length,
        approved:        all.filter(r => r.status === 'approved').length,
        rejected:        all.filter(r => r.status === 'rejected').length,
        parent_verified: all.filter(r => r.parent_verified == 1).length,
        total_today:     today.length,
        approved_today:  today.filter(r => r.status === 'approved').length,
        rejected_today:  today.filter(r => r.status === 'rejected').length
    };
    return res.json({ success: true, stats });
});
router.get('/logs', (req, res) => {
    const db = getDB();
    const logs = queryAll(db, 'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100');
    return res.json({ success: true, logs });
});
router.get('/profile', (req, res) => {
    const db = getDB();
    const warden = queryOne(db, 'SELECT * FROM wardens WHERE warden_id = ?', [req.user.user_id]);
    if (!warden) return res.status(404).json({ success: false, message: 'Warden not found.' });
    return res.json({ success: true, warden });
});

module.exports = router;

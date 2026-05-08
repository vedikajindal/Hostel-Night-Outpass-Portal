const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'hostel_outpass_secret_change_in_production';

function verifyToken(req, res, next) {
    
    const token = req.cookies && req.cookies.token;

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Access denied. Please log in.'
        });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // { user_id, role, linked_id, iat, exp }
        next();
    } catch (err) {
        res.clearCookie('token');
        return res.status(401).json({
            success: false,
            message: 'Session expired. Please log in again.'
        });
    }
}

function requireStudent(req, res, next) {
    if (req.user.role !== 'student') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Students only.'
        });
    }
    next();
}

function requireParent(req, res, next) {
    if (req.user.role !== 'parent') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Parents only.'
        });
    }
    next();
}

function requireWarden(req, res, next) {
    if (req.user.role !== 'warden') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Wardens only.'
        });
    }
    next();
}

function requireAnyRole(...roles) {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Required role: ${roles.join(' or ')}`
            });
        }
        next();
    };
}

module.exports = {
    verifyToken,
    requireStudent,
    requireParent,
    requireWarden,
    requireAnyRole,
    JWT_SECRET
};

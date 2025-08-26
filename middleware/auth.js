const jwt = require('jsonwebtoken');
const { User } = require('../models/database');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Відсутній токен авторизації' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.userId);
    
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Недійсний токен' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Недійсний токен' });
  }
};

const adminAuth = async (req, res, next) => {
  try {
    await auth(req, res, () => {});
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Доступ заборонено' });
    }
    
    next();
  } catch (error) {
    res.status(403).json({ error: 'Доступ заборонено' });
  }
};

module.exports = { auth, adminAuth };
const express = require('express');
const { User } = require('../models/database');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/volunteers', auth, async (req, res) => {
  try {
    const volunteers = await User.findAll({ 
      where: {
        role: 'volunteer', 
        isActive: true 
      },
      attributes: { exclude: ['password'] }
    });
    
    res.json(volunteers);
  } catch (error) {
    console.error('Помилка отримання волонтерів:', error);
    res.status(500).json({ error: 'Серверна помилка' });
  }
});

router.get('/volunteers/:id', auth, async (req, res) => {
  try {
    const volunteer = await User.findOne({
      where: {
        id: req.params.id,
        role: 'volunteer',
        isActive: true
      },
      attributes: { exclude: ['password'] }
    });
    
    if (!volunteer) {
      return res.status(404).json({ error: 'Волонтера не знайдено' });
    }
    
    res.json(volunteer);
  } catch (error) {
    console.error('Помилка отримання волонтера:', error);
    res.status(500).json({ error: 'Серверна помилка' });
  }
});

router.put('/volunteers/:id/status', adminAuth, async (req, res) => {
  try {
    const { isActive } = req.body;
    
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'Користувача не знайдено' });
    }
    
    await user.update({ isActive });
    
    res.json({
      message: `Користувач ${isActive ? 'активований' : 'деактивований'}`,
      user
    });
  } catch (error) {
    console.error('Помилка зміни статусу користувача:', error);
    res.status(500).json({ error: 'Серверна помилка' });
  }
});

module.exports = router;
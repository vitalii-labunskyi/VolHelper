const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { User } = require('../models/database');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.post('/register', [
  body('name').trim().notEmpty().withMessage('Ім\'я обов\'язкове'),
  body('email').isEmail().withMessage('Некоректний email'),
  body('password').isLength({ min: 6 }).withMessage('Пароль має бути мінімум 6 символів'),
  body('phone').notEmpty().withMessage('Телефон обов\'язковий')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, phone, skills, location, availability } = req.body;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Користувач з таким email вже існує' });
    }

    const user = await User.create({
      name,
      email,
      password,
      phone,
      skills: skills || [],
      location: location || {},
      availability: availability || 'flexible'
    });

    const token = jwt.sign(
      { userId: user.id }, 
      process.env.JWT_SECRET, 
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Волонтер успішно зареєстрований',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        skills: user.skills,
        location: user.location,
        availability: user.availability
      }
    });

  } catch (error) {
    console.error('Помилка реєстрації:', error);
    res.status(500).json({ error: 'Серверна помилка' });
  }
});

router.post('/login', [
  body('email').isEmail().withMessage('Некоректний email'),
  body('password').notEmpty().withMessage('Пароль обов\'язковий')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Невірні дані для входу' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Невірні дані для входу' });
    }

    const token = jwt.sign(
      { userId: user.id }, 
      process.env.JWT_SECRET, 
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Успішний вхід',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        skills: user.skills,
        location: user.location,
        availability: user.availability
      }
    });

  } catch (error) {
    console.error('Помилка входу:', error);
    res.status(500).json({ error: 'Серверна помилка' });
  }
});

router.get('/profile', auth, async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone,
        role: req.user.role,
        skills: req.user.skills,
        location: req.user.location,
        availability: req.user.availability,
        createdAt: req.user.createdAt
      }
    });
  } catch (error) {
    console.error('Помилка отримання профілю:', error);
    res.status(500).json({ error: 'Серверна помилка' });
  }
});

router.put('/profile', auth, [
  body('name').optional().trim().notEmpty(),
  body('phone').optional().notEmpty(),
  body('skills').optional().isArray(),
  body('location').optional().isObject(),
  body('availability').optional().isIn(['fulltime', 'parttime', 'weekends', 'flexible'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, phone, skills, location, availability } = req.body;
    const updateData = {};

    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (skills) updateData.skills = skills;
    if (location) updateData.location = location;
    if (availability) updateData.availability = availability;

    await req.user.update(updateData);
    await req.user.reload();

    res.json({
      message: 'Профіль оновлено',
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone,
        role: req.user.role,
        skills: req.user.skills,
        location: req.user.location,
        availability: req.user.availability
      }
    });

  } catch (error) {
    console.error('Помилка оновлення профілю:', error);
    res.status(500).json({ error: 'Серверна помилка' });
  }
});

module.exports = router;
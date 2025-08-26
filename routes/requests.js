const express = require('express');
const { body, validationResult } = require('express-validator');
const { Request, User, Note } = require('../models/database');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/', [
  body('title').trim().notEmpty().withMessage('Заголовок обов\'язковий'),
  body('description').trim().notEmpty().withMessage('Опис обов\'язковий'),
  body('category').isIn(['medical', 'humanitarian', 'evacuation', 'psychological', 'legal', 'technical', 'translation', 'other']).withMessage('Некоректна категорія'),
  body('location.address').notEmpty().withMessage('Адреса обов\'язкова'),
  body('location.city').notEmpty().withMessage('Місто обов\'язкове'),
  body('contactInfo.name').notEmpty().withMessage('Ім\'я контактної особи обов\'язкове'),
  body('contactInfo.phone').notEmpty().withMessage('Телефон обов\'язковий')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, category, priority, location, contactInfo, deadline } = req.body;

    const request = await Request.create({
      title,
      description,
      category,
      priority: priority || 'medium',
      location,
      contactInfo,
      deadline: deadline ? new Date(deadline) : null
    });

    res.status(201).json({
      message: 'Заявка успішно створена',
      request
    });

  } catch (error) {
    console.error('Помилка створення заявки:', error);
    res.status(500).json({ error: 'Серверна помилка' });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const { status, category, priority, assigned } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;
    if (assigned === 'true') filter.assignedVolunteerId = { [require('sequelize').Op.ne]: null };
    if (assigned === 'false') filter.assignedVolunteerId = null;

    if (req.user.role === 'volunteer') {
      filter[require('sequelize').Op.or] = [
        { assignedVolunteerId: req.user.id },
        { status: 'new' }
      ];
    }

    const requests = await Request.findAll({
      where: filter,
      include: [
        {
          model: User,
          as: 'assignedVolunteer',
          attributes: ['id', 'name', 'phone', 'email']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(requests);
  } catch (error) {
    console.error('Помилка отримання заявок:', error);
    res.status(500).json({ error: 'Серверна помилка' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const request = await Request.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'assignedVolunteer',
          attributes: ['id', 'name', 'phone', 'email', 'skills', 'location', 'availability']
        },
        {
          model: Note,
          include: [{
            model: User,
            as: 'author',
            attributes: ['id', 'name']
          }],
          order: [['createdAt', 'ASC']]
        }
      ]
    });

    if (!request) {
      return res.status(404).json({ error: 'Заявку не знайдено' });
    }

    if (req.user.role === 'volunteer' && 
        request.assignedVolunteerId && 
        request.assignedVolunteerId !== req.user.id && 
        request.status !== 'new') {
      return res.status(403).json({ error: 'Доступ заборонено' });
    }

    res.json(request);
  } catch (error) {
    console.error('Помилка отримання заявки:', error);
    res.status(500).json({ error: 'Серверна помилка' });
  }
});

router.put('/:id/assign', auth, async (req, res) => {
  try {
    const { volunteerId } = req.body;
    
    if (req.user.role === 'volunteer') {
      if (volunteerId && volunteerId !== req.user.id) {
        return res.status(403).json({ error: 'Волонтер може призначити тільки себе' });
      }
    }

    const request = await Request.findByPk(req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'Заявку не знайдено' });
    }

    if (request.status === 'completed' || request.status === 'cancelled') {
      return res.status(400).json({ error: 'Неможливо призначити волонтера на завершену або скасовану заявку' });
    }

    const targetVolunteerId = volunteerId || req.user.id;
    
    const volunteer = await User.findOne({ 
      where: {
        id: targetVolunteerId, 
        role: 'volunteer', 
        isActive: true 
      }
    });
    
    if (!volunteer) {
      return res.status(404).json({ error: 'Волонтера не знайдено' });
    }

    await request.update({
      assignedVolunteerId: targetVolunteerId,
      status: 'assigned'
    });
    
    await Note.create({
      text: `Заявку призначено волонтеру ${volunteer.name}`,
      requestId: request.id,
      authorId: req.user.id
    });

    await request.reload({
      include: [{
        model: User,
        as: 'assignedVolunteer',
        attributes: ['id', 'name', 'phone', 'email']
      }]
    });

    res.json({
      message: 'Волонтера успішно призначено',
      request
    });

  } catch (error) {
    console.error('Помилка призначення волонтера:', error);
    res.status(500).json({ error: 'Серверна помилка' });
  }
});

router.put('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['new', 'assigned', 'in_progress', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Некоректний статус' });
    }

    const request = await Request.findByPk(req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'Заявку не знайдено' });
    }

    if (req.user.role === 'volunteer' && 
        request.assignedVolunteerId && 
        request.assignedVolunteerId !== req.user.id) {
      return res.status(403).json({ error: 'Тільки призначений волонтер може змінювати статус' });
    }

    const oldStatus = request.status;
    await request.update({ status });
    
    await Note.create({
      text: `Статус змінено з "${oldStatus}" на "${status}"`,
      requestId: request.id,
      authorId: req.user.id
    });

    await request.reload({
      include: [{
        model: User,
        as: 'assignedVolunteer',
        attributes: ['id', 'name', 'phone', 'email']
      }]
    });

    res.json({
      message: 'Статус заявки оновлено',
      request
    });

  } catch (error) {
    console.error('Помилка оновлення статусу:', error);
    res.status(500).json({ error: 'Серверна помилка' });
  }
});

router.post('/:id/notes', auth, [
  body('text').trim().notEmpty().withMessage('Текст нотатки обов\'язковий')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { text } = req.body;
    
    const request = await Request.findByPk(req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'Заявку не знайдено' });
    }

    if (req.user.role === 'volunteer' && 
        request.assignedVolunteerId && 
        request.assignedVolunteerId !== req.user.id && 
        request.status !== 'new') {
      return res.status(403).json({ error: 'Доступ заборонено' });
    }

    const note = await Note.create({
      text,
      requestId: req.params.id,
      authorId: req.user.id
    });

    await note.reload({
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'name']
      }]
    });

    res.status(201).json({
      message: 'Нотатку додано',
      note
    });

  } catch (error) {
    console.error('Помилка додавання нотатки:', error);
    res.status(500).json({ error: 'Серверна помилка' });
  }
});

router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const request = await Request.findByPk(req.params.id);
    
    if (!request) {
      return res.status(404).json({ error: 'Заявку не знайдено' });
    }

    await Note.destroy({ where: { requestId: req.params.id } });
    await request.destroy();

    res.json({ message: 'Заявку видалено' });
  } catch (error) {
    console.error('Помилка видалення заявки:', error);
    res.status(500).json({ error: 'Серверна помилка' });
  }
});

module.exports = router;
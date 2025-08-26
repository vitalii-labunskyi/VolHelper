const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: process.env.DATABASE_URL || '/tmp/database.sqlite',
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

const User = sequelize.define('User', {
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [6, 100]
    }
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('volunteer', 'admin'),
    defaultValue: 'volunteer'
  },
  skills: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  location: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  availability: {
    type: DataTypes.ENUM('fulltime', 'parttime', 'weekends', 'flexible'),
    defaultValue: 'flexible'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  hooks: {
    beforeCreate: async (user) => {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(user.password, salt);
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    }
  }
});

User.prototype.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const Request = sequelize.define('Request', {
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  category: {
    type: DataTypes.ENUM(
      'medical',
      'humanitarian', 
      'evacuation',
      'psychological',
      'legal',
      'technical',
      'translation',
      'other'
    ),
    allowNull: false
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
    defaultValue: 'medium'
  },
  location: {
    type: DataTypes.JSON,
    allowNull: false
  },
  contactInfo: {
    type: DataTypes.JSON,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('new', 'assigned', 'in_progress', 'completed', 'cancelled'),
    defaultValue: 'new'
  },
  assignedVolunteerId: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id'
    }
  },
  deadline: {
    type: DataTypes.DATE
  },
  notes: {
    type: DataTypes.JSON,
    defaultValue: []
  }
});

const Note = sequelize.define('Note', {
  text: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  requestId: {
    type: DataTypes.INTEGER,
    references: {
      model: Request,
      key: 'id'
    }
  },
  authorId: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id'
    }
  }
});

Request.belongsTo(User, { as: 'assignedVolunteer', foreignKey: 'assignedVolunteerId' });
User.hasMany(Request, { foreignKey: 'assignedVolunteerId' });

Request.hasMany(Note, { foreignKey: 'requestId' });
Note.belongsTo(Request, { foreignKey: 'requestId' });
Note.belongsTo(User, { as: 'author', foreignKey: 'authorId' });

module.exports = {
  sequelize,
  User,
  Request,
  Note
};
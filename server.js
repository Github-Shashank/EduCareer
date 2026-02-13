const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcryptjs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ai-career-advisor';
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me-in-production';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err.message));

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    grade: { type: String, default: '' },
    interests: { type: [String], default: [] },
    goals: { type: String, default: '' }
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: MONGODB_URI }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 }
  })
);

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  next();
}

function fallbackAdvice(user, prompt) {
  const interestText = user.interests.length ? user.interests.join(', ') : 'general studies';
  return `Hi ${user.name}, based on your interests in ${interestText} and your goal "${user.goals || 'exploring career options'}", here is a plan:\n\n1) Explore 2-3 roles connected to ${interestText} (for example: software developer, data analyst, product designer).\n2) Build one portfolio project this month tied to your current grade level (${user.grade || 'not specified'}).\n3) Improve communication and problem-solving skills through group projects.\n4) Take one certification or online course and add it to your resume.\n\nYour question: "${prompt}"\n\nSuggested next action this week: schedule 3 focused learning sessions and publish a short progress summary.`;
}

async function getAdvisorResponse(user, prompt) {
  if (!OPENAI_API_KEY) {
    return fallbackAdvice(user, prompt);
  }

  const profile = `Name: ${user.name}\nGrade: ${user.grade || 'N/A'}\nInterests: ${user.interests.join(', ') || 'N/A'}\nGoals: ${user.goals || 'N/A'}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are an AI Career Advisor for students. Give practical, realistic, and encouraging advice with actionable next steps.'
          },
          {
            role: 'user',
            content: `Student profile:\n${profile}\n\nQuestion: ${prompt}`
          }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      return fallbackAdvice(user, prompt);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || fallbackAdvice(user, prompt);
  } catch (error) {
    console.error('AI request failed:', error.message);
    return fallbackAdvice(user, prompt);
  }
}

app.get('/', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.redirect('/login');
});

app.get('/register', (req, res) => {
  res.render('register', { error: '' });
});

app.post('/register', async (req, res) => {
  const { name, email, password, grade, interests, goals } = req.body;
  try {
    const existing = await User.findOne({ email });
    if (existing) {
      return res.render('register', { error: 'Email already registered.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const parsedInterests = (interests || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    const user = await User.create({
      name,
      email,
      passwordHash,
      grade,
      interests: parsedInterests,
      goals
    });

    req.session.userId = user._id.toString();
    res.redirect('/dashboard');
  } catch (error) {
    res.render('register', { error: 'Could not create account. Please try again.' });
  }
});

app.get('/login', (req, res) => {
  res.render('login', { error: '' });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.render('login', { error: 'Invalid email or password.' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.render('login', { error: 'Invalid email or password.' });
    }

    req.session.userId = user._id.toString();
    res.redirect('/dashboard');
  } catch (error) {
    res.render('login', { error: 'Login failed. Please try again.' });
  }
});

app.get('/dashboard', requireAuth, async (req, res) => {
  const user = await User.findById(req.session.userId).lean();
  if (!user) {
    req.session.destroy(() => {});
    return res.redirect('/login');
  }

  res.render('dashboard', { user, advice: '' });
});

app.post('/advisor', requireAuth, async (req, res) => {
  const user = await User.findById(req.session.userId).lean();
  if (!user) {
    req.session.destroy(() => {});
    return res.redirect('/login');
  }

  const prompt = req.body.prompt || 'How should I plan my career?';
  const advice = await getAdvisorResponse(user, prompt);
  res.render('dashboard', { user, advice });
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

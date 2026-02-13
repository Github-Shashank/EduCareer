# AI Career Advisor (Student Portal)

A Node.js + Express + MongoDB web app where students can:
- Register and login securely
- Save basic academic/career profile data
- Ask an AI Career Advisor questions and receive guidance

## Tech stack
- Express.js
- MongoDB + Mongoose
- EJS templates
- Session-based authentication with `express-session` + `connect-mongo`
- Optional OpenAI integration (fallback advisor response if API key is missing)

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create env file:
   ```bash
   cp .env.example .env
   ```
3. Start MongoDB locally (or set a remote `MONGODB_URI`).
4. Run the app:
   ```bash
   npm start
   ```
5. Open `http://localhost:3000`.

## Environment variables
- `PORT`: server port (default `3000`)
- `MONGODB_URI`: MongoDB connection string
- `SESSION_SECRET`: session encryption secret
- `OPENAI_API_KEY`: optional, enables live AI responses

## Routes
- `GET /register` / `POST /register`
- `GET /login` / `POST /login`
- `GET /dashboard`
- `POST /advisor`
- `POST /logout`

## Notes
- Passwords are hashed with bcrypt.
- If `OPENAI_API_KEY` is not provided or API fails, app returns a useful fallback career plan.

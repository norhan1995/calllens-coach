# 🎧 CallLens Coach

> **AI-powered, evidence-based quality assurance and coaching for modern contact centers.**

CallLens Coach transforms customer conversations into actionable coaching using AI transcription, Arabic Intelligence, automated QA scoring, analytics, and personalized coaching.

![Landing Page](docs/images/landing.png)

![TypeScript](https://img.shields.io/badge/TypeScript-97.7%25-blue)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--5.6-green)
![Codex](https://img.shields.io/badge/Built%20with-Codex-black)
![License](https://img.shields.io/badge/License-MIT-success)

---

# 🚀 Live Demo

### Production Application

https://calllens-coach.vercel.app/

---

# 🎥 Demo Video

Watch the complete Build Week demonstration:

(https://youtu.be/Ij-Z8AZtzSo)

---

# 📖 Overview

CallLens Coach is an AI-powered quality assurance and coaching platform designed for customer service teams.

The platform transforms customer conversations into structured insights that managers can immediately use to coach agents, improve customer experience, and monitor quality across their teams.

Unlike traditional QA tools that rely primarily on keyword detection, CallLens Coach understands conversational context, generates evidence-linked findings, performs dialect-aware Arabic analysis, and produces actionable coaching recommendations.

---

# 🔄 How It Works

1. Upload a customer call recording.
2. Generate a timestamped transcript with speaker separation.
3. Analyze Arabic dialects, customer intent, and sentiment.
4. Automatically evaluate the interaction using QA criteria.
5. Generate evidence-based coaching recommendations.
6. Practice improvements through AI-powered role-play.
7. Monitor quality trends through dashboards and analytics.

---

# ✨ Features

## 🎙️ AI Transcription

- Audio upload
- Speaker separation
- Timestamped transcript
- Transcript editing
- TXT export
- JSON export

![Analyze Call](docs/images/analyze-call.png)

---

## 🌍 Arabic Intelligence

CallLens Coach provides specialized Arabic language analysis, including:

- Dialect-aware processing
- Egyptian Arabic understanding
- Code-switching detection
- Context-aware interpretation
- Linguistic normalization
- Evidence-linked observations

![Arabic Intelligence](docs/images/arabic-intelligence.png)

---

## 📊 Automated QA Analysis

Every conversation is automatically evaluated using structured quality assurance criteria.

The analysis includes:

- Executive summary
- Greeting evaluation
- Needs discovery
- Empathy
- Compliance
- Objection handling
- Communication quality
- Missed opportunities
- Critical conversation timeline

![QA Analysis](docs/images/qa-analysis.png)

---

## 🎯 Personalized Coaching

Instead of simply identifying mistakes, CallLens Coach generates personalized coaching recommendations.

Outputs include:

- Better wording suggestions
- Before & after conversation improvements
- Estimated score improvement
- Seven-day coaching plan
- Ready-to-send customer follow-up messages

![Coaching Plan](docs/images/coaching-plan.png)

---

## 🤖 AI Role-play

Agents can immediately practice realistic customer scenarios generated from the analysis, allowing coaching to become interactive rather than theoretical.

---

## 📈 Dashboard & Analytics

Managers receive a complete operational overview including:

- Average QA score
- Coaching priorities
- Compliance metrics
- Team trends
- Performance insights
- Quality distribution

![Dashboard](docs/images/dashboard.png)

---

# 🏗️ Architecture

```
Customer Audio
        │
        ▼
OpenAI Speech Transcription
        │
        ▼
Speaker Separation
        │
        ▼
Arabic Intelligence
        │
        ▼
Quality Assurance Engine
        │
        ▼
Coaching Generator
        │
        ▼
Role-play
        │
        ▼
Analytics Dashboard
```

---

# 💻 Technology Stack

## Frontend

- React
- TypeScript
- Vite
- Tailwind CSS

## AI

- OpenAI GPT-5.6
- OpenAI Speech Transcription
- Arabic Intelligence pipeline

## Backend

- Cloudflare Workers
- Drizzle ORM
- SQLite / D1

## Deployment

- Vercel

---

# 🤖 How Codex Was Used

OpenAI Codex served as the primary AI software engineering assistant throughout development.

Codex was used to:

- Build application features
- Generate and refactor React and TypeScript code
- Debug production issues
- Resolve deployment problems
- Improve accessibility and responsiveness
- Review and optimize the codebase
- Accelerate feature implementation
- Support testing and deployment workflows

Codex significantly accelerated development while helping maintain a production-ready application.

---

# 🧠 How GPT-5.6 Was Used

GPT-5.6 supported the project throughout the entire product development lifecycle.

GPT-5.6 was used for:

- Product architecture
- Feature planning
- Prompt engineering
- QA framework design
- Arabic workflow design
- User experience improvements
- Documentation
- Product refinement
- Demo preparation

Together, Codex and GPT-5.6 enabled rapid iteration from concept to a polished working product.

---

# 📂 Project Structure

```
app/
build/
db/
docs/
public/
tests/
worker/
```

---

# 🚀 Running Locally

Clone the repository:

```bash
git clone https://github.com/norhan1995/calllens-coach.git

cd calllens-coach
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

---

# 🔑 Environment Variables

Create a `.env.local` file.

```env
OPENAI_API_KEY=your_api_key
```

Add any additional environment variables required for your deployment (for example, database or storage credentials) before running the application.

---

# 🧪 Sample Workflow

To test CallLens Coach:

1. Launch the application.
2. Open **Analyze Call**.
3. Upload a sample customer recording.
4. Review the transcript.
5. Explore Arabic Intelligence.
6. Review QA Analysis.
7. Generate Coaching.
8. Practice with AI Role-play.
9. View Dashboard metrics.

---

# 🏆 OpenAI Build Week

CallLens Coach was developed for **OpenAI Build Week**.

The project demonstrates how OpenAI Codex and GPT-5.6 can accelerate the complete software development lifecycle—from planning and architecture to implementation, debugging, deployment, documentation, and presentation.

---

# 🚀 Future Roadmap

- Live call monitoring
- Real-time coaching
- CRM integrations
- Enterprise authentication
- Supervisor collaboration
- Team benchmarking
- Performance prediction
- Multi-language support
- Custom QA templates

---

# 🌟 Why CallLens Coach?

Traditional QA tools measure **what was said**.

CallLens Coach evaluates:

- What was meant
- Why it mattered
- How the conversation could improve

By combining transcription, Arabic Intelligence, automated QA, personalized coaching, AI role-play, and analytics, CallLens Coach helps contact centers move beyond manual scorecards toward continuous performance improvement.

---

# 👩‍💻 Author

**Norhan Rifaie**

Built for **OpenAI Build Week 2026**

GitHub:
https://github.com/norhan1995/calllens-coach

---

# 📄 License

MIT License

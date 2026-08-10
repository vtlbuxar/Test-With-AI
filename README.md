# AI Test Analyst - Comprehensive User Guide

Welcome to the **AI Test Analyst**, an intelligent tool designed to revolutionize the Quality Assurance (QA) lifecycle. This application acts as an end-to-end QA Co-Pilot, automatically generating comprehensive test artifacts, analyzing impact on changes, and autonomously executing tests against your web application.

---

## 🚀 Core Features & Application Workflows

The AI Test Analyst provides a complete end-to-end QA generation and execution workflow.

### 1. Document Parsing & Analysis (Ingestion)
- **Upload Multiple Formats**: Upload requirement documents in `.pdf`, `.docx`, `.xlsx`, or `.csv` formats, or type raw requirements directly into the application.
- **Requirement Analysis**: The AI reads the context and generates a concise summary, breaking down its understanding of your core requirements.

### 2. Comprehensive Test Generation
- **Test Scenarios**: Generates high-level test scenarios covering Positive (Happy Path), Negative (Exception Path), and Boundary (Edge Cases).
- **Detailed Test Cases**: Automatically writes highly detailed, actionable test cases. Each test case includes Preconditions, Step-by-step instructions, Expected Results, and categorizes the test type (e.g., Functional, Security).
- **Risk Assessment**: The AI automatically assesses the business and security impact of each test case and assigns a **Risk Level** (High, Medium, Low) to help prioritize QA efforts.
- **Test Suites (Smoke & Regression)**: Automatically categorizes your generated test cases into targeted Smoke Test and Regression Test suites, complete with justifications.
- **Requirement Traceability Matrix (RTM)**: Maps specific items that need to be tested against the requirements found in your document, ensuring 100% test coverage.

### 3. AI Deep-Dive Generators
Users can drill down into individual test cases to leverage specialized AI agents:
- **AI Defect Predictor**: Foresees likely bugs, security vulnerabilities, and logic flaws before a single line of code is written.
- **AI Test Data Generator**: Instantly generates exhaustive payloads (positive, negative, boundary, SQL injection attempts, nulls) customized for a specific test case.

### 4. 🤖 Agentic Test Execution (Self-Healing Automation)
Unlike standard AI tools that just output text, this platform can **autonomously execute tests** against your web application.
- **Autonomous Playwright Engine**: Reads the natural language test steps and translates them into live browser actions (Click, Type, Navigate).
- **Self-Healing Locators**: Scans the DOM and visual viewport to intelligently locate elements even if developers change underlying ID or class names, ending flaky tests.
- **Vision AI Assertions**: Captures screenshots during execution and passes them to Vision AI (like GPT-4o or Gemini). The AI visually validates the page layout and success criteria exactly like a human QA tester.
- **Evidence Collection**: Automatically records videos, network logs, and step-by-step screenshots for every test run to build an undeniable audit trail.

### 5. Smart Versioning & Automated Impact Analysis
When requirements change, manual regression planning is notoriously painful.
- **Version History**: The system automatically saves a complete snapshot of all test artifacts whenever you update a requirement.
- **Automated Impact Analysis**: The AI calculates the "Diff" between old and new requirements, highlights exactly what was added/removed/modified, and flags which existing test cases are impacted, determining the exact regression scope in seconds.

### 6. Dashboard & Project Management
- **Persistent Storage**: All generated test assets are saved locally to a Requirements Dashboard. You can revisit past projects and manage them over time.
- **Export to Excel**: Instantly export your generated Test Cases, RTMs, and Test Suites to `.xlsx` Excel files for seamless integration into Jira or Xray.

---

## 🧠 How is the AI Working Under the Hood?

The application utilizes an advanced **Agentic "Mixture of Experts" Ensemble Architecture** built on top of the Vercel AI SDK to guarantee high-quality, structured outputs.

### The Ensemble Approach:
1. **Parallel Brainstorming**: When you request test cases, the system simultaneously queries multiple language models in parallel (e.g., Google's Gemini, Meta's Llama 3 via Groq, and OpenRouter). Each model independently brainstorms raw testing ideas.
2. **The "Judge" Synthesis**: All the raw ideas from the different models are gathered and fed into a primary Synthesizer/Judge model (Gemini).
3. **Deduplication & Refinement**: The Judge model evaluates all proposed outputs, combines the best ideas, removes duplicates, and enforces formatting rules.
4. **Structured JSON Output**: Using `zod` schemas and `generateObject`, the AI is forced to return strictly typed JSON, ensuring the UI receives perfectly formatted data that can be rendered into interactive tables without parsing errors.

By using this multi-model technique, the application captures a much wider array of edge cases and vulnerabilities than a single generic AI model would on its own.

---

## 🛠️ Development & Setup

This is a [Next.js](https://nextjs.org) project styled with Tailwind CSS and Shadcn UI, backed by a PostgreSQL database managed by Prisma.

### Prerequisites
- Node.js (v18+)
- Docker Desktop (for running the PostgreSQL database)
- An AI API Key (e.g., Google Gemini, OpenAI, or Groq)

### 1. Environment Variables
Create a `.env` file in the root of your project and populate it with your database connection and API keys:

```env
DATABASE_URL="postgresql://postgres:root@localhost:5433/ai_test_analyst?schema=public"
JWT_SECRET="your_secret_key"

# AI Model API Keys
GEMINI_API_KEY="your-gemini-key"
OPENAI_API_KEY=""
ANTHROPIC_API_KEY=""
GROQ_API_KEY=""
OPENROUTER_API_KEY=""
DEEPSEEK_API_KEY=""
```
*(Note: Users can also input their API key dynamically inside the application UI Settings if they do not wish to set global environment variables.)*

### 2. Database Setup
Start the local PostgreSQL database using Docker, and initialize the schema using Prisma:
```bash
# Start the database container in the background
docker-compose up -d

# Push the schema and generate the Prisma Client
npx prisma db push
npx prisma generate
```

### 3. Run the Application
Start the Next.js development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) with your browser to launch the AI Test Analyst!

# AI Test Analyst - User Guide

Welcome to the **AI Test Analyst**, an intelligent tool designed to streamline the Quality Assurance (QA) process. This application allows you to automatically generate comprehensive test scenarios, detailed test cases, Test Suites, and Requirement Traceability Matrices (RTM) directly from your software requirements.

---

## 🚀 What Can You Do With This Application?

As of the current version, the AI Test Analyst provides a complete end-to-end QA asset generation and management workflow:

### 1. Document Parsing & Analysis

- **Upload Multiple Formats**: Upload requirement documents in `.pdf`, `.docx`, `.xlsx`, or `.csv` formats.
- **Requirement Analysis**: The AI reads the uploaded document and generates a concise summary, breaking down its understanding of your core requirements.

### 2. Comprehensive Test Generation

- **Test Scenarios**: Generates high-level test scenarios covering Positive (Happy Path), Negative (Exception Path), and Boundary (Edge Cases).
- **Detailed Test Cases**: Automatically writes highly detailed, actionable test cases. Each test case includes Preconditions, Step-by-step instructions, Expected Results, and categorizes the test type (e.g., Functional, Security).
- **Test Suites (Smoke & Regression)**: The AI automatically categorizes your generated test cases into targeted Smoke Test and Regression Test suites, complete with justifications for why each test belongs in that suite.

### 3. Requirement Traceability Matrix (RTM)

- Automatically maps out the specific items that need to be tested against the requirements found in your document, ensuring 100% test coverage.

### 4. Dashboard & Project Management

- **Persistent Storage**: All generated test assets are saved locally to a Requirements Dashboard. You can revisit past projects, view their details, and manage them over time.
- **Export to Excel**: Instantly export your generated Test Cases, RTMs, and Test Suites to `.xlsx` Excel files for seamless integration into tools like Jira or Xray.

---

## 🧠 How is AI Working Under the Hood?

The application doesn't just rely on a single prompt. It utilizes an advanced **"Mixture of Experts" (Ensemble) AI Architecture** built on top of the Vercel AI SDK to guarantee high-quality, structured outputs.

### The Ensemble Approach:

1. **Parallel Brainstorming**: When you request test cases, the system simultaneously queries multiple language models in parallel (e.g., Google's Gemini, Meta's Llama 3 via Groq, and Gemma via OpenRouter). Each model independently brainstorms raw testing ideas, edge cases, and scenarios.
2. **The "Judge" Synthesis**: All the raw ideas from the different models are gathered and fed into a primary Synthesizer/Judge model (Gemini).
3. **Deduplication & Refinement**: The Judge model critically evaluates all proposed outputs, combines the best ideas into a single master response, removes duplicates, and ensures there is no contradictory information.
4. **Structured JSON Output**: Using `zod` schemas and `generateObject`, the AI is forced to return strictly typed JSON. This ensures the UI always receives perfectly formatted data (arrays of test cases, specific string fields, etc.) that can be rendered directly into interactive tables without parsing errors.

By using this multi-model ensemble technique, the AI Test Analyst captures a much wider array of edge cases and security vulnerabilities than a single model would on its own.

---

## Development & Setup

This is a [Next.js](https://nextjs.org) project bootstrapped with `create-next-app` and styled with Tailwind CSS and Shadcn UI.

### Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

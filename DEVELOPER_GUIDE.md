# AI Test Analyst - Developer Guide

Welcome to the **AI Test Analyst** developer documentation. This guide is designed to help new developers understand the architecture, tech stack, and core features of the application, so you can quickly get up to speed and start contributing.

---

## 🏗️ Architecture Overview

The application is built using the **Next.js App Router** and follows a standard full-stack React architecture.

### Tech Stack
- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + Shadcn UI components
- **Database / ORM**: Prisma with PostgreSQL (configured via `DATABASE_URL` in `.env`)
- **AI Integration**: Vercel AI SDK (`@ai-sdk/google`)
- **Document Parsing**: `pdf-parse`, `mammoth` (docx), `xlsx`, `csv-parser`

### Core Directory Structure
- `src/app/`: Contains the Next.js routes, including pages and API endpoints.
  - `page.tsx`: The primary workspace where users input requirements and trigger generation pipelines.
  - `dashboard/`: The project management interface for viewing saved artifacts.
  - `api/`: The backend routes handling file parsing, database interactions, and AI generation (e.g., `generate-scenarios`, `generate-test-cases`, `generate-diff`).
- `src/lib/`: Contains core utilities and abstractions.
  - `ensemble.ts`: The central AI engine wrapping the Vercel AI SDK (specifically using Gemini via Google Generative AI).
  - `storage.ts`: The frontend abstraction layer for interacting with the backend `/api/projects` routes.
  - `file-parser.ts`: Utilities for extracting text from multipart `FormData` (PDFs, Word docs, Excel, CSVs).
- `prisma/`: Contains the database schema (`schema.prisma`) defining the data structure.

---

## 🗄️ Database Structure

The application uses PostgreSQL with Prisma ORM. Below is the exact, current Prisma schema defining the database:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id                      String    @id @default(uuid())
  name                    String
  phoneNumber             String
  email                   String    @unique
  role                    String    // "Analyst" or "User"
  passwordHash            String
  isVerified              Boolean   @default(false)
  verificationCode        String?
  verificationCodeExpiry  DateTime?
  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @updatedAt
  projects                Project[]
}

model Project {
  id              String   @id @default(uuid())
  userId          String
  createdAt       DateTime @default(now())
  requirementText String
  analysis        Json?
  scenarios       Json?
  testCases       Json?
  rtm             Json?
  suites          Json?
  versions        Json?

  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

The core structure revolves around two main models:

### 1. User Model
Manages authentication and user identity.
- `id` (String, UUID): Primary Key.
- `name`, `email`, `role`: Standard user details.
- `passwordHash`: Hashed credential for login.
- `projects`: A one-to-many relationship linking a user to their saved testing projects.

### 2. Project Model
Acts as the central repository for a single testing requirement and all its generated artifacts.
- `id` (String, UUID): Primary Key.
- `userId` (String): Foreign Key referencing the User.
- `requirementText` (String): The active textual requirement provided by the user.
- **JSON Artifacts**: Instead of deeply relational tables for every single test case, the application leverages Prisma's `Json?` scalar to store complex AI outputs. This allows for rapid iteration and flexibility without constant database migrations.
  - `analysis` (Json?): Stored summary and breakdown of the requirement.
  - `scenarios` (Json?): Stored list of high-level test scenarios.
  - `testCases` (Json?): Stored array of detailed test cases.
  - `rtm` (Json?): Stored Traceability Matrix mapping.
  - `suites` (Json?): Stored Smoke and Regression test suites.
  - `versions` (Json?): An array of snapshot objects. When `requirementText` changes, the old text and its associated JSON artifacts are pushed here for Version History.

---

## 🧠 Core Features & Workflows

### 1. Document Parsing & Ingestion
Users can provide requirements via a text box or by uploading files. 
- When files are uploaded, they are sent as `FormData` to the respective API routes.
- `src/lib/file-parser.ts` handles the extraction of text from various file formats before feeding the context into the AI engine.

### 2. How the AI Works (The Ensemble Engine)
The core of the application relies on `src/lib/ensemble.ts`, which acts as the central AI orchestrator using the Vercel AI SDK (`generateObject`).

#### Which AI Does What?
- **Primary Engine (Google Gemini 2.5 Flash)**: Gemini acts as the main workhorse. It is used as the base model when no other APIs are provided, and it *always* acts as the final "Judge" model for structured output formatting.
- **Secondary Brainstorming Models (Llama 3 via Groq & OpenRouter)**: For complex tasks (like generating edge cases or finding security vulnerabilities), the system relies on an "Ensemble" or "Mixture of Experts" approach.
  - *Groq (`llama-3.1-8b-instant`)*: Utilized for its blazing fast inference speed. It acts as an independent brainstorming agent.
  - *OpenRouter (`meta-llama/llama-3.1-8b-instruct:free`)*: Acts as another independent brainstorming agent to provide a different perspective on the requirements.
  
#### How the Ensemble Works
  - *Step 1 (Parallel Generation)*: Gemini, Groq, and OpenRouter are queried simultaneously with the exact same requirement prompt. They independently generate raw, unstructured text ideas for test scenarios and edge cases.
  - *Step 2 (The Judge Synthesis)*: Gemini 2.5 Flash takes all the raw ideas from itself, Groq, and OpenRouter. It acts as a Judge to remove duplicates, synthesize the best points, and format the final output.

#### Forcing Structured Output
We force the AI to return **strictly typed JSON** using Zod schemas (`z.object()`). This ensures the frontend receives predictable, structured data arrays (e.g., `TestCase[]` with specific string and enum fields) that can be reliably rendered in tables without parsing errors.

#### API Key Management (BYOK)
- **BYOK (Bring Your Own Key)**: Due to strict rate limits on free-tier LLM endpoints, the application implements a BYOK configuration. Users can enter their own Gemini API key in the UI settings, which is saved to `localStorage` and passed to API routes via the `X-Gemini-API-Key` header.

### 3. Risk-Based Testing
When the user generates Detailed Test Cases (`/api/generate-tests`) or Test Suites (`/api/generate-suites`), the AI automatically assesses and assigns a `Risk Level` (High, Medium, Low) and a `Risk Justification` to each test case based on business impact and security implications. The UI visually highlights High-Risk items in red.

### 4. Deep-Dive Generators
The application features specialized sub-generators that can be triggered on an individual Test Case level from the main workspace:
- **AI Defect Generator** (`/api/generate-defects`): Predicts likely security vulnerabilities, validation errors, logical bugs, and edge cases for a specific test scenario.
- **AI Test Data Generator** (`/api/generate-test-data`): Exhaustively generates test data inputs (Positive, Negative, Boundary, Invalid, Security Payloads like SQLi/XSS, and Unicode/Nulls).

### 5. Requirement Versioning & Storage
The application utilizes a PostgreSQL database (via Prisma) to persist projects.
- The `Project` model stores primary artifacts (`requirementText`, `testCases`, `analysis`, etc.) in `Json?` fields.
- **Versioning**: When a user modifies a previously saved requirement text and clicks "Approve & Save", `src/lib/storage.ts` detects the change. It pushes a complete snapshot of the *previous* state into a `versions` JSON array in the database, ensuring no history is lost.
- The UI provides a **Version History dropdown**, allowing users to seamlessly revert their workspace to any past snapshot.

### 6. Requirement Difference & Impact Analysis
When a requirement has multiple versions, users can click the **Compare Versions** button.
- The frontend calls `/api/generate-diff`, passing `requirement_v1` and `requirement_v2`.
- The AI analyzes the delta and returns a structured breakdown of: Added, Removed, and Modified requirements.
- Crucially, it identifies **Impacted Test Cases** and assigns an overall **Regression Scope**, saving QA teams hours of manual impact analysis.

---

## 🛠️ Development Guide

### Database Setup
1. Ensure your `.env` file contains a valid `DATABASE_URL` pointing to your database instance.
2. If you make changes to `prisma/schema.prisma`, apply them by running:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

### Adding New AI Generators
If you need to add a new AI feature:
1. Create a new route in `src/app/api/new-feature/route.ts`.
2. Define a strict `zod` schema for your expected output.
3. Call `generateEnsembleObject` from `src/lib/ensemble.ts`, passing the schema, prompt, and system instructions. Make sure to extract the `X-Gemini-API-Key` header and pass it to the ensemble function so the user's BYOK settings are respected.
4. Update the frontend in `src/app/page.tsx` to call your new endpoint and handle the state.

### Handling API Rate Limits (429 Errors)
If you encounter `429 Too Many Requests` errors during development, it means the default server-side Gemini API key has hit its quota. Ensure you have configured your personal API key via the settings modal (⚙️ icon) in the top-right corner of the application UI.

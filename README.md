# SalesForce Pro 🚀

SalesForce Pro is a powerful, AI-driven email automation and management system built with Next.js, Prisma, and Gemini AI. It provides a robust platform for managing corporate communications, featuring multi-role access (Admin & Employee), automated email generation, and a comprehensive review workflow.

## ✨ Features

- **🤖 AI-Powered Email Generation**: Leverage Google Gemini AI to draft professional, context-aware emails in seconds.
- **👥 Multi-Role Dashboard**:
  - **Admin Panel**: Manage SMTP configurations, monitor all employee communications, approve/reject drafts, and view detailed logs.
  - **Employee Portal**: Draft emails, use AI suggestions, and track the status of sent messages.
- **🛡️ Secure Authentication**:
  - Multi-factor authentication (2FA) via Email or TOTP.
  - OTP-based verification system.
  - Locked-out protection after failed attempts.
- **📧 SMTP Management**: Configure and manage multiple SMTP servers for flexible email dispatch.
- **📝 Workflow Management**: Integrated approval system where admins can review, comment on, and approve employee emails before they are sent.
- **📊 Real-time Tracking**: Monitor email statuses (Pending, Approved, Rejected, Sent) with a modern, responsive UI.
- **📱 Responsive Design**: Built with Tailwind CSS and Framer Motion for a premium, mobile-friendly experience.

## 🛠️ Tech Stack

- **Framework**: [Next.js 15+](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Database**: [PostgreSQL](https://www.postgresql.org/) with [Prisma ORM](https://www.prisma.io/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **AI Integration**: [Google Gemini AI](https://ai.google.dev/)
- **Authentication**: JWT, bcryptjs, OTP-generator, Speakeasy (TOTP)
- **UI Components**: Shadcn UI, Lucide React, Framer Motion
- **Email Dispatch**: Nodemailer

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- PostgreSQL database
- Gemini API Key

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd sales-force-pro
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Setup:**
   Create a `.env` file in the root directory and add the following variables (refer to `.env.example`):
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/salesforce"
   JWT_SECRET="your_jwt_secret"
   GEMINI_API_KEY="your_gemini_api_key"
   # ... add other necessary variables
   ```

4. **Initialize Database:**
   ```bash
   npx prisma db push
   npx prisma generate
   ```

5. **Run the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📂 Project Structure

- `/app`: Next.js App Router (Admin, Employee, Auth, and API routes).
- `/components`: Reusable UI components (Shadcn, custom components).
- `/lib`: Utility functions, Prisma client, and shared logic.
- `/prisma`: Database schema and migrations.
- `/store`: State management (Zustand).
- `/hooks`: Custom React hooks.

## 📄 License

This project is proprietary. All rights reserved.

---
Built with ❤️ using Next.js and Gemini AI.

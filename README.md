# Personal Writing Website

A fast, edge-hosted personal writing website platform built for publishing essays, thoughts, and long-form explorations. It leverages [Astro](https://astro.build/) for server-side rendering, [Cloudflare Workers](https://workers.cloudflare.com/) for global edge delivery, and [Cloudflare D1](https://developers.cloudflare.com/d1/) for its database. 

It comes with a fully baked, secure administrative CMS to write, edit, preview, and publish your work natively on the web.

---

## ✨ Features

- **Blazing Fast**: Server-side rendered by Astro at the Cloudflare Edge.
- **Minimal, Reader-Focused Design**: High-contrast typography featuring *Inter* for the UI and *Source Serif 4* for elegant long-form body text.
- **Built-in Administrative CMS**: A `/admin` dashboard protected by JWT authentication to manage all writing entirely within the browser. 
- **Markdown Editor**: Write posts in native Markdown with a live web preview pane before publishing.
- **Drafts & Publishing**: Manage posts as published works or save them as private drafts.
- **Smart Dark Mode**: Automatic dark mode that adapts to your local time (Light 5:00 AM – 7:00 PM / Dark 7:00 PM – 5:00 AM) with manual toggle fallback that persists.
- **Client-Side Search**: Instantly find essays with fuzzy full-text search.
- **Tags Taxonomy**: Filter writings and group topics organically with dynamic tag pills.
- **Reading Time**: Automatically calculates estimated reading time for all posts.

---

## 🛠️ Tech Stack

- **Framework**: [Astro 5](https://astro.build/) (SSR Mode)
- **Deployment**: [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- **Database**: [Cloudflare D1](https://developers.cloudflare.com/d1/) (Serverless SQLite)
- **Authentication**: JWT stored in `httpOnly` secure cookies.
- **Styling**: Vanilla CSS with custom properties (`global.css`) — zero bloated frameworks.
- **Markdown**: `marked` parser with `highlight.js` syntax highlighting. 

---

## 🚀 Quick Start (Local Development)

To run the blog locally, you will use Cloudflare's `wrangler` CLI to simulate the D1 database and edge environment.

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Local Database
Before running the development server, initialize your local SQLite database and apply the schema:
```bash
# Create local tables
npx wrangler d1 execute personal-site-db --local --file=./schema.sql

# Seed the database with sample posts (Optional)
npx wrangler d1 execute personal-site-db --local --file=./seed.sql
```

### 3. Setup Local Secrets
Create a `.dev.vars` file in the root of your project:
```bash
# Generate a secure SHA-256 hash of your chosen password.
# (e.g., node -e "const c=require('crypto');console.log(c.createHash('sha256').update('your-password').digest('hex'))")
ADMIN_PASSWORD_HASH=your_sha256_password_hash_here

# A long random string for encrypting user sessions
JWT_SECRET=your_super_long_random_jwt_secret_here
```
*(By default, this repository contains a `.dev.vars` file with the password `password` for immediate local testing).*

### 4. Start the Dev Server
```bash
npm run dev
```
The site will be available at `http://localhost:4321`.
The admin portal is available at `http://localhost:4321/admin/login`.

---

## ☁️ Deployment (Cloudflare)

Deployment is handled via Github Actions or Wrangler directly to your Cloudflare account.

### 1. Create your Production Database
Run this command to create a D1 database on your Cloudflare account:
```bash
npx wrangler d1 create personal-site-db
```
*Note: Copy the `database_id` output from this command and paste it into your `wrangler.json` file under `database_id`.*

### 2. Apply Schema to Production
```bash
npx wrangler d1 execute personal-site-db --file=./schema.sql --remote
```

### 3. Add Production Secrets
Secure your production environment by adding your password hash and JWT secret:
```bash
npx wrangler secret put ADMIN_PASSWORD_HASH
npx wrangler secret put JWT_SECRET
```

### 4. Deploy
```bash
npm run build
npx wrangler deploy
```

---

## 📂 Project Structure

```text
├── src/
│   ├── components/       # UI Components (Head, Header, Footer, PostCards, etc.)
│   ├── layouts/          # Astro Layouts (Public Base, Post Article layout, Admin Base)
│   ├── lib/              # Core logic (D1 Database helpers, JWT Auth, Markdown parsing)
│   ├── pages/            # Public-facing views (Home, Writing Index, individual posts)
│   │   ├── admin/        # Admin UI (Dashboard, New Post, Edit Post, Preview)
│   │   ├── api/          # SSR API endpoints for CRUD actions and Session Auth
│   ├── styles/           # Global CSS and Design System tokens
│   ├── middleware.ts     # Route protection (JWT Validation logic for /admin and /api)
├── schema.sql            # SQLite database schema migration
├── seed.sql              # Mock data for local testing
├── wrangler.json         # Cloudflare Workers configuration
└── package.json
```

## 📝 Writing in the Editor

The admin editor (`/admin/posts/new`) natively supports Markdown syntax for elegant long-form styling:

- Use `#` for headings.
- Use `> ` for blockquotes (styled beautifully for essays).
- Use \`\`\` for syntax-highlighted code blocks.
- The `Tags` field accepts a comma-separated list of keywords. 
- You can preview the exact rendered HTML at any time using the `Preview` button.

Enjoy writing!

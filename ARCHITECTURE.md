# HIMS Architecture

Web: Next.js + React + TypeScript + Tailwind + shadcn/ui.
Mobile: React Native + Expo + TypeScript.
Backend: NestJS + TypeScript modular monolith with hard domain boundaries.
Data: self-hosted Supabase/PostgreSQL; Redis/BullMQ; object storage; integration and AI gateways.

Client business writes go through NestJS. Supabase is the data platform, not the application business-logic layer.

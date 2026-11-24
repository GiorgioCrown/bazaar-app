# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Existing: Next.js 16 (App Router, server components), React 19, Tailwind 4. User requested shadcn/ui components.

## Users
Students of Programación 3 / Probabilidad y Estadística presenting the "Análisis probabilístico de malware" project to a professor (academic presentation, projected or delivered as screenshots). Secondary: anyone exploring MalwareBazaar samples.

## Product Purpose
Download MalwareBazaar records, classify them by malware family, and analyze occurrence probabilities. Expected deliverable: a report with the statistical distribution of malware families and a probabilistic model of occurrence. Success = results (distribution, probabilities, model fit) are understood at a glance.

## Positioning
A live statistical report over real abuse.ch MalwareBazaar data: multinomial family probabilities with Wilson CIs, Poisson arrival rates and a dispersion test, not just a sample list.

## Operating Context
Data comes from the MalwareBazaar API (recent_detections, up to 168 h) via server-side fetch with ABUSECH_AUTH_KEY. Spanish-language UI. Times are UTC.

## Capabilities and Constraints
Routes: `/` (explorer: recent/hash/tag/signature/file type/ClamAV search), `/analisis` (probabilistic report, range 24h/3d/7d, CSV export at `/analisis/csv`). Stats in `src/lib/stats.ts`. Must not invent data; API key stays server-side.

## Brand Commitments
User asked: use shadcn/ui components; dark theme with a vivid accent; more intuitive and eye-catching UI; analysis dashboard is the main screen, explorer secondary.

## Evidence on Hand
Live API data only. No logo or brand assets.

## Product Principles
1. The statistical result is the hero; every number says what it means.
2. Never present a probability without its model and caveat (e.g. overdispersion).
3. Real data only; clearly label estimates.

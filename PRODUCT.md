# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Existing: Next.js 16 (App Router, server components, Cache Components), React 19, Tailwind 4, recharts, three.js for the 3D page. Python FastAPI backend. User requested shadcn/ui components.

## Users
Students of Programación 3 / Probabilidad y Estadística presenting the "Análisis probabilístico de malware" project to a professor (academic presentation, projected or delivered as screenshots). Secondary: anyone exploring MalwareBazaar samples.

## Product Purpose
Download MalwareBazaar records, classify them by malware family, and analyze them with the probability and statistics syllabus. Expected deliverable: a report with the statistical distribution of malware families, a probabilistic model of occurrence, and each syllabus topic applied to the real data. Success = results (distribution, probabilities, model fit) are understood at a glance.

## Positioning
A live statistical report over real abuse.ch MalwareBazaar data that walks through the course syllabus: combinatorics, descriptive statistics, position measures, probability axioms, independence, conditional probability, Bayes and random variables, plus multinomial family probabilities with Wilson CIs and Poisson arrival rates with a dispersion test. Not just a sample list.

## Operating Context
Architecture: FastAPI (`api/`, pandas + scipy) does all fetching and statistics; Next.js 16 (Server Components + server actions) only presents and interprets, consuming the API through `src/lib/api.ts`. Only Python sees `ABUSECH_AUTH_KEY`. Spanish-language UI. Times are UTC. Contract: `docs/api-contract.md`.

## Capabilities and Constraints
Routes: `/analisis` (summary, families, trend, CSV at `/analisis/csv`), `/combinatoria` (topic 5, n,k calculator), `/estadistica` (topics 6-7), `/probabilidad` (topics 8-10), `/bayes` (topic 11, interactive lab), `/variables` (topic 12), `/visualizacion` (3D, topic 13), `/explorador` (sample search). Window of 1-168 h via `?hours=` (server action `setWindow`). Server actions: setWindow, refreshData, runBayes, runCombinatorics, searchSamples; all input validated server-side. Must not invent data; no mocks in the app.

## Brand Commitments
User asked: use shadcn/ui components; dark theme with a vivid accent; more intuitive and eye-catching UI; analysis dashboard is the main screen, explorer secondary.

## Evidence on Hand
Live API data only. No logo or brand assets.

## Product Principles
1. The statistical result is the hero; every number says what it means.
2. Never present a probability without its model and caveat (e.g. overdispersion).
3. Real data only; clearly label estimates.

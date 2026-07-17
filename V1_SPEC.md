# FounderCopilot v1 — Product Spec

## Summary

A website where a founder types a startup idea, clicks **Generate**, and receives a beautifully formatted validation report.

## User Flow

1. User lands on the website
2. User types a short idea (example: `AI-powered gym for remote workers.`)
3. User clicks **Generate**
4. User receives a formatted report with all sections below

No login required for v1. No multi-step wizard. One input, one button, one report.

## Input

- **Type:** Single text field
- **Example:** `AI-powered gym for remote workers.`
- **Action:** **Generate** button

## Output — Validation Report

The report must be beautifully formatted and include these sections:

| # | Section | Description |
|---|---------|-------------|
| 1 | **Market Analysis** | Overview of the market landscape and trends |
| 2 | **Problem Statement** | The core problem the idea solves |
| 3 | **ICP** | Ideal Customer Profile — who the best-fit customer is |
| 4 | **TAM** | Total Addressable Market — size of the opportunity |
| 5 | **Competitors** | Existing players and alternatives |
| 6 | **SWOT** | Strengths, Weaknesses, Opportunities, Threats |
| 7 | **Revenue Model** | How the business makes money |
| 8 | **MVP** | Minimum viable product to test the idea |
| 9 | **Go-To-Market** | How to reach and acquire customers |
| 10 | **Risks** | Key risks and challenges |

## Design Requirements

- Clean, professional, founder-friendly UI
- Report sections clearly separated and easy to read
- Polished enough to share with a co-founder or advisor

## Out of Scope (v1)

- User accounts / login
- Saving reports
- PRD generation
- Landing page generation
- Marketing plans
- Investor decks

## Success Criteria

A non-technical founder can:
1. Open the website
2. Type their idea in one sentence
3. Click Generate
4. Read a complete, well-formatted validation report in under 2 minutes

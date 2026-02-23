# Product Requirements Document: Tester Selector

**Version**: 1.0
**Date**: 2026-02-23
**Status**: Draft
**Owner**: CPM Team

---

## 1. Executive Summary

Tester Selector is a web application that automates the beta tester selection process for Centercode's CPM (Customer Project Manager) team. The application uses a Z3 constraint solver to optimally select testers from applicant pools based on recruitment requirements, demographic segmentation targets, and quality signals. It replaces a manual process that currently takes 1.5–3+ hours per project, saving an estimated 20+ hours per month across the CPM team while improving tester quality and consistency.

---

## 2. Problem Statement

### Current State
- CPMs manually review applicant pools of 50–1000+ testers for each beta test project
- Selection involves cross-referencing survey responses against requirements, checking blocklists, verifying demographic quotas, and reading free-text responses
- The process takes 1.5–3+ hours per project depending on pool size and complexity
- With ~10+ projects per month, the team spends 20+ hours monthly on tester selection alone
- Swapping out underperforming testers mid-project requires repeating much of this work
- Blocklist and golden ticket checking adds ~15 minutes per project (not counting handoff/communication time)
- Quality of selection varies by CPM experience and time pressure

### Desired State
- Automated tester selection based on defined requirements and constraints
- Consistent, high-quality tester cohorts across all projects and CPMs
- Quick swap-out of underperforming testers with qualified replacements
- Integrated blocklist/golden ticket checking eliminates manual cross-referencing
- Clear visibility into how well selections match demographic targets
- Selection process reduced to minutes of review rather than hours of manual work

---

## 3. Users and Roles

### 3.1 CPM (Customer Project Manager)
- **Primary user** of the application
- Creates projects, uploads survey data, defines requirements and segmentation targets
- Reviews and edits auto-mapped survey-to-requirement links
- Reviews auto-selected testers (approve/reject/consider)
- Exports final tester lists for project invitation
- Manages in-progress recruitments (save/resume)

### 3.2 Admin
- Manages CPM user accounts (create, deactivate, reset passwords)
- Manages global blocklist and golden ticket lists
- Has visibility into all projects across CPMs
- Configures system-wide settings (TGTBT thresholds, sentiment analysis mode)

---

## 4. Functional Requirements

### 4.1 Authentication & Authorization

| ID | Requirement | Priority |
|---|---|---|
| AUTH-1 | Users log in with email and password (credential-based auth) | P0 |
| AUTH-2 | Two roles: Admin and CPM | P0 |
| AUTH-3 | Route protection: unauthenticated users redirected to login | P0 |
| AUTH-4 | Admin-only routes (user management, global settings) restricted from CPMs | P0 |
| AUTH-5 | Session-based authentication with database-backed sessions | P0 |
| AUTH-6 | Password hashing with bcrypt | P0 |

### 4.2 Project Management

| ID | Requirement | Priority |
|---|---|---|
| PROJ-1 | Create a new project with name, description, target tester count, and surplus count | P0 |
| PROJ-2 | View list of all projects owned by the current user (CPMs see their own; admins see all) | P0 |
| PROJ-3 | Project status tracking through workflow stages: Draft → Requirements Defined → Data Uploaded → Mapping Review → Selection Ready → Selection Complete → Review In Progress → Complete | P0 |
| PROJ-4 | Edit project details (name, description, counts) before selection is run | P1 |
| PROJ-5 | Delete/archive a project | P2 |

### 4.3 Data Input — Survey Upload

| ID | Requirement | Priority |
|---|---|---|
| UPLOAD-1 | Upload CSV or Excel (.xlsx) files via drag-and-drop or file picker | P0 |
| UPLOAD-2 | Parse uploaded files server-side, extract headers (questions) and rows (tester responses) | P0 |
| UPLOAD-3 | Preview parsed data before confirming import (show first N rows, detected column types) | P0 |
| UPLOAD-4 | Detect question types automatically: multiple choice, numeric range, checkbox (multi-select), scale (1–10), free text | P0 |
| UPLOAD-5 | Store parsed survey questions and individual tester responses in the database | P0 |
| UPLOAD-6 | Handle common CSV edge cases: quoted fields, UTF-8 characters, different delimiters, empty cells | P1 |
| UPLOAD-7 | Map CSV columns to known fields (username, email) during upload | P0 |

### 4.4 Data Input — Requirements & Segmentation

| ID | Requirement | Priority |
|---|---|---|
| REQ-1 | Define recruitment requirements with: name, type (hard/soft), accepted values, weight (for soft requirements) | P0 |
| REQ-2 | Hard requirements are mandatory — testers who don't meet them are excluded from the pool | P0 |
| REQ-3 | Soft requirements are preferred — the solver maximizes soft requirement satisfaction | P0 |
| REQ-4 | Define segmentation dimensions with: name, target percentages per category, tolerance (acceptable deviation) | P0 |
| REQ-5 | Edit and delete requirements and segmentations before selection is run | P0 |
| REQ-6 | Validate that requirements and segmentations are complete before proceeding to mapping | P1 |

### 4.5 Data Input — Blocklist, Golden Tickets, Active Tests

| ID | Requirement | Priority |
|---|---|---|
| LIST-1 | Upload blocklist via CSV (username and/or email, optional reason) | P0 |
| LIST-2 | Upload golden ticket list via CSV (username and/or email, optional reason, priority level) | P0 |
| LIST-3 | Upload active test assignments via CSV (username and/or email, test name) | P0 |
| LIST-4 | Manually add/remove entries from blocklist and golden ticket lists | P0 |
| LIST-5 | Blocklist and golden ticket lists are global (shared across all projects) | P0 |
| LIST-6 | Active test assignments are global and can be updated per project cycle | P0 |
| LIST-7 | Betabound API integration stubs for blocklist, golden tickets, and community scores (to be connected later) | P1 |
| LIST-8 | View and search all lists in table format with sorting and filtering | P1 |

### 4.6 Survey-to-Requirement Mapping

| ID | Requirement | Priority |
|---|---|---|
| MAP-1 | Auto-map survey questions to requirements using string similarity (Levenshtein + keyword matching) | P0 |
| MAP-2 | Display confidence score (0–100%) for each auto-mapping | P0 |
| MAP-3 | Present mappings in a reviewable two-column interface (requirements ↔ survey questions) | P0 |
| MAP-4 | User can manually override, reassign, or create new mappings via dropdown or drag-and-drop | P0 |
| MAP-5 | Show unmapped requirements and unmapped survey questions in separate sections | P0 |
| MAP-6 | Map segmentation dimensions to survey questions | P0 |
| MAP-7 | Define value mappings (how survey answer values translate to requirement/segmentation values) | P1 |
| MAP-8 | Validate all hard requirements and segmentation dimensions have at least one mapping before proceeding | P0 |
| MAP-9 | Display warnings for gaps or low-confidence mappings | P1 |

### 4.7 Tester Selection (Z3 Solver)

| ID | Requirement | Priority |
|---|---|---|
| SOLVE-1 | Pre-filter applicant pool: remove blocklisted testers and those failing hard requirements | P0 |
| SOLVE-2 | Select exactly (target count + surplus count) testers from the eligible pool | P0 |
| SOLVE-3 | Satisfy segmentation target percentages within defined tolerance per dimension | P0 |
| SOLVE-4 | Prioritize golden ticket testers (weighted preference, not absolute override) | P0 |
| SOLVE-5 | Maximize total community score of selected cohort | P1 |
| SOLVE-6 | Penalize (but don't exclude) testers currently on other active tests | P1 |
| SOLVE-7 | Slightly penalize TGTBT-flagged testers in selection (they remain eligible but less preferred) | P1 |
| SOLVE-8 | Complete solve within 30 seconds for pools of 1000+ testers with 8 segmentation dimensions | P0 |
| SOLVE-9 | Pre-rank and limit pool to top 3x target count for very large pools (performance optimization) | P1 |
| SOLVE-10 | Timeout fallback: if Z3 exceeds time limit, use heuristic pre-ranked selection | P1 |
| SOLVE-11 | Generate a backup pool (configurable size, e.g., +20) beyond target+surplus for backfill | P0 |
| SOLVE-12 | Report infeasibility clearly if constraints cannot be satisfied (not enough eligible testers, impossible segmentation targets) | P0 |

### 4.8 "Too Good To Be True" (TGTBT) Detection

| ID | Requirement | Priority |
|---|---|---|
| TGTBT-1 | Extreme maximizer detection: calculate % of applicable questions (scale, ordinal MC) where tester chose highest/most extreme option. Flag if above configurable threshold (default 80%) | P0 |
| TGTBT-2 | Statistical outlier detection: compute z-scores per question across applicant pool, sum absolute z-scores per tester, flag if sum exceeds configurable threshold (default: >2 std dev above mean) | P0 |
| TGTBT-3 | Compute TGTBT scores during data upload/processing (not real-time during review) | P0 |
| TGTBT-4 | Display TGTBT flags with distinct icons for each type (maximizer vs outlier) during tester review | P0 |
| TGTBT-5 | TGTBT-flagged testers are NOT excluded — they are included for review with additional scrutiny indicators | P0 |
| TGTBT-6 | Admin-configurable thresholds for both detection methods | P2 |

### 4.9 Demographics Overview

| ID | Requirement | Priority |
|---|---|---|
| DEMO-1 | After solver runs, display a dashboard showing each segmentation dimension with target % vs actual % | P0 |
| DEMO-2 | Color-coded indicators: green (within tolerance), yellow (slightly off), red (significantly off) | P0 |
| DEMO-3 | Show total counts: selected, surplus, backup pool, remaining unselected, excluded | P0 |
| DEMO-4 | Visual bar charts or progress bars for each segment category | P1 |
| DEMO-5 | This screen is shown BEFORE individual tester review begins | P0 |

### 4.10 Sentiment Analysis

| ID | Requirement | Priority |
|---|---|---|
| SENT-1 | Analyze the "why" free-text response for each selected tester | P0 |
| SENT-2 | Primary: Claude API call with structured prompt requesting letter grade (A–F) and brief justification | P0 |
| SENT-3 | Fallback: local NLP library (basic positive/negative/neutral mapped to letter grades) when Claude API is unavailable | P0 |
| SENT-4 | Circuit breaker pattern: automatic fallback after N consecutive Claude API failures | P1 |
| SENT-5 | Batch processing with concurrency limits (default 5 concurrent requests) when selection is first generated | P0 |
| SENT-6 | Display sentiment letter grade as a color-coded badge during tester review | P0 |
| SENT-7 | Display brief sentiment justification on hover or in detail view | P1 |
| SENT-8 | Cache sentiment results per tester per project (don't re-analyze on page reload) | P0 |

### 4.11 Individual Tester Review

| ID | Requirement | Priority |
|---|---|---|
| REV-1 | Display full tester profile card with all survey responses | P0 |
| REV-2 | Color-code each response: green (meets requirement), yellow (partial match), red (does not meet) | P0 |
| REV-3 | Prominently display the "why" free-text response in a dedicated card | P0 |
| REV-4 | Display sentiment letter grade badge next to "why" response | P0 |
| REV-5 | Display TGTBT flags with distinct visual indicators per type | P0 |
| REV-6 | Display community score, active test status, golden ticket indicator | P0 |
| REV-7 | Three action buttons: Approve, Reject, Consider (review later) | P0 |
| REV-8 | Rejected testers are permanently removed from the selection pool for this project | P0 |
| REV-9 | When a tester is rejected, their slot is auto-backfilled from the backup pool (matching similar demographics) | P0 |
| REV-10 | Backfill happens in background while user continues reviewing other testers | P0 |
| REV-11 | Previous/Next navigation between testers | P0 |
| REV-12 | Sidebar list showing all selected testers with status icons (pending/approved/rejected/consider) | P0 |
| REV-13 | Filter sidebar by status (show only pending, only consider, etc.) | P1 |
| REV-14 | Optional reviewer notes field per tester | P2 |

### 4.12 Save/Resume

| ID | Requirement | Priority |
|---|---|---|
| SAVE-1 | Auto-save review progress (which testers have been approved/rejected/considered) | P0 |
| SAVE-2 | Track current workflow step and last reviewed tester per project | P0 |
| SAVE-3 | When opening a project, detect in-progress session and offer to resume | P0 |
| SAVE-4 | Resume from the exact point where user left off (correct step, correct tester in review) | P0 |

### 4.13 Export

| ID | Requirement | Priority |
|---|---|---|
| EXP-1 | Export approved testers as CSV | P0 |
| EXP-2 | Configurable export columns: username only, email only, or both | P0 |
| EXP-3 | Option to include additional survey response columns in export | P1 |
| EXP-4 | Copy-to-clipboard for quick username list | P2 |

### 4.14 Admin Features

| ID | Requirement | Priority |
|---|---|---|
| ADMIN-1 | Create new CPM user accounts (name, email, password, role) | P0 |
| ADMIN-2 | View all projects across all CPMs | P1 |
| ADMIN-3 | Reset user passwords | P1 |
| ADMIN-4 | Deactivate user accounts | P2 |

---

## 5. Non-Functional Requirements

### 5.1 Performance
| ID | Requirement |
|---|---|
| PERF-1 | Z3 solver completes within 30 seconds for pools of 1000+ testers with 8 segmentation dimensions |
| PERF-2 | CSV parsing completes within 5 seconds for files with 1000 rows |
| PERF-3 | Tester review page loads within 2 seconds |
| PERF-4 | Backfill completes within 5 seconds after tester rejection |
| PERF-5 | Sentiment batch analysis shows progress indicator and doesn't block UI |

### 5.2 Reliability
| ID | Requirement |
|---|---|
| REL-1 | Sentiment analysis falls back gracefully when Claude API is unavailable |
| REL-2 | Solver reports infeasibility clearly rather than hanging or crashing |
| REL-3 | In-progress sessions are auto-saved; no work lost on browser close/crash |
| REL-4 | File uploads validate format and reject malformed files with helpful error messages |

### 5.3 Security
| ID | Requirement |
|---|---|
| SEC-1 | Passwords hashed with bcrypt (minimum 10 salt rounds) |
| SEC-2 | Session-based auth with database-backed sessions |
| SEC-3 | PII (email addresses) stored encrypted at rest or handled through configurable export (username-only option) |
| SEC-4 | CSRF protection on all mutating endpoints |
| SEC-5 | Input sanitization on all user-provided data |

### 5.4 Usability
| ID | Requirement |
|---|---|
| USE-1 | Clean, scannable UI optimized for quick review decisions |
| USE-2 | Color coding and visual hierarchy to speed up tester evaluation |
| USE-3 | Workflow step indicator showing progress through the selection process |
| USE-4 | Error states with clear, actionable messages |
| USE-5 | Loading skeletons for all async operations |
| USE-6 | Toast notifications for user actions (saved, exported, etc.) |

---

## 6. Technical Architecture

### 6.1 System Architecture
```
┌─────────────────────────────────────────────┐
│                  Browser                     │
│  Next.js App (React + Tailwind + shadcn/ui) │
└─────────────┬───────────────────────────────┘
              │ HTTPS
┌─────────────▼───────────────────────────────┐
│            Next.js Server                    │
│  ┌──────────────┐  ┌─────────────────────┐  │
│  │  API Routes   │  │  Server Components  │  │
│  └──────┬───────┘  └─────────┬───────────┘  │
│         │                    │               │
│  ┌──────▼────────────────────▼───────────┐  │
│  │           Service Layer                │  │
│  │  ┌─────────┐ ┌──────────┐ ┌────────┐  │  │
│  │  │Z3 Solver│ │Sentiment │ │CSV     │  │  │
│  │  │         │ │Analysis  │ │Parser  │  │  │
│  │  └─────────┘ └────┬─────┘ └────────┘  │  │
│  │                   │                    │  │
│  │            ┌──────▼──────┐             │  │
│  │            │ Claude API  │             │  │
│  │            │ (external)  │             │  │
│  │            └─────────────┘             │  │
│  └──────────────────┬────────────────────┘  │
│                     │                        │
│  ┌──────────────────▼────────────────────┐  │
│  │         Prisma ORM                     │  │
│  └──────────────────┬────────────────────┘  │
└─────────────────────┼───────────────────────┘
                      │
┌─────────────────────▼───────────────────────┐
│              PostgreSQL                      │
└─────────────────────────────────────────────┘
```

### 6.2 Z3 Solver Design

**Problem formulation**: Weighted constraint optimization using Z3's `Optimize` class.

**Variables**: Boolean `selected_i` per eligible tester (is tester i in the cohort?).

**Hard constraints**:
- `Sum(all selected_i) == targetCount + surplusCount`
- `selected_i == false` for all blocklisted testers
- `selected_i == false` for all testers failing any hard requirement

**Optimization objectives**:
- Minimize segmentation deviation: for each dimension/category, minimize `|actual_count - target_count|`
- Maximize golden ticket inclusion (weighted by priority)
- Maximize total community score of selected cohort
- Minimize selection of testers on active tests (soft penalty)

**Performance strategy**:
1. Pre-filter ineligible testers in TypeScript (removes 20–50% of pool typically)
2. For pools >3x target count, pre-rank by composite score and limit Z3 input
3. Z3 timeout of 25 seconds with heuristic fallback

**Backfill strategy**:
1. Initial solve produces target + surplus + backup pool (e.g., +20 ranked alternates)
2. Rejection promotes next backup tester matching similar demographics
3. Full re-solve only if backup pool exhausted

### 6.3 Sentiment Analysis Design

**Primary path (Claude API)**:
- Prompt template requests letter grade (A–F) based on: response length, specificity, genuine enthusiasm, relevance to the product/test
- Grading rubric: A = detailed, specific, genuine enthusiasm; B = good detail, relevant; C = adequate but generic; D = minimal effort, vague; F = copy-paste, irrelevant, or suspicious
- Batch processing with 5 concurrent requests, progress tracking

**Fallback path (local NLP)**:
- `sentiment` npm package for basic positive/negative scoring
- Additional heuristics: response length, vocabulary diversity (unique words / total words), question-specific keyword matching
- Map composite score to letter grade

**Circuit breaker**: After 3 consecutive Claude API failures within 60 seconds, switch to local fallback for remaining batch. Reset after 5 minutes.

### 6.4 Auto-Mapping Design

**String similarity approach**:
1. Normalize both question text and requirement names (lowercase, remove punctuation, stem common words)
2. Compute Levenshtein distance and Jaccard similarity on word sets
3. Check for keyword containment (requirement name words found in question text)
4. Composite confidence score (0–1) from weighted combination of metrics
5. Accept mappings above threshold (default 0.5), present all above 0.3 as suggestions

---

## 7. Data Model Summary

### Core Entities
- **User**: Authentication, role (Admin/CPM), project ownership
- **Project**: Container for a single test's recruitment process with status tracking
- **Requirement**: What qualifications testers must (hard) or should (soft) have
- **Segmentation**: Demographic dimensions with target percentage distributions
- **SurveyQuestion**: Individual questions parsed from uploaded survey data
- **QuestionMapping**: Links between survey questions and requirements (auto or manual)
- **TesterApplicant**: Individual tester with their survey responses and quality signals
- **SurveyResponse**: Normalized individual answer to a specific question
- **TesterSelection**: Per-project selection status, sentiment grade, review state

### Global Entities
- **BlocklistEntry**: Banned testers (email/username)
- **GoldenTicketEntry**: Priority testers with priority levels
- **ActiveTestAssignment**: Testers currently participating in other tests

### Session Entities
- **RecruitmentSession**: Save/resume state for in-progress recruitment workflows

---

## 8. User Workflows

### 8.1 Primary Workflow: New Project Selection
```
Login → Create Project → Upload Survey CSV → Define Requirements & Segmentation
→ Review Auto-Mappings → Edit Mappings → Run Z3 Solver → View Demographics Overview
→ Review Individual Testers (Approve/Reject/Consider) → Export Approved List
```

### 8.2 Backfill Workflow: Client Rejects Testers
```
Open Existing Project → View Current Selections → Reject Specific Testers
→ System Auto-Backfills from Backup Pool → Review Backfilled Testers → Export Updated List
```

### 8.3 Resume Workflow: Continue In-Progress Review
```
Login → View Projects → Open In-Progress Project → System Detects Session
→ Resume from Last Reviewed Tester → Continue Approve/Reject/Consider → Export
```

---

## 9. UI/UX Key Screens

### 9.1 Project Hub
Central page for a project showing current status, workflow step progress indicator, and links to each step. Shows summary stats (applicant count, requirements defined, selection status).

### 9.2 Upload Screen
Drag-and-drop zone for CSV/Excel files. Preview table showing first 10 rows of parsed data. Column type detection indicators. Confirm/cancel import.

### 9.3 Requirements Screen
Split view: left panel for hard/soft requirements list, right panel for segmentation dimensions. Add/edit/delete forms inline. Visual summary of what's defined.

### 9.4 Mapping Review Screen
Two-column layout: requirements on left, survey questions on right. Lines or badges connecting mapped pairs with confidence scores. Unmapped items highlighted in yellow. Dropdown/drag-and-drop to reassign.

### 9.5 Demographics Overview
Bar chart dashboard: one row per segmentation dimension showing target vs. actual percentages. Color-coded (green/yellow/red). Summary cards for total selected, surplus, backup count.

### 9.6 Tester Review Screen
Left sidebar: scrollable list of testers with status icons and quick-filter tabs (All/Pending/Approved/Rejected/Consider). Main area: full tester card with:
- Header: username, community score badge, golden ticket indicator, TGTBT flags
- Survey responses in a table/grid, each cell color-coded by match quality
- "Why" response in a prominent card with sentiment grade badge
- Action bar: Approve (green), Consider (yellow), Reject (red) buttons
- Navigation: Previous/Next arrows

### 9.7 Export Screen
Column selection checkboxes (username, email, additional fields). Preview of export. Download CSV button. Copy-to-clipboard button.

---

## 10. API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/[...nextauth]` | Auth.js handler |
| GET/POST | `/api/projects` | List projects / Create project |
| GET/PATCH/DELETE | `/api/projects/[id]` | Get / Update / Delete project |
| POST | `/api/projects/[id]/upload` | Upload and parse survey CSV |
| GET/POST/PATCH/DELETE | `/api/projects/[id]/requirements` | CRUD requirements |
| GET/POST/PATCH/DELETE | `/api/projects/[id]/segmentations` | CRUD segmentations |
| GET/POST | `/api/projects/[id]/mapping` | Get/save question-to-requirement mappings |
| POST | `/api/projects/[id]/mapping/auto` | Trigger auto-mapping |
| POST | `/api/projects/[id]/solve` | Trigger Z3 solver |
| GET | `/api/projects/[id]/selection` | Get current selection results |
| PATCH | `/api/projects/[id]/selection/[testerId]` | Update tester status (approve/reject/consider) |
| POST | `/api/projects/[id]/backfill` | Trigger backfill for rejected slot |
| POST | `/api/projects/[id]/sentiment` | Trigger batch sentiment analysis |
| GET | `/api/projects/[id]/export` | Generate and download export CSV |
| GET/POST/DELETE | `/api/blocklist` | CRUD blocklist entries |
| POST | `/api/blocklist/upload` | Upload blocklist CSV |
| GET/POST/DELETE | `/api/golden-tickets` | CRUD golden ticket entries |
| POST | `/api/golden-tickets/upload` | Upload golden tickets CSV |
| GET/POST/DELETE | `/api/active-tests` | CRUD active test assignments |
| POST | `/api/active-tests/upload` | Upload active tests CSV |
| GET/POST | `/api/admin/users` | List / Create users (admin only) |
| PATCH | `/api/admin/users/[id]` | Update user (admin only) |

---

## 11. Success Metrics

| Metric | Target |
|---|---|
| Time to select testers per project | <15 minutes (down from 1.5–3+ hours) |
| Solver feasibility rate | >95% of projects produce a feasible selection |
| Segmentation accuracy | Within defined tolerance for all dimensions |
| CPM adoption | All CPMs using the tool within 1 month of launch |
| Tester swap turnaround | <5 minutes (down from 30+ minutes) |

---

## 12. Out of Scope (v1)

- Direct Betabound API integration (stubbed, with CSV upload as interim)
- Integration into Centercode platform or Agentic
- Mobile-responsive design (desktop-first, CPMs use desktop)
- Real-time collaboration (multiple CPMs reviewing the same project simultaneously)
- Historical analytics across projects
- Automated tester performance tracking
- Email/notification system for tester invitations

---

## 13. Future Considerations (v2+)

- Live Betabound API connection for blocklist, golden tickets, community scores
- Platform integration (embed in Centercode or expose as Agentic capability)
- Historical selection analytics (which tester profiles lead to best test outcomes)
- Automated re-selection when tester performance drops below threshold
- Multi-CPM collaboration on large projects
- AI-powered requirement generation from project briefs

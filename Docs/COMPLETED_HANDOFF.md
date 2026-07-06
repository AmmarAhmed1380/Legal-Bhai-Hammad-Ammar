# LegalBahi Project Status & Technical Handoff Report

LegalBahi is a multi-surface practice management platform designed for lawyers practicing in Pakistan (with primary focus on the Islamabad High Court, Lahore High Court Rawalpindi Bench, and Rawalpindi District & Sessions Courts). 

This report provides a comprehensive directory of the product's features across all surfaces (Lawyer Web Dashboard, Client Portal, Mobile App, and Backend Worker), explaining **what they do**, **how they work**, and their **expected results**.

---

## 1. Lawyer Web Dashboard

The web dashboard is the main working interface for lawyers and administrative staff.

### 1.1 Passwordless OTP Authentication
* **Description**: Secure, credential-less authentication for staff members.
* **How it Works**: The lawyer enters their registered phone number. The API creates a short-lived, 6-digit OTP code, stores its hash in the database, and schedules a dispatch. When the code is entered, the server issues a signed JSON Web Token (JWT) and a secure HTTP-only refresh token.
* **Expected Result**: On inputting the correct code, the user is authenticated and redirected to `/overview`. In development mode, entering the mock code `246810` yields a successful login.

### 1.2 Interactive Overview Dashboard (`/overview`)
* **Description**: A morning briefing center summarizing case activity, court schedules, and critical actions.
* **How it Works**: Aggregates calendar records, match requests, and notifications dynamically using Fastify database views.
* **Expected Result**: Displays today's scheduled hearings, upcoming dates for the week, active client threads needing attention, and warnings about unmatched online cause list entries.

### 1.3 Case & Matter Management
* **Description**: CRUD interface to record and organize case portfolios.
* **How it Works**: Persists cases in the `matters` database table. Normalizes Pakistani case number patterns (e.g., *W.P. 1234/2026*). Includes fields for case title, court, case type, current stage, and status (active, closed, archived).
* **Expected Result**: Lawyers can search, filter, update, or archive cases. Storing a case generates a clean record visible to linked team members.

### 1.4 Next-Date Diary & Hearing Logs
* **Description**: Historical timeline log of case hearings and outcome descriptions.
* **How it Works**: Whenever a hearing concludes, the lawyer records the outcome, notes, and the next scheduled date, which updates the matter's primary schedule.
* **Expected Result**: Updates the diary history. The next scheduled hearing date is automatically added to the interactive calendar.

### 1.5 Smart Calendar View
* **Description**: Monthly and weekly grid views of practice commitments.
* **How it Works**: Renders calendar layouts populated from the `hearings` data table, combining manual lawyer-entered dates and verified cause-list synchronization schedules.
* **Expected Result**: Provides a clean view of all scheduled court commitments. Double-clicking a calendar event displays the case summary.

### 1.6 Hearing Conflict Warning Engine
* **Description**: Automated conflict scanner detecting scheduling clashes across courts.
* **How it Works**: Scans the database for hearings scheduled for the same lawyer on the same date and time slot across different courts or benches.
* **Expected Result**: Displays a high-visibility warning banner in both the Matter Details page and the main Calendar if a lawyer is scheduled to be in two places at once.

### 1.7 Secure Document Vault
* **Description**: Storage folder for case briefs, power of attorney documents, and evidence files.
* **How it Works**: Uploads files to Cloudflare R2 bucket. Access is private by default. Supports a "Client Portal Visibility" boolean toggle. Downloads are generated using pre-signed, temporary URLs that expire after 15 minutes.
* **Expected Result**: Files are safely stored and only accessible to verified workspace members, unless explicitly toggled as visible to the client.

### 1.8 Client Directory & Consent Logs
* **Description**: Database of client contacts and communication preferences.
* **How it Works**: Stores client phone numbers, email addresses, and reminder preferences (SMS/Email). Records client SMS reminder consent in compliance with telecommunication guidelines.
* **Expected Result**: Generates client profiles that can be linked to multiple matters.

### 1.9 Cause List Matching & Manual Review
* **Description**: Control center to review automated online court scrapers against local cases.
* **How it Works**: Compares case titles and numbers scraped from official court lists (like the Islamabad High Court cause list) with the lawyer's database. If the match confidence is low, it queues the item in the review center.
* **Expected Result**: The lawyer can manually match scraped entries to local matters. Once matched, the next hearing date is synced to the calendar.

---

## 2. Client Portal

A secure, standalone web application that allows clients to track their case updates without having access to the lawyer's database.

### 2.1 Protected Portal Routing (`/c/[token]`)
* **Description**: Standalone route generated for clients.
* **How it Works**: The lawyer generates a unique portal link containing a cryptographic token linked to a specific client and matter.
* **Expected Result**: Navigating to the URL redirects the client to an OTP security page.

### 2.2 Portal OTP Authentication
* **Description**: Access verification for the client.
* **How it Works**: Requests verification by sending an OTP to the linked client's phone number. On verification, it returns a scoped token allowing view access for that specific matter.
* **Expected Result**: Validates that only the actual client can view their case details.

### 2.3 Scoped Case Visibility
* **Description**: The restricted view visible to the authenticated client.
* **How it Works**: Filters database requests so the client can query only their linked matter.
* **Expected Result**: The client sees their current case stage, next hearing date, lawyer-written outcome updates, and files that have been marked as client-visible. The client cannot see internal lawyer notes or other cases.

---

## 3. Android Mobile Application

A native React Native client that provides portable diary access for lawyers on the move.

### 3.1 Persistent Offline Sessions
* **Description**: Keeps the lawyer logged in securely on their device.
* **How it Works**: Saves JWT tokens in Android's secure keystore (`expo-secure-store`).
* **Expected Result**: The app opens directly to the matter dashboard without requiring OTP logins on every launch.

### 3.2 Handheld Matter Directory
* **Description**: Mobile-optimized case listings.
* **How it Works**: Queries `/api/product/matters` and displays list layouts.
* **Expected Result**: Allows lawyers to search cases and view hearing histories directly from their phones inside the courtroom.

### 3.3 Quick Hearing Outcomes Entry
* **Description**: Fast logging of courtroom updates.
* **How it Works**: Provides simple forms to update hearing outcomes and schedule next-dates.
* **Expected Result**: Updates the server database in real time, alerting the office staff.

### 3.4 Camera Document Capture
* **Description**: Instant upload of physical court orders or documents.
* **How it Works**: Uses the device camera to take photos of documents and uploads them to the R2 vault via the API.
* **Expected Result**: Uploaded document images are saved to the case vault and available to view on the web dashboard.

---

## 4. Backend API & Worker System

The Fastify backend and database-backed worker queue.

### 4.1 Background Worker Queue
* **Description**: Database-backed scheduler running asynchronous tasks.
* **How it Works**: Scans the `jobs` database table for due tasks (e.g., daily agendas, client reminders).
* **Expected Result**: Processes notifications and updates without blocking the web or mobile user interface.

### 4.2 Automated Client Reminders
* **Description**: Auto-dispatched SMS alerts to clients.
* **How it Works**: Runs 24 hours before a scheduled hearing to verify client consent and dispatch the template message.
* **Expected Result**: Clients receive an SMS update regarding their hearing time and courtroom.

### 4.3 Transactional SMS & Email Drivers
* **Description**: Direct integrations with Twilio and Resend.
* **How it Works**: Twilio API sends SMS messages. Resend API sends emails.
* **Expected Result**: Delivers notifications to external users. 

> [!NOTE]
> **Twilio Staging Sandbox**: Currently configured to send SMS alerts to verified developer test numbers due to Twilio trial limitations. Switching to production SMS broadcasting simply requires entering paid credentials in the `.env` configuration file on launch.

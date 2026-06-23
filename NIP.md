# NIP — Cardano Tender Hub

This project is a **Cardano-secured tender marketplace** that does **not** define
custom Nostr kinds. It uses Cardano wallets (Eternl, Typhon) via CIP-30 as the
identity and signing layer, with Aiken smart contracts for escrow.

## Smart Contract Architecture

### Contract Types (Vary by Occupation)

Different occupations need different escrow structures. The platform supports
four contract types, each enforced on-chain by the Aiken validator:

| Type | Use Case | Payment Release |
|------|----------|----------------|
| **Lump Sum** | Small, well-defined projects | Single payment on full delivery |
| **Milestone-Based** | Large, multi-phase projects (construction, software) | Payment released per milestone as work is completed and approved |
| **Time-Based** | Consulting, ongoing services | Periodic payments based on time intervals |
| **Performance-Based** | Outcomes-driven contracts | Payment tied to measurable KPIs |

### Milestone System

For milestone-based contracts:
- Buyer defines milestones during tender creation (title, description, amount, due date)
- Milestone amounts must total the tender budget
- Each milestone goes through: `pending → in_progress → submitted → approved/rejected → (resubmit loop)`
- Payment is released per-milestone — partial work gets partial payment
- Supplier submits evidence (documents, photos) for each milestone
- Buyer reviews and approves/rejects

### Dispute Resolution

A reliable, on-chain dispute mechanism:

1. **Either party** can file a dispute (buyer or supplier)
2. Filing **freezes the contract** — no funds can move until resolution
3. A designated **arbitrator** is assigned to review the dispute
4. Both parties can submit **evidence** (documents, descriptions)
5. The arbitrator issues a **ruling** with a fund split (0–100% to buyer)
6. The split is **enforced on-chain** — neither party can override it
7. Dispute scopes: milestone issues, quality, timeline, payment, general

### Progress Tracking

Every contract shows real-time progress:
- Visual progress bar (X/Y milestones completed)
- Released vs. in-escrow vs. total amounts
- Per-milestone status with timeline
- Immutable audit log of all actions (created, started, submitted, approved, rejected, disputed, resolved)

### Security Features (Bold, On-Chain Enforced)

All security checks are enforced by the Aiken smart contract validator:

1. **Multi-Signature Confirmation** — Arbitrator must co-sign milestone releases
2. **Replay Attack Protection** — Nonce-based, each transaction can only execute once
3. **Timelocked Auto-Approve** — Milestones auto-approve if buyer doesn't respond within configurable window (prevents buyer griefing)
4. **Timelocked Refund** — Contract deadline auto-refunds buyer (funds can never be locked forever)
5. **Dispute Freeze** — Active disputes block all normal operations; only arbitrator can unlock
6. **Arbitrator Override** — Designated arbitrator can split funds per ruling (court of last resort)
7. **Milestone-Gated Release** — Funds partitioned into milestones; no all-or-nothing risk
8. **Amount Exactness** — Validator checks exact milestone amount paid to exact supplier address
9. **Signature Required** — Every action (submit, approve, reject) requires a wallet signature proof

## Identity Layer

- Users connect an **Eternl** or **Typhon** wallet via CIP-30
- The wallet address is the user's unique identity
- Registration, tender publication, bid submission, milestone actions, and dispute filings all require `signData()` proofs
- `signData()` payloads are hex-encoded (CIP-30 requirement); addresses are converted from bech32 to hex CBOR

## Certificate Verification

### File Upload from Device

KYC documents and ISO certifications are **uploaded from the user's device**:
- The user selects a file (PDF, JPG, PNG) from their device using a file picker
- File metadata (name, size, type) is captured alongside the upload
- Each document/certificate is **wallet-signed** using `signData()` — this creates a cryptographic proof that the wallet owner has endorsed the document as authentic

### Wallet-Signed Certificate Verification

When a certificate is uploaded:
1. The app calls `signCertificate()` which signs a message containing the certificate metadata (type, label, filename, size, timestamp)
2. The wallet prompts the user to sign — this is a CIP-30 `signData()` call
3. The signature is stored alongside the certificate metadata
4. In production, the Aiken smart contract validator would verify this signature on-chain before accepting the certificate as valid
5. Only certificates that are **signed against the wallet** are accepted — this proves the certificate is original and the wallet owner has endorsed it

### Tender Requirements with File/Document Verification

Tender requirements can now be either:
- **Text requirements** — simple descriptions (e.g., "Must have NCA Category A license")
- **File requirements** — require the supplier to upload a document when bidding
- **Wallet-signed file requirements** — require the supplier to upload a document AND sign it with their wallet (e.g., "Must provide wallet-signed ISO 9001 certificate")

The smart contract / code verifies that:
1. The file was uploaded from the device
2. The file metadata was signed against the supplier's wallet
3. The signature is valid (verified on-chain in production)

## Data Layer

### MVP: localStorage + Cross-Device Sync

For the MVP, data is stored in localStorage. Cross-device synchronization uses:

1. **BroadcastChannel API** — for real-time sync across browser tabs on the same device
2. **Storage events** — for cross-tab sync when data changes
3. **Nostr NIP-78 (appData)** — for cross-device sync via Nostr relays
   - All platform state (registrations, tenders, bids, contracts) is published as a NIP-78 addressable event (kind 30078) with d-tag `tenderhub-state`
   - The event is signed with the user's Nostr identity (nsec, NIP-07 extension, or NIP-46 bunker) via Nostrify's signer — not raw `window.nostr`
   - The event is published to all configured write relays via `nostr.event()`
   - On mount, each device queries for the latest kind 30078 event and opens a live subscription (`nostr.req()`) for real-time updates
   - A 15-second polling fallback (`nostr.query()`) catches updates if the live subscription fails
   - Incoming remote state is **merged** per-entity (by `id`, last-write-wins by `updatedAt`) — not blindly overwritten — so concurrent creates on different devices both survive
   - Changes are debounced (2-second delay) to avoid flooding relays
   - Works with any Nostr login method (nsec, extension, NIP-46 bunker) — no separate NIP-07 extension required

This fixes the issue where adding a tender on a laptop didn't update on a phone — data now syncs through Nostr relays.

### Production Roadmap
- **Cardano indexer** (Blockfrost/Carp) for on-chain escrow state
- **Nostr events** for off-chain metadata (profiles, portfolio items)
- **Blossom** for encrypted file storage of KYC/ISO documents

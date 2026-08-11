# 🏛️ Government Fund Allocation and Tracking System over Blockchain

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solidity](https://img.shields.io/badge/Solidity-%23363636.svg?logo=solidity&logoColor=white)](https://soliditylang.org/)
[![Flask](https://img.shields.io/badge/Flask-%23000.svg?logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![React](https://img.shields.io/badge/React-%2320232a.svg?logo=react&logoColor=%2361DAFB)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-%23646CFF.svg?logo=vite&logoColor=white)](https://vitejs.dev/)
[![MongoDB](https://img.shields.io/badge/MongoDB-%234ea94b.svg?logo=mongodb&logoColor=white)](https://www.mongodb.com/)

A next-generation, multi-tier, decentralized governance and public financial management platform designed to eliminate leakages, ensure real-time accountability, and provide tamper-proof tracking of public development funds from Central Sanction down to Contractor Milestone Disbursals and Citizen Auditing.

---

## 🌟 Key Highlights & Capabilities

- 🔐 **Cryptographic Immutability**: All sanctions, budget allocations, milestone completions, and fund disbursals are anchored on an Ethereum/EVM-compatible blockchain smart contract.
- 🏢 **Multi-Tier Hierarchy**:
  - **National / Central Ministry**: Scheme creation, national budget allocation, macro analytics.
  - **State Level Administration**: State-wise quota allocation, oversight, and monitoring.
  - **District Level Officers**: Project creation, geo-location assignment, contractor bidding/approvals, physical inspection verification.
  - **Contractors**: Milestone progression submission, proof-of-work upload (geo-tagged photos, invoices, completion certificates).
  - **Public / Citizens**: Transparent public explorer, grievance filing, project progress inspection, community feedback.
- 💸 **Milestone-Based Escrow Release**: Automated smart contract fund disbursals released strictly upon verified milestone completion and multi-level approvals.
- 📢 **Public Transparency & Grievance Portal**: Open public access to search projects by State, District, and Scheme with real-time grievance tracking.

---

## 🛠️ Architecture & Tech Stack

```
GOVTFUND/
├── backend/          # Python Flask REST API & Web3 Middleware
│   ├── routes/       # API endpoints (Auth, Admin, State, District, Contractor, Public)
│   ├── config/       # Contract ABIs and configuration
│   └── database.py   # MongoDB models and connection handlers
├── blockchain/       # Hardhat Smart Contracts (Solidity)
│   ├── contracts/    # GovernmentFundTracking.sol
│   └── scripts/      # Deployment scripts
└── frontend/         # React + Vite UI Dashboard
    ├── src/          # Components, pages, contextual state, and Lucide icons
    └── index.html    # Entry page
```

- **Smart Contracts**: Solidity (`^0.8.19`), Hardhat, Ethers.js / Web3.py
- **Backend API**: Python 3.10+, Flask, Flask-CORS, PyMongo, PyJWT, Web3.py, Bcrypt
- **Database**: MongoDB (Off-chain metadata, documents, activity logs)
- **Frontend**: React 18, Vite, React Router DOM, Tailwind/Modern CSS, Lucide React

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** (v18+)
- **Python** (v3.10+)
- **MongoDB** (Local instance or MongoDB Atlas)
- **Ganache** or **Hardhat Node** (for local Ethereum RPC)

---

### 2. Smart Contract Setup & Deployment

1. Navigate to the `blockchain` directory:
   ```bash
   cd blockchain
   npm install
   ```

2. Start a local blockchain node (e.g. Ganache on port `7545` or Hardhat Node on port `8545`):
   ```bash
   npx hardhat node
   ```

3. Deploy the smart contract:
   ```bash
   npx hardhat run scripts/deploy.js --network localhost
   ```
   *Copy the deployed contract address into your backend `.env` file.*

---

### 3. Backend Setup

1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment and activate it:
   ```bash
   # Windows
   python -m venv venv
   .\venv\Scripts\activate

   # Linux/macOS
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Configure `.env` file (copy from `.env.example`):
   ```env
   PORT=5000
   MONGODB_URI=mongodb://127.0.0.1:27017
   MONGODB_DB_NAME=FUNDSYSTEM
   JWT_SECRET=your_jwt_secret_key_here
   BLOCKCHAIN_RPC_URL=http://127.0.0.1:7545
   BLOCKCHAIN_PRIVATE_KEY=your_private_key_here
   CONTRACT_ADDRESS=your_deployed_contract_address_here
   ```

5. (Optional) Seed initial data / simulate workflow:
   ```bash
   python seed_data.py
   ```

6. Run the Flask backend:
   ```bash
   python app.py
   ```

---

### 4. Frontend Setup

1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   npm install
   ```

2. Start the Vite development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:5173](http://localhost:5173) in your browser.

---

### ⚡ Quick Start (Windows Launcher)

You can launch both the backend and frontend simultaneously with a single click:
```cmd
run_project.bat
```

---

## 🔒 Security & Best Practices

- **Private Keys**: Never commit `.env` or private keys to source control.
- **RBAC Enforcement**: Server-side role validation on every API endpoint paired with JWT claims.
- **On-chain Verification**: Financial disbursals cryptographically verified against on-chain state.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("GovernmentFundTracking Smart Contract", function () {
  let contract;
  let admin, finance, state, district, contractor, auditor, stranger;

  let SUPER_ADMIN_ROLE;
  let FINANCE_ROLE;
  let STATE_ROLE;
  let DISTRICT_ROLE;
  let CONTRACTOR_ROLE;
  let AUDITOR_ROLE;

  beforeEach(async function () {
    [admin, finance, state, district, contractor, auditor, stranger] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("GovernmentFundTracking");
    contract = await Factory.deploy();
    await contract.waitForDeployment();

    SUPER_ADMIN_ROLE = await contract.SUPER_ADMIN_ROLE();
    FINANCE_ROLE = await contract.FINANCE_ROLE();
    STATE_ROLE = await contract.STATE_ROLE();
    DISTRICT_ROLE = await contract.DISTRICT_ROLE();
    CONTRACTOR_ROLE = await contract.CONTRACTOR_ROLE();
    AUDITOR_ROLE = await contract.AUDITOR_ROLE();

    // Initialize default departmental roles
    await contract.connect(admin).initializeDefaultRoles(
      finance.address,
      state.address,
      district.address,
      contractor.address,
      auditor.address
    );
  });

  describe("1. Access Control & Role Governance", function () {
    it("assigns superAdmin to deployer with SUPER_ADMIN_ROLE", async function () {
      expect(await contract.superAdmin()).to.equal(admin.address);
      expect(await contract.hasRole(SUPER_ADMIN_ROLE, admin.address)).to.be.true;
    });

    it("initializes default roles correctly", async function () {
      expect(await contract.hasRole(FINANCE_ROLE, finance.address)).to.be.true;
      expect(await contract.hasRole(STATE_ROLE, state.address)).to.be.true;
      expect(await contract.hasRole(DISTRICT_ROLE, district.address)).to.be.true;
      expect(await contract.hasRole(CONTRACTOR_ROLE, contractor.address)).to.be.true;
      expect(await contract.hasRole(AUDITOR_ROLE, auditor.address)).to.be.true;
      expect(await contract.hasRole(FINANCE_ROLE, stranger.address)).to.be.false;
    });

    it("allows superAdmin to grant new roles and emits RoleGranted", async function () {
      await expect(contract.connect(admin).grantRole(FINANCE_ROLE, stranger.address))
        .to.emit(contract, "RoleGranted")
        .withArgs(FINANCE_ROLE, stranger.address, admin.address);

      expect(await contract.hasRole(FINANCE_ROLE, stranger.address)).to.be.true;
    });

    it("enforces role revocation and blocks subsequent privileged calls", async function () {
      // 1. Verify finance has role and can allocate
      expect(await contract.hasRole(FINANCE_ROLE, finance.address)).to.be.true;
      await contract.connect(finance).allocateBudget("ALC-TEST-001", "Health Scheme", "Health Dept", 1000000);

      // 2. Revoke role
      await expect(contract.connect(admin).revokeRole(FINANCE_ROLE, finance.address))
        .to.emit(contract, "RoleRevoked")
        .withArgs(FINANCE_ROLE, finance.address, admin.address);

      expect(await contract.hasRole(FINANCE_ROLE, finance.address)).to.be.false;

      // 3. Finance should now be blocked from allocating budget
      await expect(
        contract.connect(finance).allocateBudget("ALC-TEST-002", "Health Scheme", "Health Dept", 500000)
      ).to.be.revertedWith("Caller is not authorized to allocate central budget");
    });

    it("prevents non-admin accounts from granting or revoking roles", async function () {
      await expect(
        contract.connect(stranger).grantRole(FINANCE_ROLE, stranger.address)
      ).to.be.revertedWith("Caller is not Super Admin");

      await expect(
        contract.connect(finance).revokeRole(STATE_ROLE, state.address)
      ).to.be.revertedWith("Caller is not Super Admin");
    });

    it("prevents revoking the primary superAdmin account", async function () {
      await expect(
        contract.connect(admin).revokeRole(SUPER_ADMIN_ROLE, admin.address)
      ).to.be.revertedWith("Cannot revoke primary Super Admin");
    });

    it("supports batch role granting", async function () {
      const roles = [FINANCE_ROLE, AUDITOR_ROLE];
      const accounts = [stranger.address, stranger.address];
      await contract.connect(admin).batchGrantRoles(roles, accounts);

      expect(await contract.hasRole(FINANCE_ROLE, stranger.address)).to.be.true;
      expect(await contract.hasRole(AUDITOR_ROLE, stranger.address)).to.be.true;
    });
  });

  describe("2. Central Budget Allocation (Tier 1)", function () {
    it("allows Super Admin or Finance to allocate budget with event emission", async function () {
      await expect(
        contract.connect(finance).allocateBudget("ALC-2026-001", "National Highway Scheme", "MoRTH", 10000000)
      )
        .to.emit(contract, "CentralBudgetAllocated")
        .withArgs("ALC-2026-001", "National Highway Scheme", "MoRTH", 10000000n, (val) => val > 0n);

      const alloc = await contract.budgetAllocations("ALC-2026-001");
      expect(alloc.allocationId).to.equal("ALC-2026-001");
      expect(alloc.schemeName).to.equal("National Highway Scheme");
      expect(alloc.departmentName).to.equal("MoRTH");
      expect(alloc.totalSanctioned).to.equal(10000000n);
      expect(alloc.disbursedToStates).to.equal(0n);
      expect(alloc.exists).to.be.true;
    });

    it("rejects unauthorized callers attempting to allocate budget", async function () {
      await expect(
        contract.connect(stranger).allocateBudget("ALC-HACK", "Hack Scheme", "Hack Dept", 500000)
      ).to.be.revertedWith("Caller is not authorized to allocate central budget");

      await expect(
        contract.connect(contractor).allocateBudget("ALC-CON", "Contractor Scheme", "Civil Dept", 500000)
      ).to.be.revertedWith("Caller is not authorized to allocate central budget");
    });

    it("rejects zero amount or duplicate allocation ID", async function () {
      await expect(
        contract.connect(finance).allocateBudget("ALC-ZERO", "Zero Scheme", "Finance Dept", 0)
      ).to.be.revertedWith("Allocation amount must be greater than zero");

      await contract.connect(finance).allocateBudget("ALC-DUP", "Scheme", "Dept", 100000);
      await expect(
        contract.connect(finance).allocateBudget("ALC-DUP", "Scheme", "Dept", 200000)
      ).to.be.revertedWith("Allocation ID already exists");
    });
  });

  describe("3. Disbursal to State Treasury (Tier 2)", function () {
    beforeEach(async function () {
      await contract.connect(finance).allocateBudget("ALC-CENTRAL-01", "Rural Roads", "MoRD", 5000000);
    });

    it("allows Finance to transfer funds to state and updates central balance", async function () {
      await expect(
        contract.connect(finance).transferToState("TRF-KA-001", "ALC-CENTRAL-01", "Karnataka", 2000000)
      )
        .to.emit(contract, "FundsTransferredToState")
        .withArgs("TRF-KA-001", "ALC-CENTRAL-01", "Karnataka", 2000000n, (val) => val > 0n);

      const st = await contract.stateTransfers("TRF-KA-001");
      expect(st.transferId).to.equal("TRF-KA-001");
      expect(st.allocationId).to.equal("ALC-CENTRAL-01");
      expect(st.stateName).to.equal("Karnataka");
      expect(st.amount).to.equal(2000000n);
      expect(st.allocatedToDistricts).to.equal(0n);
      expect(st.exists).to.be.true;

      const alloc = await contract.budgetAllocations("ALC-CENTRAL-01");
      expect(alloc.disbursedToStates).to.equal(2000000n);
    });

    it("emits FundTransferred when receiverWallet is specified", async function () {
      await expect(
        contract.connect(finance).transferToStateWithReceiver(
          "TRF-KA-002",
          "ALC-CENTRAL-01",
          "Karnataka",
          1000000,
          state.address
        )
      )
        .to.emit(contract, "FundTransferred")
        .withArgs(finance.address, state.address, "Central Finance", "Karnataka", "", 1000000n, (t) => t > 0n);
    });

    it("reverts if transfer exceeds sanctioned budget", async function () {
      await expect(
        contract.connect(finance).transferToState("TRF-OVER", "ALC-CENTRAL-01", "Karnataka", 6000000)
      ).to.be.revertedWith("Transfer exceeds sanctioned budget");
    });

    it("reverts on unauthorized transfer attempt", async function () {
      await expect(
        contract.connect(state).transferToState("TRF-STATE-ROGUE", "ALC-CENTRAL-01", "Karnataka", 100000)
      ).to.be.revertedWith("Caller is not authorized to transfer to state");
    });
  });

  describe("4. District Allocation (Tier 3)", function () {
    beforeEach(async function () {
      await contract.connect(finance).allocateBudget("ALC-CENTRAL-01", "Rural Roads", "MoRD", 5000000);
      await contract.connect(finance).transferToState("TRF-KA-001", "ALC-CENTRAL-01", "Karnataka", 2000000);
    });

    it("allows State Treasury to allocate funds to district", async function () {
      await expect(
        contract.connect(state).allocateToDistrict("DIST-BELAGAVI-001", "TRF-KA-001", "Belagavi", 800000)
      )
        .to.emit(contract, "FundsAllocatedToDistrict")
        .withArgs("DIST-BELAGAVI-001", "TRF-KA-001", "Belagavi", 800000n, (t) => t > 0n);

      const dist = await contract.districtAllocations("DIST-BELAGAVI-001");
      expect(dist.districtName).to.equal("Belagavi");
      expect(dist.amount).to.equal(800000n);
      expect(dist.exists).to.be.true;

      const st = await contract.stateTransfers("TRF-KA-001");
      expect(st.allocatedToDistricts).to.equal(800000n);
    });

    it("reverts if district allocation exceeds available state balance", async function () {
      await expect(
        contract.connect(state).allocateToDistrict("DIST-OVER", "TRF-KA-001", "Belagavi", 2500000)
      ).to.be.revertedWith("Allocation exceeds available state balance");
    });

    it("reverts unauthorized callers attempting district allocation", async function () {
      await expect(
        contract.connect(district).allocateToDistrict("DIST-SELF", "TRF-KA-001", "Belagavi", 50000)
      ).to.be.revertedWith("Caller is not authorized to allocate to district");
    });
  });

  describe("5. Project Escrow & Milestone Lifecycle (Tier 5)", function () {
    const projectId = "PRJ-BELAGAVI-ROAD-01";
    const totalBudget = 500000n;

    it("allows District Officer to create project escrow", async function () {
      await expect(
        contract.connect(district).createProjectEscrow(projectId, "Belagavi Ring Road", contractor.address, totalBudget)
      )
        .to.emit(contract, "ProjectEscrowCreated")
        .withArgs(projectId, "Belagavi Ring Road", contractor.address, totalBudget, (t) => t > 0n);

      const escrow = await contract.projectEscrows(projectId);
      expect(escrow.name).to.equal("Belagavi Ring Road");
      expect(escrow.contractor).to.equal(contractor.address);
      expect(escrow.totalBudget).to.equal(totalBudget);
      expect(escrow.releasedAmount).to.equal(0n);
      expect(escrow.isFrozen).to.be.false;
      expect(escrow.exists).to.be.true;
    });

    it("reverts when unauthorized caller creates project escrow", async function () {
      await expect(
        contract.connect(contractor).createProjectEscrow("PRJ-ROGUE", "Rogue Project", contractor.address, 100000)
      ).to.be.revertedWith("Caller is not authorized to create project escrow");
    });

    it("allows setting milestones and verifies milestone budget boundary", async function () {
      await contract.connect(district).createProjectEscrow(projectId, "Road", contractor.address, totalBudget);

      // Milestones: 200,000 + 300,000 = 500,000
      await contract.connect(district).setMilestones(projectId, [200000, 300000]);

      const m0 = await contract.projectMilestones(projectId, 0);
      expect(m0.amount).to.equal(200000n);
      expect(m0.isReleased).to.be.false;

      // Exceeding total budget should revert
      await expect(
        contract.connect(district).setMilestones(projectId, [300000, 300000])
      ).to.be.revertedWith("Total milestone amounts exceed project budget");
    });

    it("supports end-to-end milestone submission and release", async function () {
      await contract.connect(district).createProjectEscrow(projectId, "Road", contractor.address, totalBudget);
      await contract.connect(district).setMilestones(projectId, [200000, 300000]);

      // Contractor submits progress
      const proofHash = "0x" + "a".repeat(64);
      await expect(
        contract.connect(contractor).submitMilestoneProgress(projectId, 0, proofHash, 100)
      )
        .to.emit(contract, "MilestoneProgressSubmitted")
        .withArgs(projectId, 0n, proofHash, 100n, (t) => t > 0n);

      // District releases milestone payment
      await expect(
        contract.connect(district).releaseMilestonePayment(projectId, 0)
      )
        .to.emit(contract, "MilestonePaymentReleased")
        .withArgs(projectId, 0n, 200000n, contractor.address, (t) => t > 0n);

      const m0 = await contract.projectMilestones(projectId, 0);
      expect(m0.isReleased).to.be.true;

      const escrow = await contract.projectEscrows(projectId);
      expect(escrow.releasedAmount).to.equal(200000n);

      // Duplicate release should revert
      await expect(
        contract.connect(district).releaseMilestonePayment(projectId, 0)
      ).to.be.revertedWith("Milestone already released");
    });

    it("handles project freezing and unfreezing correctly", async function () {
      await contract.connect(district).createProjectEscrow(projectId, "Road", contractor.address, totalBudget);
      await contract.connect(district).setMilestones(projectId, [200000, 300000]);

      // Auditor freezes project
      await expect(
        contract.connect(auditor).freezeProject(projectId, "Material defect detected")
      )
        .to.emit(contract, "ProjectEscrowFrozen")
        .withArgs(projectId, "Material defect detected", (t) => t > 0n);

      expect(await contract.isProjectFrozen(projectId)).to.be.true;

      // When frozen, contractor cannot submit progress
      await expect(
        contract.connect(contractor).submitMilestoneProgress(projectId, 0, "0x123", 50)
      ).to.be.revertedWith("Project escrow is frozen");

      // Super admin unfreezes
      await expect(contract.connect(admin).unfreezeProject(projectId))
        .to.emit(contract, "ProjectEscrowUnfrozen")
        .withArgs(projectId, (t) => t > 0n);

      expect(await contract.isProjectFrozen(projectId)).to.be.false;
    });
  });

  describe("6. General Fund Transfers & Audit Reports (Tiers 4 & 6)", function () {
    it("allows District to transferToContractor and records transfer", async function () {
      await expect(
        contract.connect(district).transferToContractor(
          "TX-CON-001",
          "PRJ-GEN-01",
          contractor.address,
          "Belagavi District",
          "Apex Infra",
          300000
        )
      )
        .to.emit(contract, "FundTransferred")
        .withArgs(district.address, contractor.address, "Belagavi District", "Apex Infra", "PRJ-GEN-01", 300000n, (t) => t > 0n);

      const record = await contract.fundTransferRecords("TX-CON-001");
      expect(record.sender).to.equal(district.address);
      expect(record.receiver).to.equal(contractor.address);
      expect(record.amount).to.equal(300000n);
      expect(record.exists).to.be.true;
    });

    it("allows Auditor to submit forensic audit report", async function () {
      await expect(
        contract.connect(auditor).submitAuditReport(
          "AUD-2026-001",
          "PRJ-BELAGAVI-01",
          "KPMG Forensic Team",
          95,
          "FULLY_COMPLIANT"
        )
      )
        .to.emit(contract, "ForensicAuditReportSubmitted")
        .withArgs("AUD-2026-001", "PRJ-BELAGAVI-01", "KPMG Forensic Team", 95n, "FULLY_COMPLIANT", (t) => t > 0n);

      const rep = await contract.auditReports("AUD-2026-001");
      expect(rep.complianceScore).to.equal(95n);
      expect(rep.verdict).to.equal("FULLY_COMPLIANT");
      expect(rep.exists).to.be.true;
    });

    it("reverts if non-auditor attempts to submit audit report", async function () {
      await expect(
        contract.connect(contractor).submitAuditReport("AUD-FAKE", "PRJ-01", "Contractor Self", 100, "PASS")
      ).to.be.revertedWith("Caller is not authorized Auditor");
    });
  });

  describe("7. Cryptographic Document Hash Anchoring (Tier 7)", function () {
    it("anchors document hash and verifies correctly", async function () {
      const docId = "DOC-INVOICE-001";
      const docHash = "0x" + "b".repeat(64);

      await expect(
        contract.connect(district).anchorDocumentHash(docId, docHash, "INVOICE", "PRJ-BELAGAVI-01")
      )
        .to.emit(contract, "DocumentHashAnchored")
        .withArgs(docId, docHash, "INVOICE", "PRJ-BELAGAVI-01", (t) => t > 0n);

      // Verify matching hash
      const [isMatch, storedHash, timestamp] = await contract.verifyDocumentHash(docId, docHash);
      expect(isMatch).to.be.true;
      expect(storedHash).to.equal(docHash);
      expect(timestamp).to.be.gt(0n);

      // Verify tampered hash
      const tamperedHash = "0x" + "c".repeat(64);
      const [isMatchTampered] = await contract.verifyDocumentHash(docId, tamperedHash);
      expect(isMatchTampered).to.be.false;
    });

    it("returns false for non-existent document ID", async function () {
      const [isMatch] = await contract.verifyDocumentHash("DOC-NONEXISTENT", "0x123");
      expect(isMatch).to.be.false;
    });
  });
});

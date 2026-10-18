const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("GovernmentFundTracking Smart Contract RBAC Security", function () {
  let contract;
  let superAdmin, finance, stateOfficer, districtOfficer, contractor, auditor, unauthorized;

  beforeEach(async function () {
    [superAdmin, finance, stateOfficer, districtOfficer, contractor, auditor, unauthorized] = await ethers.getSigners();

    const GovernmentFundTracking = await ethers.getContractFactory("GovernmentFundTracking");
    contract = await GovernmentFundTracking.deploy();
    await contract.waitForDeployment();

    // Grant respective roles
    const FINANCE_ROLE = await contract.FINANCE_ROLE();
    const STATE_ROLE = await contract.STATE_ROLE();
    const DISTRICT_ROLE = await contract.DISTRICT_ROLE();
    const CONTRACTOR_ROLE = await contract.CONTRACTOR_ROLE();
    const AUDITOR_ROLE = await contract.AUDITOR_ROLE();

    await contract.grantRole(FINANCE_ROLE, finance.address);
    await contract.grantRole(STATE_ROLE, stateOfficer.address);
    await contract.grantRole(DISTRICT_ROLE, districtOfficer.address);
    await contract.grantRole(CONTRACTOR_ROLE, contractor.address);
    await contract.grantRole(AUDITOR_ROLE, auditor.address);
  });

  it("1. SuperAdmin and Finance can allocate central budget", async function () {
    await expect(
      contract.connect(finance).allocateBudget("ALLOC-001", "National Highway", "Roads", 1000000)
    ).to.emit(contract, "CentralBudgetAllocated");

    const alloc = await contract.budgetAllocations("ALLOC-001");
    expect(alloc.exists).to.be.true;
    expect(alloc.totalSanctioned).to.equal(1000000);
  });

  it("2. Unauthorized account CANNOT allocate central budget", async function () {
    await expect(
      contract.connect(unauthorized).allocateBudget("ALLOC-HACK", "Unauthorized Scheme", "Hacked", 5000000)
    ).to.be.revertedWith("AccessControl: caller is not authorized for this role");
  });

  it("3. Only Finance or SuperAdmin can transfer to State Treasury", async function () {
    await contract.connect(finance).allocateBudget("ALLOC-002", "Jal Jeevan", "Water", 2000000);

    // Unauthorized attempt
    await expect(
      contract.connect(unauthorized).transferToState("TRF-001", "ALLOC-002", "Karnataka", 500000)
    ).to.be.revertedWith("AccessControl: caller is not authorized for this role");

    // Authorized finance transfer
    await expect(
      contract.connect(finance).transferToState("TRF-001", "ALLOC-002", "Karnataka", 500000)
    ).to.emit(contract, "FundsTransferredToState");
  });

  it("4. Only State Officer can allocate funds to District", async function () {
    await contract.connect(finance).allocateBudget("ALLOC-003", "PMGSY", "Roads", 2000000);
    await contract.connect(finance).transferToState("TRF-002", "ALLOC-003", "Karnataka", 1000000);

    // Unauthorized attempt
    await expect(
      contract.connect(unauthorized).allocateToDistrict("DIST-001", "TRF-002", "Belagavi", 300000)
    ).to.be.revertedWith("AccessControl: caller is not authorized for this role");

    // Authorized State Officer
    await expect(
      contract.connect(stateOfficer).allocateToDistrict("DIST-001", "TRF-002", "Belagavi", 300000)
    ).to.emit(contract, "FundsAllocatedToDistrict");
  });

  it("5. Only District Officer can create project escrow and set milestones", async function () {
    // Unauthorized attempt to create escrow
    await expect(
      contract.connect(unauthorized).createProjectEscrow("PRJ-001", "Bridge Project", contractor.address, 100000)
    ).to.be.revertedWith("AccessControl: caller is not authorized for this role");

    // Authorized District Officer creates escrow
    await expect(
      contract.connect(districtOfficer).createProjectEscrow("PRJ-001", "Bridge Project", contractor.address, 100000)
    ).to.emit(contract, "ProjectEscrowCreated");

    // Unauthorized attempt to set milestones
    await expect(
      contract.connect(unauthorized).setMilestones("PRJ-001", [50000, 50000])
    ).to.be.revertedWith("AccessControl: caller is not authorized for this role");

    // Authorized District Officer sets milestones
    await contract.connect(districtOfficer).setMilestones("PRJ-001", [50000, 50000]);
  });

  it("6. Only assigned contractor can submit milestone progress", async function () {
    await contract.connect(districtOfficer).createProjectEscrow("PRJ-002", "Rural Road", contractor.address, 200000);
    await contract.connect(districtOfficer).setMilestones("PRJ-002", [100000, 100000]);

    // Unauthorized user attempts to submit progress
    await expect(
      contract.connect(unauthorized).submitMilestoneProgress("PRJ-002", 0, "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890", 50)
    ).to.be.revertedWith("AccessControl: only assigned contractor or authorized contractor role can submit progress");

    // Assigned contractor submits progress
    await expect(
      contract.connect(contractor).submitMilestoneProgress("PRJ-002", 0, "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890", 50)
    ).to.emit(contract, "MilestoneProgressSubmitted");
  });

  it("7. Only District Officer can release milestone payments", async function () {
    await contract.connect(districtOfficer).createProjectEscrow("PRJ-003", "Hospital Ward", contractor.address, 100000);
    await contract.connect(districtOfficer).setMilestones("PRJ-003", [100000]);

    // Unauthorized release attempt
    await expect(
      contract.connect(unauthorized).releaseMilestonePayment("PRJ-003", 0)
    ).to.be.revertedWith("AccessControl: caller is not authorized for this role");

    // Authorized District release
    await expect(
      contract.connect(districtOfficer).releaseMilestonePayment("PRJ-003", 0)
    ).to.emit(contract, "MilestonePaymentReleased");
  });

  it("8. Only Auditor or SuperAdmin can freeze and unfreeze projects", async function () {
    await contract.connect(districtOfficer).createProjectEscrow("PRJ-004", "School Renovation", contractor.address, 50000);

    // Unauthorized freeze attempt
    await expect(
      contract.connect(unauthorized).freezeProject("PRJ-004", "Suspected irregularity")
    ).to.be.revertedWith("AccessControl: caller is not authorized for this role");

    // Authorized Auditor freezes project
    await expect(
      contract.connect(auditor).freezeProject("PRJ-004", "Suspected irregularity")
    ).to.emit(contract, "ProjectEscrowFrozen");

    const isFrozen = await contract.isProjectFrozen("PRJ-004");
    expect(isFrozen).to.be.true;

    // Authorized Auditor unfreezes project
    await expect(
      contract.connect(auditor).unfreezeProject("PRJ-004")
    ).to.emit(contract, "ProjectEscrowUnfrozen");
    expect(await contract.isProjectFrozen("PRJ-004")).to.be.false;
  });

  it("9. Role revocation properly blocks previously authorized caller", async function () {
    const FINANCE_ROLE = await contract.FINANCE_ROLE();
    await contract.revokeRole(FINANCE_ROLE, finance.address);

    await expect(
      contract.connect(finance).allocateBudget("ALLOC-004", "Blocked Scheme", "Roads", 100000)
    ).to.be.revertedWith("AccessControl: caller is not authorized for this role");
  });
});

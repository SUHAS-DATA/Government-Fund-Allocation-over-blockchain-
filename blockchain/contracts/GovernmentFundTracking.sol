// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title GovernmentFundTracking
 * @dev Multi-tier Government Fund Allocation, Smart Contract Escrow, Milestone Disbursals,
 * Off-chain Document Hash Anchoring, and Forensic Audit/Fund Freeze Registry.
 */
contract GovernmentFundTracking {
    address public superAdmin;

    // --- Structures ---
    struct BudgetAllocation {
        string allocationId;
        string schemeName;
        string departmentName;
        uint256 totalSanctioned;
        uint256 disbursedToStates;
        uint256 timestamp;
        bool exists;
    }

    struct StateTransfer {
        string transferId;
        string allocationId;
        string stateName;
        uint256 amount;
        uint256 allocatedToDistricts;
        uint256 timestamp;
        bool exists;
    }

    struct DistrictAllocation {
        string distAllocId;
        string transferId;
        string districtName;
        uint256 amount;
        uint256 disbursedToProjects;
        uint256 timestamp;
        bool exists;
    }

    struct Milestone {
        uint256 milestoneIndex;
        uint256 amount;
        string progressProofHash;
        uint256 progressPercentage;
        bool isReleased;
        uint256 releaseTimestamp;
    }

    struct ProjectEscrow {
        string projectId;
        string name;
        address contractor;
        uint256 totalBudget;
        uint256 releasedAmount;
        uint256 milestoneCount;
        bool isFrozen;
        string freezeReason;
        uint256 createdTimestamp;
        bool exists;
    }

    struct DocumentHashRecord {
        string documentId;
        string documentHash; // SHA-256 (64 hex characters)
        string docType;
        string entityId;
        address anchoredBy;
        uint256 timestamp;
        bool exists;
    }

    struct AuditReportRecord {
        string auditId;
        string projectId;
        string auditorName;
        uint256 complianceScore; // 0 - 100
        string verdict;          // APPROVED, CONDITIONAL_APPROVAL, REJECTED
        uint256 timestamp;
        bool exists;
    }

    // --- State Storage ---
    mapping(string => BudgetAllocation) public budgetAllocations;
    mapping(string => StateTransfer) public stateTransfers;
    mapping(string => DistrictAllocation) public districtAllocations;
    mapping(string => ProjectEscrow) public projectEscrows;
    mapping(string => mapping(uint256 => Milestone)) public projectMilestones;
    mapping(string => DocumentHashRecord) public documentHashRecords;
    mapping(string => AuditReportRecord) public auditReports;

    // --- Events ---
    event CentralBudgetAllocated(string indexed allocationId, string schemeName, string departmentName, uint256 amount, uint256 timestamp);
    event FundsTransferredToState(string indexed transferId, string indexed allocationId, string stateName, uint256 amount, uint256 timestamp);
    event FundsAllocatedToDistrict(string indexed distAllocId, string indexed transferId, string districtName, uint256 amount, uint256 timestamp);
    event ProjectEscrowCreated(string indexed projectId, string name, address indexed contractor, uint256 totalBudget, uint256 timestamp);
    event MilestoneProgressSubmitted(string indexed projectId, uint256 indexed milestoneIndex, string progressProofHash, uint256 progressPercentage, uint256 timestamp);
    event MilestonePaymentReleased(string indexed projectId, uint256 indexed milestoneIndex, uint256 amount, address indexed contractor, uint256 timestamp);
    event DocumentHashAnchored(string indexed documentId, string documentHash, string docType, string indexed entityId, uint256 timestamp);
    event ProjectEscrowFrozen(string indexed projectId, string reason, uint256 timestamp);
    event ProjectEscrowUnfrozen(string indexed projectId, uint256 timestamp);
    event ForensicAuditReportSubmitted(string indexed auditId, string indexed projectId, string auditorName, uint256 complianceScore, string verdict, uint256 timestamp);

    constructor() {
        superAdmin = msg.sender;
    }

    // --- 1. Central Budget Allocation ---
    function allocateBudget(
        string calldata allocId,
        string calldata scheme,
        string calldata dept,
        uint256 amount
    ) external {
        require(!budgetAllocations[allocId].exists, "Allocation ID already registered on blockchain");
        require(amount > 0, "Allocation amount must be greater than zero");

        budgetAllocations[allocId] = BudgetAllocation({
            allocationId: allocId,
            schemeName: scheme,
            departmentName: dept,
            totalSanctioned: amount,
            disbursedToStates: 0,
            timestamp: block.timestamp,
            exists: true
        });

        emit CentralBudgetAllocated(allocId, scheme, dept, amount, block.timestamp);
    }

    // --- 2. Finance: Transfer to State Treasury ---
    function transferToState(
        string calldata trfId,
        string calldata allocId,
        string calldata state,
        uint256 amount
    ) external {
        require(budgetAllocations[allocId].exists, "Central allocation does not exist");
        require(!stateTransfers[trfId].exists, "Transfer ID already registered on blockchain");
        require(
            budgetAllocations[allocId].disbursedToStates + amount <= budgetAllocations[allocId].totalSanctioned,
            "State transfer exceeds sanctioned allocation ceiling"
        );

        budgetAllocations[allocId].disbursedToStates += amount;

        stateTransfers[trfId] = StateTransfer({
            transferId: trfId,
            allocationId: allocId,
            stateName: state,
            amount: amount,
            allocatedToDistricts: 0,
            timestamp: block.timestamp,
            exists: true
        });

        emit FundsTransferredToState(trfId, allocId, state, amount, block.timestamp);
    }

    // --- 3. State: Allocate to District ---
    function allocateToDistrict(
        string calldata distAllocId,
        string calldata trfId,
        string calldata district,
        uint256 amount
    ) external {
        require(stateTransfers[trfId].exists, "State transfer record does not exist");
        require(!districtAllocations[distAllocId].exists, "District allocation ID already registered");
        require(
            stateTransfers[trfId].allocatedToDistricts + amount <= stateTransfers[trfId].amount,
            "District allocation exceeds state treasury transfer balance"
        );

        stateTransfers[trfId].allocatedToDistricts += amount;

        districtAllocations[distAllocId] = DistrictAllocation({
            distAllocId: distAllocId,
            transferId: trfId,
            districtName: district,
            amount: amount,
            disbursedToProjects: 0,
            timestamp: block.timestamp,
            exists: true
        });

        emit FundsAllocatedToDistrict(distAllocId, trfId, district, amount, block.timestamp);
    }

    // --- 4. District: Create Project Smart Contract Escrow ---
    function createProjectEscrow(
        string calldata projectId,
        string calldata name,
        address contractor,
        uint256 totalBudget
    ) external {
        require(!projectEscrows[projectId].exists, "Project Escrow already exists");
        require(totalBudget > 0, "Project budget must be greater than zero");

        projectEscrows[projectId] = ProjectEscrow({
            projectId: projectId,
            name: name,
            contractor: contractor,
            totalBudget: totalBudget,
            releasedAmount: 0,
            milestoneCount: 0,
            isFrozen: false,
            freezeReason: "",
            createdTimestamp: block.timestamp,
            exists: true
        });

        emit ProjectEscrowCreated(projectId, name, contractor, totalBudget, block.timestamp);
    }

    // --- 5. Milestones & Contractor Progress ---
    function setMilestones(
        string calldata projectId,
        uint256[] calldata milestoneAmounts
    ) external {
        require(projectEscrows[projectId].exists, "Project Escrow does not exist");
        require(!projectEscrows[projectId].isFrozen, "Project is frozen by CAG forensic audit");

        uint256 totalSum = 0;
        for (uint256 i = 0; i < milestoneAmounts.length; i++) {
            totalSum += milestoneAmounts[i];
            projectMilestones[projectId][i] = Milestone({
                milestoneIndex: i,
                amount: milestoneAmounts[i],
                progressProofHash: "",
                progressPercentage: 0,
                isReleased: false,
                releaseTimestamp: 0
            });
        }

        require(totalSum <= projectEscrows[projectId].totalBudget, "Total milestones exceed project budget");
        projectEscrows[projectId].milestoneCount = milestoneAmounts.length;
    }

    function submitMilestoneProgress(
        string calldata projectId,
        uint256 milestoneIndex,
        string calldata progressProofHash,
        uint256 progressPercentage
    ) external {
        require(projectEscrows[projectId].exists, "Project Escrow does not exist");
        require(!projectEscrows[projectId].isFrozen, "Project is frozen by audit hold");
        require(milestoneIndex < projectEscrows[projectId].milestoneCount, "Invalid milestone index");

        Milestone storage m = projectMilestones[projectId][milestoneIndex];
        m.progressProofHash = progressProofHash;
        m.progressPercentage = progressPercentage;

        emit MilestoneProgressSubmitted(projectId, milestoneIndex, progressProofHash, progressPercentage, block.timestamp);
    }

    function releaseMilestonePayment(
        string calldata projectId,
        uint256 milestoneIndex
    ) external {
        require(projectEscrows[projectId].exists, "Project Escrow does not exist");
        require(!projectEscrows[projectId].isFrozen, "Project funds are frozen by forensic auditor");
        require(milestoneIndex < projectEscrows[projectId].milestoneCount, "Invalid milestone index");

        Milestone storage m = projectMilestones[projectId][milestoneIndex];
        require(!m.isReleased, "Milestone payment already released on blockchain");
        require(
            projectEscrows[projectId].releasedAmount + m.amount <= projectEscrows[projectId].totalBudget,
            "Total release exceeds escrow budget ceiling"
        );

        m.isReleased = true;
        m.releaseTimestamp = block.timestamp;
        projectEscrows[projectId].releasedAmount += m.amount;

        emit MilestonePaymentReleased(
            projectId,
            milestoneIndex,
            m.amount,
            projectEscrows[projectId].contractor,
            block.timestamp
        );
    }

    // --- 6. Document Hash Anchoring & Real-time Verification ---
    function anchorDocumentHash(
        string calldata docId,
        string calldata docHash,
        string calldata docType,
        string calldata entityId
    ) external {
        require(!documentHashRecords[docId].exists, "Document ID already anchored on-chain");
        require(bytes(docHash).length == 64, "Invalid SHA-256 hash length");

        documentHashRecords[docId] = DocumentHashRecord({
            documentId: docId,
            documentHash: docHash,
            docType: docType,
            entityId: entityId,
            anchoredBy: msg.sender,
            timestamp: block.timestamp,
            exists: true
        });

        emit DocumentHashAnchored(docId, docHash, docType, entityId, block.timestamp);
    }

    function verifyDocumentHash(
        string calldata docId,
        string calldata computedHash
    ) external view returns (bool isMatch, string memory storedHash, uint256 timestamp) {
        if (!documentHashRecords[docId].exists) {
            return (false, "", 0);
        }
        DocumentHashRecord memory rec = documentHashRecords[docId];
        bool matchResult = (keccak256(bytes(rec.documentHash)) == keccak256(bytes(computedHash)));
        return (matchResult, rec.documentHash, rec.timestamp);
    }

    // --- 7. Emergency Fund Freeze / Unfreeze ---
    function freezeProject(
        string calldata projectId,
        string calldata reason
    ) external {
        require(projectEscrows[projectId].exists, "Project Escrow does not exist");
        projectEscrows[projectId].isFrozen = true;
        projectEscrows[projectId].freezeReason = reason;

        emit ProjectEscrowFrozen(projectId, reason, block.timestamp);
    }

    function unfreezeProject(
        string calldata projectId
    ) external {
        require(projectEscrows[projectId].exists, "Project Escrow does not exist");
        projectEscrows[projectId].isFrozen = false;
        projectEscrows[projectId].freezeReason = "";

        emit ProjectEscrowUnfrozen(projectId, block.timestamp);
    }

    // --- 8. Forensic CAG Audit Report Submission ---
    function submitAuditReport(
        string calldata auditId,
        string calldata projectId,
        string calldata auditorName,
        uint256 complianceScore,
        string calldata verdict
    ) external {
        require(!auditReports[auditId].exists, "Audit Report ID already exists on blockchain");
        require(complianceScore <= 100, "Compliance score cannot exceed 100");

        auditReports[auditId] = AuditReportRecord({
            auditId: auditId,
            projectId: projectId,
            auditorName: auditorName,
            complianceScore: complianceScore,
            verdict: verdict,
            timestamp: block.timestamp,
            exists: true
        });

        emit ForensicAuditReportSubmitted(auditId, projectId, auditorName, complianceScore, verdict, block.timestamp);
    }

    // --- View Helpers ---
    function getProjectEscrow(string calldata projectId) external view returns (
        string memory name,
        address contractor,
        uint256 totalBudget,
        uint256 releasedAmount,
        uint256 milestoneCount,
        bool isFrozen,
        string memory freezeReason
    ) {
        require(projectEscrows[projectId].exists, "Project does not exist");
        ProjectEscrow memory p = projectEscrows[projectId];
        return (p.name, p.contractor, p.totalBudget, p.releasedAmount, p.milestoneCount, p.isFrozen, p.freezeReason);
    }

    function isProjectFrozen(string calldata projectId) external view returns (bool) {
        return projectEscrows[projectId].isFrozen;
    }
}

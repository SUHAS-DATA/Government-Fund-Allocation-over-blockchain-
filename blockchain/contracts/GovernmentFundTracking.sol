// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title GovernmentFundTracking
 * @dev Multi-tier Government Fund Allocation, Smart Contract Escrow, Milestone Disbursals,
 * Off-chain Document Hash Anchoring, and Forensic Audit/Fund Freeze Registry with
 * Role-Based Access Control (RBAC).
 */
contract GovernmentFundTracking {
    address public superAdmin;

    // --- Role Identifiers ---
    bytes32 public constant SUPER_ADMIN_ROLE = keccak256("SUPER_ADMIN_ROLE");
    bytes32 public constant FINANCE_ROLE     = keccak256("FINANCE_ROLE");
    bytes32 public constant STATE_ROLE       = keccak256("STATE_ROLE");
    bytes32 public constant DISTRICT_ROLE    = keccak256("DISTRICT_ROLE");
    bytes32 public constant CONTRACTOR_ROLE  = keccak256("CONTRACTOR_ROLE");
    bytes32 public constant AUDITOR_ROLE     = keccak256("AUDITOR_ROLE");

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

    struct FundTransferRecord {
        address sender;
        address receiver;
        string senderDepartment;
        string receiverDepartment;
        string projectId;
        uint256 amount;
        uint256 timestamp;
        bool exists;
    }

    // --- State Storage ---
    mapping(bytes32 => mapping(address => bool)) public hasRole;
    mapping(string => BudgetAllocation) public budgetAllocations;
    mapping(string => StateTransfer) public stateTransfers;
    mapping(string => DistrictAllocation) public districtAllocations;
    mapping(string => ProjectEscrow) public projectEscrows;
    mapping(string => mapping(uint256 => Milestone)) public projectMilestones;
    mapping(string => DocumentHashRecord) public documentHashRecords;
    mapping(string => AuditReportRecord) public auditReports;
    mapping(string => FundTransferRecord) public fundTransferRecords;

    // --- Events ---
    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);
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

    // Multi-tier Administrative Fund Transfer Event
    event FundTransferred(
        address indexed sender,
        address indexed receiver,
        string senderDepartment,
        string receiverDepartment,
        string projectId,
        uint256 amount,
        uint256 timestamp
    );

    // --- Modifiers ---
    modifier onlyRole(bytes32 role) {
        require(
            msg.sender == superAdmin ||
            hasRole[role][msg.sender] ||
            hasRole[SUPER_ADMIN_ROLE][msg.sender],
            "AccessControl: caller is not authorized for this role"
        );
        _;
    }

    modifier onlySuperAdmin() {
        require(
            msg.sender == superAdmin || hasRole[SUPER_ADMIN_ROLE][msg.sender],
            "AccessControl: caller is not superAdmin"
        );
        _;
    }

    constructor() {
        superAdmin = msg.sender;
        hasRole[SUPER_ADMIN_ROLE][msg.sender] = true;
        hasRole[FINANCE_ROLE][msg.sender]     = true;
        hasRole[STATE_ROLE][msg.sender]       = true;
        hasRole[DISTRICT_ROLE][msg.sender]    = true;
        hasRole[CONTRACTOR_ROLE][msg.sender]  = true;
        hasRole[AUDITOR_ROLE][msg.sender]     = true;
        emit RoleGranted(SUPER_ADMIN_ROLE, msg.sender, msg.sender);
    }

    // --- Role Management ---
    function grantRole(bytes32 role, address account) external onlySuperAdmin {
        require(account != address(0), "Zero address");
        hasRole[role][account] = true;
        emit RoleGranted(role, account, msg.sender);
    }

    function revokeRole(bytes32 role, address account) external onlySuperAdmin {
        require(account != superAdmin, "Cannot revoke superAdmin");
        hasRole[role][account] = false;
        emit RoleRevoked(role, account, msg.sender);
    }

    function batchGrantRoles(bytes32[] calldata roles, address[] calldata accounts) external onlySuperAdmin {
        require(roles.length == accounts.length, "Mismatched arrays");
        for (uint256 i = 0; i < roles.length; i++) {
            require(accounts[i] != address(0), "Zero address");
            hasRole[roles[i]][accounts[i]] = true;
            emit RoleGranted(roles[i], accounts[i], msg.sender);
        }
    }

    function initializeDefaultRoles(
        address finance,
        address state,
        address district,
        address contractor,
        address auditor
    ) external onlySuperAdmin {
        if (finance != address(0)) {
            hasRole[FINANCE_ROLE][finance] = true;
            emit RoleGranted(FINANCE_ROLE, finance, msg.sender);
        }
        if (state != address(0)) {
            hasRole[STATE_ROLE][state] = true;
            emit RoleGranted(STATE_ROLE, state, msg.sender);
        }
        if (district != address(0)) {
            hasRole[DISTRICT_ROLE][district] = true;
            emit RoleGranted(DISTRICT_ROLE, district, msg.sender);
        }
        if (contractor != address(0)) {
            hasRole[CONTRACTOR_ROLE][contractor] = true;
            emit RoleGranted(CONTRACTOR_ROLE, contractor, msg.sender);
        }
        if (auditor != address(0)) {
            hasRole[AUDITOR_ROLE][auditor] = true;
            emit RoleGranted(AUDITOR_ROLE, auditor, msg.sender);
        }
    }

    // --- 1. Central Budget Allocation ---
    function allocateBudget(
        string calldata allocId,
        string calldata scheme,
        string calldata dept,
        uint256 amount
    ) external onlyRole(FINANCE_ROLE) {
        require(!budgetAllocations[allocId].exists, "Allocation exists");
        require(amount > 0, "Amount must be > 0");

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
    ) external onlyRole(FINANCE_ROLE) {
        _executeTransferToState(trfId, allocId, state, amount, address(0));
    }

    function transferToStateWithReceiver(
        string calldata trfId,
        string calldata allocId,
        string calldata state,
        uint256 amount,
        address receiverWallet
    ) external onlyRole(FINANCE_ROLE) {
        _executeTransferToState(trfId, allocId, state, amount, receiverWallet);
    }

    function _executeTransferToState(
        string calldata trfId,
        string calldata allocId,
        string calldata state,
        uint256 amount,
        address receiverWallet
    ) internal {
        require(budgetAllocations[allocId].exists, "Allocation not found");
        require(!stateTransfers[trfId].exists, "Transfer exists");
        require(
            budgetAllocations[allocId].disbursedToStates + amount <= budgetAllocations[allocId].totalSanctioned,
            "Exceeds allocation"
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

        fundTransferRecords[trfId] = FundTransferRecord({
            sender: msg.sender,
            receiver: receiverWallet,
            senderDepartment: "Finance Department",
            receiverDepartment: state,
            projectId: allocId,
            amount: amount,
            timestamp: block.timestamp,
            exists: true
        });

        emit FundsTransferredToState(trfId, allocId, state, amount, block.timestamp);
        emit FundTransferred(msg.sender, receiverWallet, "Finance Department", state, allocId, amount, block.timestamp);
    }

    // --- 3. State: Allocate to District ---
    function allocateToDistrict(
        string calldata distAllocId,
        string calldata trfId,
        string calldata district,
        uint256 amount
    ) external onlyRole(STATE_ROLE) {
        _executeAllocateToDistrict(distAllocId, trfId, district, amount, address(0));
    }

    function allocateToDistrictWithReceiver(
        string calldata distAllocId,
        string calldata trfId,
        string calldata district,
        uint256 amount,
        address receiverWallet
    ) external onlyRole(STATE_ROLE) {
        _executeAllocateToDistrict(distAllocId, trfId, district, amount, receiverWallet);
    }

    function _executeAllocateToDistrict(
        string calldata distAllocId,
        string calldata trfId,
        string calldata district,
        uint256 amount,
        address receiverWallet
    ) internal {
        require(stateTransfers[trfId].exists, "Transfer not found");
        require(!districtAllocations[distAllocId].exists, "District alloc exists");
        require(
            stateTransfers[trfId].allocatedToDistricts + amount <= stateTransfers[trfId].amount,
            "Exceeds transfer balance"
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

        fundTransferRecords[distAllocId] = FundTransferRecord({
            sender: msg.sender,
            receiver: receiverWallet,
            senderDepartment: "State Treasury",
            receiverDepartment: district,
            projectId: distAllocId,
            amount: amount,
            timestamp: block.timestamp,
            exists: true
        });

        emit FundsAllocatedToDistrict(distAllocId, trfId, district, amount, block.timestamp);
        emit FundTransferred(msg.sender, receiverWallet, "State Treasury", district, distAllocId, amount, block.timestamp);
    }

    // --- 4. District: Create Project Smart Contract Escrow ---
    function createProjectEscrow(
        string calldata projectId,
        string calldata name,
        address contractor,
        uint256 totalBudget
    ) external onlyRole(DISTRICT_ROLE) {
        require(!projectEscrows[projectId].exists, "Escrow exists");
        require(totalBudget > 0, "Budget must be > 0");

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
    ) external onlyRole(DISTRICT_ROLE) {
        require(projectEscrows[projectId].exists, "Escrow not found");
        require(!projectEscrows[projectId].isFrozen, "Project frozen");

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

        require(totalSum <= projectEscrows[projectId].totalBudget, "Exceeds project budget");
        projectEscrows[projectId].milestoneCount = milestoneAmounts.length;
    }

    function submitMilestoneProgress(
        string calldata projectId,
        uint256 milestoneIndex,
        string calldata progressProofHash,
        uint256 progressPercentage
    ) external {
        require(projectEscrows[projectId].exists, "Escrow not found");
        require(
            msg.sender == projectEscrows[projectId].contractor ||
            hasRole[CONTRACTOR_ROLE][msg.sender] ||
            hasRole[SUPER_ADMIN_ROLE][msg.sender] ||
            msg.sender == superAdmin,
            "AccessControl: only assigned contractor or authorized contractor role can submit progress"
        );
        require(!projectEscrows[projectId].isFrozen, "Project frozen");
        require(milestoneIndex < projectEscrows[projectId].milestoneCount, "Invalid milestone");

        Milestone storage m = projectMilestones[projectId][milestoneIndex];
        m.progressProofHash = progressProofHash;
        m.progressPercentage = progressPercentage;

        emit MilestoneProgressSubmitted(projectId, milestoneIndex, progressProofHash, progressPercentage, block.timestamp);
    }

    function releaseMilestonePayment(
        string calldata projectId,
        uint256 milestoneIndex
    ) external onlyRole(DISTRICT_ROLE) {
        require(projectEscrows[projectId].exists, "Escrow not found");
        require(!projectEscrows[projectId].isFrozen, "Project frozen");
        require(milestoneIndex < projectEscrows[projectId].milestoneCount, "Invalid milestone");

        Milestone storage m = projectMilestones[projectId][milestoneIndex];
        require(!m.isReleased, "Payment already released");
        require(
            projectEscrows[projectId].releasedAmount + m.amount <= projectEscrows[projectId].totalBudget,
            "Exceeds escrow budget"
        );

        m.isReleased = true;
        m.releaseTimestamp = block.timestamp;
        projectEscrows[projectId].releasedAmount += m.amount;

        string memory phaseKey = string(abi.encodePacked(projectId, "_PHASE_", _uint2str(milestoneIndex + 1)));
        fundTransferRecords[phaseKey] = FundTransferRecord({
            sender: msg.sender,
            receiver: projectEscrows[projectId].contractor,
            senderDepartment: "District Implementing Agency",
            receiverDepartment: "Contractor Escrow Account",
            projectId: projectId,
            amount: m.amount,
            timestamp: block.timestamp,
            exists: true
        });

        emit MilestonePaymentReleased(
            projectId,
            milestoneIndex,
            m.amount,
            projectEscrows[projectId].contractor,
            block.timestamp
        );

        emit FundTransferred(
            msg.sender,
            projectEscrows[projectId].contractor,
            "District Implementing Agency",
            "Contractor Escrow Account",
            projectId,
            m.amount,
            block.timestamp
        );
    }

    // Direct Multi-Tier Transfer Logger
    function recordFundTransfer(
        string calldata transferKey,
        address receiver,
        string calldata senderDept,
        string calldata receiverDept,
        string calldata projectId,
        uint256 amount
    ) external {
        require(
            hasRole[DISTRICT_ROLE][msg.sender] ||
            hasRole[STATE_ROLE][msg.sender] ||
            hasRole[FINANCE_ROLE][msg.sender] ||
            hasRole[SUPER_ADMIN_ROLE][msg.sender] ||
            msg.sender == superAdmin,
            "AccessControl: caller is not authorized to log fund transfers"
        );

        fundTransferRecords[transferKey] = FundTransferRecord({
            sender: msg.sender,
            receiver: receiver,
            senderDepartment: senderDept,
            receiverDepartment: receiverDept,
            projectId: projectId,
            amount: amount,
            timestamp: block.timestamp,
            exists: true
        });

        emit FundTransferred(msg.sender, receiver, senderDept, receiverDept, projectId, amount, block.timestamp);
    }

    // --- District to Contractor Direct Transfer ---
    function transferToContractor(
        string calldata transferId,
        string calldata projectId,
        address contractorWallet,
        string calldata districtName,
        string calldata contractorName,
        uint256 amount
    ) external onlyRole(DISTRICT_ROLE) {
        require(contractorWallet != address(0), "Invalid contractor wallet");
        require(amount > 0, "Amount must be > 0");

        fundTransferRecords[transferId] = FundTransferRecord({
            sender: msg.sender,
            receiver: contractorWallet,
            senderDepartment: districtName,
            receiverDepartment: contractorName,
            projectId: projectId,
            amount: amount,
            timestamp: block.timestamp,
            exists: true
        });

        emit FundTransferred(msg.sender, contractorWallet, districtName, contractorName, projectId, amount, block.timestamp);
    }

    function _uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) return "0";
        uint256 j = _i;
        uint256 len;
        while (j != 0) { len++; j /= 10; }
        bytes memory b = new bytes(len);
        while (_i != 0) { b[--len] = bytes1(uint8(48 + (_i % 10))); _i /= 10; }
        return string(b);
    }

    // --- 6. Document Hash Anchoring & Real-time Verification ---
    function anchorDocumentHash(
        string calldata docId,
        string calldata docHash,
        string calldata docType,
        string calldata entityId
    ) external {
        require(
            hasRole[DISTRICT_ROLE][msg.sender] ||
            hasRole[STATE_ROLE][msg.sender] ||
            hasRole[FINANCE_ROLE][msg.sender] ||
            hasRole[CONTRACTOR_ROLE][msg.sender] ||
            hasRole[AUDITOR_ROLE][msg.sender] ||
            hasRole[SUPER_ADMIN_ROLE][msg.sender] ||
            msg.sender == superAdmin,
            "AccessControl: caller is not authorized to anchor documents"
        );
        require(!documentHashRecords[docId].exists, "Doc ID exists");
        require(bytes(docHash).length == 64, "Invalid hash length");

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
    ) external onlyRole(AUDITOR_ROLE) {
        require(projectEscrows[projectId].exists, "Escrow not found");
        projectEscrows[projectId].isFrozen = true;
        projectEscrows[projectId].freezeReason = reason;

        emit ProjectEscrowFrozen(projectId, reason, block.timestamp);
    }

    function unfreezeProject(
        string calldata projectId
    ) external onlyRole(AUDITOR_ROLE) {
        require(projectEscrows[projectId].exists, "Escrow not found");
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
    ) external onlyRole(AUDITOR_ROLE) {
        require(!auditReports[auditId].exists, "Audit ID exists");
        require(complianceScore <= 100, "Score > 100");

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
        require(projectEscrows[projectId].exists, "Escrow not found");
        ProjectEscrow memory p = projectEscrows[projectId];
        return (p.name, p.contractor, p.totalBudget, p.releasedAmount, p.milestoneCount, p.isFrozen, p.freezeReason);
    }

    function isProjectFrozen(string calldata projectId) external view returns (bool) {
        return projectEscrows[projectId].isFrozen;
    }
}

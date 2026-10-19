// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title GovernmentFundTracking
 * @dev Autonomous decentralized governance, multi-tier budget allocation,
 *      milestone-based project escrow, and cryptographic audit registry for Ethereum Sepolia.
 */
contract GovernmentFundTracking {

    // --- Role Constants ---
    bytes32 public constant SUPER_ADMIN_ROLE = keccak256("SUPER_ADMIN_ROLE");
    bytes32 public constant FINANCE_ROLE     = keccak256("FINANCE_ROLE");
    bytes32 public constant STATE_ROLE       = keccak256("STATE_ROLE");
    bytes32 public constant DISTRICT_ROLE    = keccak256("DISTRICT_ROLE");
    bytes32 public constant CONTRACTOR_ROLE  = keccak256("CONTRACTOR_ROLE");
    bytes32 public constant AUDITOR_ROLE     = keccak256("AUDITOR_ROLE");

    address public superAdmin;
    mapping(bytes32 => mapping(address => bool)) private _roles;

    // --- Data Structures ---

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

    struct Milestone {
        uint256 milestoneIndex;
        uint256 amount;
        string progressProofHash;
        uint256 progressPercentage;
        bool isReleased;
        uint256 releaseTimestamp;
    }

    struct DocumentHashRecord {
        string documentId;
        string documentHash;
        string docType;
        string entityId;
        address anchoredBy;
        uint256 timestamp;
        bool exists;
    }

    struct ForensicAuditReport {
        string auditId;
        string projectId;
        string auditorName;
        uint256 complianceScore;
        string verdict;
        uint256 timestamp;
        bool exists;
    }

    // --- State Storage ---

    mapping(string => BudgetAllocation) public budgetAllocations;
    mapping(string => StateTransfer) public stateTransfers;
    mapping(string => DistrictAllocation) public districtAllocations;
    mapping(string => FundTransferRecord) public fundTransferRecords;
    mapping(string => ProjectEscrow) public projectEscrows;
    mapping(string => mapping(uint256 => Milestone)) public projectMilestones;
    mapping(string => DocumentHashRecord) public documentHashRecords;
    mapping(string => ForensicAuditReport) public auditReports;

    // --- Events ---

    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);

    event CentralBudgetAllocated(
        string indexed allocationId,
        string schemeName,
        string departmentName,
        uint256 amount,
        uint256 timestamp
    );

    event FundsTransferredToState(
        string indexed transferId,
        string indexed allocationId,
        string stateName,
        uint256 amount,
        uint256 timestamp
    );

    event FundsAllocatedToDistrict(
        string indexed distAllocId,
        string indexed transferId,
        string districtName,
        uint256 amount,
        uint256 timestamp
    );

    event FundTransferred(
        address indexed sender,
        address indexed receiver,
        string senderDepartment,
        string receiverDepartment,
        string projectId,
        uint256 amount,
        uint256 timestamp
    );

    event ProjectEscrowCreated(
        string indexed projectId,
        string name,
        address indexed contractor,
        uint256 totalBudget,
        uint256 timestamp
    );

    event MilestoneProgressSubmitted(
        string indexed projectId,
        uint256 indexed milestoneIndex,
        string progressProofHash,
        uint256 progressPercentage,
        uint256 timestamp
    );

    event MilestonePaymentReleased(
        string indexed projectId,
        uint256 indexed milestoneIndex,
        uint256 amount,
        address indexed contractor,
        uint256 timestamp
    );

    event ProjectEscrowFrozen(string indexed projectId, string reason, uint256 timestamp);
    event ProjectEscrowUnfrozen(string indexed projectId, uint256 timestamp);

    event ForensicAuditReportSubmitted(
        string indexed auditId,
        string indexed projectId,
        string auditorName,
        uint256 complianceScore,
        string verdict,
        uint256 timestamp
    );

    event DocumentHashAnchored(
        string indexed documentId,
        string documentHash,
        string docType,
        string indexed entityId,
        uint256 timestamp
    );

    // --- Modifiers ---

    modifier onlySuperAdmin() {
        require(msg.sender == superAdmin || hasRole(SUPER_ADMIN_ROLE, msg.sender), "Caller is not Super Admin");
        _;
    }

    modifier onlyRole(bytes32 role) {
        require(hasRole(role, msg.sender), "Caller does not have required role");
        _;
    }

    // --- Constructor ---

    constructor() {
        superAdmin = msg.sender;
        _roles[SUPER_ADMIN_ROLE][msg.sender] = true;
        emit RoleGranted(SUPER_ADMIN_ROLE, msg.sender, msg.sender);
    }

    // --- Access Control Functions ---

    function hasRole(bytes32 role, address account) public view returns (bool) {
        if (account == address(0)) return false;
        if (role == SUPER_ADMIN_ROLE && account == superAdmin) return true;
        return _roles[role][account];
    }

    function grantRole(bytes32 role, address account) public onlySuperAdmin {
        require(account != address(0), "Cannot grant role to zero address");
        _roles[role][account] = true;
        emit RoleGranted(role, account, msg.sender);
    }

    function revokeRole(bytes32 role, address account) public onlySuperAdmin {
        require(account != address(0), "Cannot revoke role from zero address");
        require(!(role == SUPER_ADMIN_ROLE && account == superAdmin), "Cannot revoke primary Super Admin");
        _roles[role][account] = false;
        emit RoleRevoked(role, account, msg.sender);
    }

    function batchGrantRoles(bytes32[] calldata roles, address[] calldata accounts) external onlySuperAdmin {
        require(roles.length == accounts.length, "Mismatched roles and accounts length");
        for (uint256 i = 0; i < roles.length; i++) {
            require(accounts[i] != address(0), "Cannot grant role to zero address");
            _roles[roles[i]][accounts[i]] = true;
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
            _roles[FINANCE_ROLE][finance] = true;
            emit RoleGranted(FINANCE_ROLE, finance, msg.sender);
        }
        if (state != address(0)) {
            _roles[STATE_ROLE][state] = true;
            emit RoleGranted(STATE_ROLE, state, msg.sender);
        }
        if (district != address(0)) {
            _roles[DISTRICT_ROLE][district] = true;
            emit RoleGranted(DISTRICT_ROLE, district, msg.sender);
        }
        if (contractor != address(0)) {
            _roles[CONTRACTOR_ROLE][contractor] = true;
            emit RoleGranted(CONTRACTOR_ROLE, contractor, msg.sender);
        }
        if (auditor != address(0)) {
            _roles[AUDITOR_ROLE][auditor] = true;
            emit RoleGranted(AUDITOR_ROLE, auditor, msg.sender);
        }
    }

    // --- Tier 1: Central Budget Allocation ---

    function allocateBudget(
        string calldata allocId,
        string calldata scheme,
        string calldata dept,
        uint256 amount
    ) external {
        require(
            hasRole(SUPER_ADMIN_ROLE, msg.sender) || hasRole(FINANCE_ROLE, msg.sender),
            "Caller is not authorized to allocate central budget"
        );
        require(bytes(allocId).length > 0, "Allocation ID cannot be empty");
        require(bytes(scheme).length > 0, "Scheme name cannot be empty");
        require(bytes(dept).length > 0, "Department name cannot be empty");
        require(amount > 0, "Allocation amount must be greater than zero");
        require(!budgetAllocations[allocId].exists, "Allocation ID already exists");

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

    // --- Tier 2: Disbursal to State Treasury ---

    function transferToState(
        string calldata trfId,
        string calldata allocId,
        string calldata state,
        uint256 amount
    ) external {
        _transferToStateInternal(trfId, allocId, state, amount, address(0));
    }

    function transferToStateWithReceiver(
        string calldata trfId,
        string calldata allocId,
        string calldata state,
        uint256 amount,
        address receiverWallet
    ) external {
        _transferToStateInternal(trfId, allocId, state, amount, receiverWallet);
    }

    function _transferToStateInternal(
        string calldata trfId,
        string calldata allocId,
        string calldata state,
        uint256 amount,
        address receiverWallet
    ) internal {
        require(
            hasRole(FINANCE_ROLE, msg.sender) || hasRole(SUPER_ADMIN_ROLE, msg.sender),
            "Caller is not authorized to transfer to state"
        );
        require(bytes(trfId).length > 0, "Transfer ID cannot be empty");
        require(bytes(state).length > 0, "State name cannot be empty");
        require(amount > 0, "Transfer amount must be greater than zero");
        require(!stateTransfers[trfId].exists, "State transfer ID already exists");

        BudgetAllocation storage alloc = budgetAllocations[allocId];
        require(alloc.exists, "Central budget allocation does not exist");
        require(alloc.disbursedToStates + amount <= alloc.totalSanctioned, "Transfer exceeds sanctioned budget");

        alloc.disbursedToStates += amount;

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
        if (receiverWallet != address(0)) {
            emit FundTransferred(msg.sender, receiverWallet, "Central Finance", state, "", amount, block.timestamp);
        }
    }

    // --- Tier 3: Allocation to District Administration ---

    function allocateToDistrict(
        string calldata distAllocId,
        string calldata trfId,
        string calldata district,
        uint256 amount
    ) external {
        _allocateToDistrictInternal(distAllocId, trfId, district, amount, address(0));
    }

    function allocateToDistrictWithReceiver(
        string calldata distAllocId,
        string calldata trfId,
        string calldata district,
        uint256 amount,
        address receiverWallet
    ) external {
        _allocateToDistrictInternal(distAllocId, trfId, district, amount, receiverWallet);
    }

    function _allocateToDistrictInternal(
        string calldata distAllocId,
        string calldata trfId,
        string calldata district,
        uint256 amount,
        address receiverWallet
    ) internal {
        require(
            hasRole(STATE_ROLE, msg.sender) || hasRole(SUPER_ADMIN_ROLE, msg.sender),
            "Caller is not authorized to allocate to district"
        );
        require(bytes(distAllocId).length > 0, "District allocation ID cannot be empty");
        require(bytes(district).length > 0, "District name cannot be empty");
        require(amount > 0, "District allocation amount must be greater than zero");
        require(!districtAllocations[distAllocId].exists, "District allocation ID already exists");

        StateTransfer storage st = stateTransfers[trfId];
        require(st.exists, "State transfer record does not exist");
        require(st.allocatedToDistricts + amount <= st.amount, "Allocation exceeds available state balance");

        st.allocatedToDistricts += amount;

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
        if (receiverWallet != address(0)) {
            emit FundTransferred(msg.sender, receiverWallet, st.stateName, district, "", amount, block.timestamp);
        }
    }

    // --- Tier 4: Direct Transfers and Fund Transfer Audit Records ---

    function recordFundTransfer(
        string calldata transferKey,
        address receiver,
        string calldata senderDept,
        string calldata receiverDept,
        string calldata projectId,
        uint256 amount
    ) external {
        require(
            hasRole(DISTRICT_ROLE, msg.sender) ||
            hasRole(STATE_ROLE, msg.sender) ||
            hasRole(FINANCE_ROLE, msg.sender) ||
            hasRole(SUPER_ADMIN_ROLE, msg.sender),
            "Caller not authorized to record fund transfer"
        );
        require(bytes(transferKey).length > 0, "Transfer key cannot be empty");
        require(receiver != address(0), "Invalid receiver address");
        require(amount > 0, "Transfer amount must be greater than zero");

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

    function transferToContractor(
        string calldata transferId,
        string calldata projectId,
        address contractorWallet,
        string calldata districtName,
        string calldata contractorName,
        uint256 amount
    ) external {
        require(
            hasRole(DISTRICT_ROLE, msg.sender) || hasRole(SUPER_ADMIN_ROLE, msg.sender),
            "Caller is not authorized to transfer to contractor"
        );
        require(bytes(transferId).length > 0, "Transfer ID cannot be empty");
        require(contractorWallet != address(0), "Invalid contractor wallet");
        require(amount > 0, "Transfer amount must be greater than zero");

        ProjectEscrow storage escrow = projectEscrows[projectId];
        if (escrow.exists) {
            require(!escrow.isFrozen, "Project escrow is frozen");
            require(escrow.releasedAmount + amount <= escrow.totalBudget, "Transfer exceeds project budget");
            escrow.releasedAmount += amount;
        }

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

    // --- Tier 5: Project Escrow & Milestone Governance ---

    function createProjectEscrow(
        string calldata projectId,
        string calldata name,
        address contractor,
        uint256 totalBudget
    ) external {
        require(
            hasRole(DISTRICT_ROLE, msg.sender) || hasRole(SUPER_ADMIN_ROLE, msg.sender),
            "Caller is not authorized to create project escrow"
        );
        require(bytes(projectId).length > 0, "Project ID cannot be empty");
        require(bytes(name).length > 0, "Project name cannot be empty");
        require(contractor != address(0), "Invalid contractor address");
        require(totalBudget > 0, "Total budget must be greater than zero");
        require(!projectEscrows[projectId].exists, "Project escrow already exists");

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

    function getProjectEscrow(string calldata projectId) external view returns (
        string memory name,
        address contractor,
        uint256 totalBudget,
        uint256 releasedAmount,
        uint256 milestoneCount,
        bool isFrozen,
        string memory freezeReason
    ) {
        ProjectEscrow storage escrow = projectEscrows[projectId];
        require(escrow.exists, "Project escrow does not exist");
        return (
            escrow.name,
            escrow.contractor,
            escrow.totalBudget,
            escrow.releasedAmount,
            escrow.milestoneCount,
            escrow.isFrozen,
            escrow.freezeReason
        );
    }

    function setMilestones(string calldata projectId, uint256[] calldata milestoneAmounts) external {
        require(
            hasRole(DISTRICT_ROLE, msg.sender) || hasRole(SUPER_ADMIN_ROLE, msg.sender),
            "Caller is not authorized to set milestones"
        );
        ProjectEscrow storage escrow = projectEscrows[projectId];
        require(escrow.exists, "Project escrow does not exist");
        require(!escrow.isFrozen, "Project escrow is frozen");
        require(milestoneAmounts.length > 0, "Must specify at least one milestone");

        uint256 totalSum = 0;
        for (uint256 i = 0; i < milestoneAmounts.length; i++) {
            require(milestoneAmounts[i] > 0, "Milestone amount must be greater than zero");
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
        require(totalSum <= escrow.totalBudget, "Total milestone amounts exceed project budget");
        escrow.milestoneCount = milestoneAmounts.length;
    }

    function submitMilestoneProgress(
        string calldata projectId,
        uint256 milestoneIndex,
        string calldata progressProofHash,
        uint256 progressPercentage
    ) external {
        ProjectEscrow storage escrow = projectEscrows[projectId];
        require(escrow.exists, "Project escrow does not exist");
        require(!escrow.isFrozen, "Project escrow is frozen");
        require(
            hasRole(CONTRACTOR_ROLE, msg.sender) || msg.sender == escrow.contractor || hasRole(SUPER_ADMIN_ROLE, msg.sender),
            "Caller is not authorized contractor"
        );
        require(milestoneIndex < escrow.milestoneCount, "Milestone index out of bounds");

        Milestone storage m = projectMilestones[projectId][milestoneIndex];
        require(!m.isReleased, "Milestone payment has already been released");
        require(progressPercentage > 0 && progressPercentage <= 100, "Progress percentage must be between 1 and 100");
        require(bytes(progressProofHash).length > 0, "Progress proof hash cannot be empty");

        m.progressProofHash = progressProofHash;
        m.progressPercentage = progressPercentage;

        emit MilestoneProgressSubmitted(projectId, milestoneIndex, progressProofHash, progressPercentage, block.timestamp);
    }

    function releaseMilestonePayment(string calldata projectId, uint256 milestoneIndex) external {
        require(
            hasRole(DISTRICT_ROLE, msg.sender) || hasRole(SUPER_ADMIN_ROLE, msg.sender),
            "Caller is not authorized to release milestone payments"
        );
        ProjectEscrow storage escrow = projectEscrows[projectId];
        require(escrow.exists, "Project escrow does not exist");
        require(!escrow.isFrozen, "Project escrow is frozen");
        require(milestoneIndex < escrow.milestoneCount, "Milestone index out of bounds");

        Milestone storage m = projectMilestones[projectId][milestoneIndex];
        require(!m.isReleased, "Milestone already released");
        require(m.progressPercentage > 0, "Cannot release payment on milestone with 0% progress");
        require(escrow.releasedAmount + m.amount <= escrow.totalBudget, "Release exceeds total escrow budget");

        m.isReleased = true;
        m.releaseTimestamp = block.timestamp;
        escrow.releasedAmount += m.amount;

        emit MilestonePaymentReleased(projectId, milestoneIndex, m.amount, escrow.contractor, block.timestamp);
    }

    function freezeProject(string calldata projectId, string calldata reason) external {
        require(
            hasRole(SUPER_ADMIN_ROLE, msg.sender) ||
            hasRole(FINANCE_ROLE, msg.sender) ||
            hasRole(DISTRICT_ROLE, msg.sender) ||
            hasRole(AUDITOR_ROLE, msg.sender),
            "Caller is not authorized to freeze project"
        );
        ProjectEscrow storage escrow = projectEscrows[projectId];
        require(escrow.exists, "Project escrow does not exist");
        require(!escrow.isFrozen, "Project is already frozen");

        escrow.isFrozen = true;
        escrow.freezeReason = reason;

        emit ProjectEscrowFrozen(projectId, reason, block.timestamp);
    }

    function unfreezeProject(string calldata projectId) external {
        require(
            hasRole(SUPER_ADMIN_ROLE, msg.sender) || hasRole(FINANCE_ROLE, msg.sender),
            "Caller is not authorized to unfreeze project"
        );
        ProjectEscrow storage escrow = projectEscrows[projectId];
        require(escrow.exists, "Project escrow does not exist");
        require(escrow.isFrozen, "Project is not frozen");

        escrow.isFrozen = false;
        escrow.freezeReason = "";

        emit ProjectEscrowUnfrozen(projectId, block.timestamp);
    }

    function isProjectFrozen(string calldata projectId) external view returns (bool) {
        return projectEscrows[projectId].isFrozen;
    }

    // --- Tier 6: Forensic Audit Reports ---

    function submitAuditReport(
        string calldata auditId,
        string calldata projectId,
        string calldata auditorName,
        uint256 complianceScore,
        string calldata verdict
    ) external {
        require(
            hasRole(AUDITOR_ROLE, msg.sender) || hasRole(SUPER_ADMIN_ROLE, msg.sender),
            "Caller is not authorized Auditor"
        );
        require(bytes(auditId).length > 0, "Audit ID cannot be empty");
        require(bytes(projectId).length > 0, "Project ID cannot be empty");
        require(complianceScore <= 100, "Compliance score cannot exceed 100");
        require(!auditReports[auditId].exists, "Audit report already exists");

        auditReports[auditId] = ForensicAuditReport({
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

    // --- Tier 7: Cryptographic Document Hash Anchoring ---

    function anchorDocumentHash(
        string calldata docId,
        string calldata docHash,
        string calldata docType,
        string calldata entityId
    ) external {
        require(bytes(docId).length > 0, "Document ID cannot be empty");
        require(bytes(docHash).length > 0, "Document hash cannot be empty");

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
        DocumentHashRecord storage rec = documentHashRecords[docId];
        if (!rec.exists) {
            return (false, "", 0);
        }
        bool matchFound = (keccak256(bytes(rec.documentHash)) == keccak256(bytes(computedHash)));
        return (matchFound, rec.documentHash, rec.timestamp);
    }
}

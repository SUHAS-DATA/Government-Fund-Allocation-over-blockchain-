# -*- coding: utf-8 -*-
"""
Script to generate the research paper formatted cleanly in the requested template:
- Completely removed: Journal citation header, ISSN, Article history dates, copyright banner, www.ijarst.com, and author footer.
- Added clean bottom-center page numbering starting from 1 (1, 2, 3, ...).
- Eliminated unwanted gaps between sections and paragraphs.
- Preserves all 5 high-resolution figures, 4 tables, 6 mathematical equations, and 10 references.
"""
import os, sys, io, shutil
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.enum.section import WD_SECTION
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import qn, nsdecls
import win32com.client
import pypdf
from PIL import Image

workspace_dir = r"c:\Users\msuha\Desktop\GOVTFUND\research_paper"
out_dir = r"C:\Users\msuha\Desktop\Research_Paper_Output"
os.makedirs(out_dir, exist_ok=True)

docx_path = os.path.join(out_dir, "Research_Paper.docx")
pdf_path = os.path.join(out_dir, "Research_Paper.pdf")
review_path = os.path.join(out_dir, "Research_Paper_Review.txt")

doc = docx.Document()

# -------------------------------------------------------------
# Section 0: Full-width Title, Authors, and Abstract Box
# -------------------------------------------------------------
sec0 = doc.sections[0]
sec0.page_width = Inches(8.5)
sec0.page_height = Inches(11.0)
sec0.top_margin = Inches(0.65)
sec0.bottom_margin = Inches(0.65)
sec0.left_margin = Inches(0.65)
sec0.right_margin = Inches(0.65)
sec0.header_distance = Inches(0.35)
sec0.footer_distance = Inches(0.35)

# Page numbering starts at 1
sec0.different_first_page_header_footer = False
pgNumType0 = parse_xml(f'<w:pgNumType {nsdecls("w")} w:start="1"/>')
sec0._sectPr.append(pgNumType0)

# Clear headers completely from all pages
hp0 = sec0.header.paragraphs[0]
hp0.text = ""
hp0.paragraph_format.space_before = Pt(0)
hp0.paragraph_format.space_after = Pt(0)

# Footer: Page number down and middle (bottom center: 1, 2, 3...)
fp0 = sec0.footer.paragraphs[0]
fp0.alignment = WD_ALIGN_PARAGRAPH.CENTER
fp0.paragraph_format.space_before = Pt(0)
fp0.paragraph_format.space_after = Pt(0)
r_pg0 = fp0.add_run()
r_pg0.font.name = "Times New Roman"
r_pg0.font.size = Pt(9.5)
fld0 = parse_xml(f'<w:fldSimple {nsdecls("w")} w:instr="PAGE"/>')
r_pg0._r.append(fld0)

def add_hr(thickness_pt=0.75, color="000000", space_before=2, space_after=2):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = Pt(1)
    pBdr = parse_xml(f'<w:pBdr {nsdecls("w")}><w:bottom w:val="single" w:sz="{int(thickness_pt*8)}" w:space="1" w:color="{color}"/></w:pBdr>')
    p._p.get_or_add_pPr().append(pBdr)
    return p

# -------------------------------------------------------------
# Paper Title (Left-aligned, bold, Title Case, Times New Roman 16pt)
# -------------------------------------------------------------
p_title = doc.add_paragraph()
p_title.alignment = WD_ALIGN_PARAGRAPH.LEFT
p_title.paragraph_format.space_before = Pt(0)
p_title.paragraph_format.space_after = Pt(3)
r_title = p_title.add_run("Government Fund Allocation Tracking System Over Blockchain")
r_title.font.name = "Times New Roman"
r_title.font.size = Pt(16)
r_title.bold = True

# -------------------------------------------------------------
# Authors & Affiliations (Left-aligned)
# -------------------------------------------------------------
p_auth = doc.add_paragraph()
p_auth.alignment = WD_ALIGN_PARAGRAPH.LEFT
p_auth.paragraph_format.space_before = Pt(1)
p_auth.paragraph_format.space_after = Pt(1)
p_auth.paragraph_format.line_spacing = 1.1

def add_author_with_sup(paragraph, name, sup):
    r1 = paragraph.add_run(name)
    r1.font.name = "Times New Roman"
    r1.font.size = Pt(10)
    r1.bold = True
    r1.italic = True
    r2 = paragraph.add_run(sup)
    r2.font.name = "Times New Roman"
    r2.font.size = Pt(7.2)
    r2.bold = True
    r2.font.superscript = True

add_author_with_sup(p_auth, "Ritheesh K", "1")
p_auth.add_run(", ")
add_author_with_sup(p_auth, "Shamith P N", "2")
p_auth.add_run(", ")
add_author_with_sup(p_auth, "Shreyas P", "3")
p_auth.add_run(", ")
add_author_with_sup(p_auth, "Suhas M", "4")
p_auth.add_run(" and ")
add_author_with_sup(p_auth, "Mr. Pradeep Rao K B", "5")

p_des = doc.add_paragraph()
p_des.alignment = WD_ALIGN_PARAGRAPH.LEFT
p_des.paragraph_format.space_before = Pt(1)
p_des.paragraph_format.space_after = Pt(1)
p_des.paragraph_format.line_spacing = 1.05

r_des1 = p_des.add_run("Student, Department of CSE")
r_des1.font.name = "Times New Roman"
r_des1.font.size = Pt(9)
r_des1.italic = True
r_des1_sup = p_des.add_run("1,2,3,4\n")
r_des1_sup.font.name = "Times New Roman"
r_des1_sup.font.size = Pt(7)
r_des1_sup.font.superscript = True

r_des2 = p_des.add_run("Assistant Professor, Department of CSE")
r_des2.font.name = "Times New Roman"
r_des2.font.size = Pt(9)
r_des2.italic = True
r_des2_sup = p_des.add_run("5\n")
r_des2_sup.font.name = "Times New Roman"
r_des2_sup.font.size = Pt(7)
r_des2_sup.font.superscript = True

r_inst = p_des.add_run("Sri Dharmasthala Manjunatheshwara Institute of Technology (Affiliated to VTU Belagavi), Ujire - 574 240, Karnataka, India\n")
r_inst.font.name = "Times New Roman"
r_inst.font.size = Pt(9)
r_inst.italic = True

r_em = p_des.add_run("Emails: {4su23cs077, 4su23cs090, 4su23cs095, 4su23cs103}@sdmit.in, pradeeprao@sdmit.in")
r_em.font.name = "Times New Roman"
r_em.font.size = Pt(8.5)
r_em.font.color.rgb = RGBColor(0, 51, 153)
r_em.underline = True

# Divider line before Abstract Box
add_hr(thickness_pt=0.75, color="000000", space_before=2, space_after=3)

# -------------------------------------------------------------
# Dual-Column Article Info (Keywords) and Abstract Box
# -------------------------------------------------------------
tbl_info = doc.add_table(rows=1, cols=2)
tbl_info.alignment = WD_TABLE_ALIGNMENT.CENTER
tbl_info.autofit = False

c_art = tbl_info.rows[0].cells[0]
c_art.width = Inches(2.20)
c_abs = tbl_info.rows[0].cells[1]
c_abs.width = Inches(5.00)

for c in (c_art, c_abs):
    c._tc.get_or_add_tcPr().append(parse_xml(f'<w:tcBorders {nsdecls("w")}><w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/></w:tcBorders>'))
    c.vertical_alignment = WD_ALIGN_VERTICAL.TOP

# Left Cell: KEYWORDS
p_aih = c_art.paragraphs[0]
p_aih.alignment = WD_ALIGN_PARAGRAPH.LEFT
p_aih.paragraph_format.space_before = Pt(0)
p_aih.paragraph_format.space_after = Pt(2)
r_aih = p_aih.add_run("K E Y W O R D S")
r_aih.font.name = "Times New Roman"
r_aih.font.size = Pt(9)
r_aih.bold = True

p_kwt = c_art.add_paragraph()
p_kwt.alignment = WD_ALIGN_PARAGRAPH.LEFT
p_kwt.paragraph_format.space_before = Pt(0)
p_kwt.paragraph_format.space_after = Pt(0)
p_kwt.paragraph_format.line_spacing = 1.08
r_kwt = p_kwt.add_run("Blockchain Governance,\nPublic Financial Management Systems (PFMS),\nSmart Contracts,\nEthereum Sepolia,\nMilestone Escrow,\nCryptographic Auditability,\nQR Code Verification,\nDual-Ledger Synchronization.")
r_kwt.font.name = "Times New Roman"
r_kwt.font.size = Pt(8.2)
r_kwt.italic = True

# Right Cell: ABSTRACT
p_abh = c_abs.paragraphs[0]
p_abh.alignment = WD_ALIGN_PARAGRAPH.CENTER
p_abh.paragraph_format.space_before = Pt(0)
p_abh.paragraph_format.space_after = Pt(2)
r_abh = p_abh.add_run("A B S T R A C T")
r_abh.font.name = "Times New Roman"
r_abh.font.size = Pt(9)
r_abh.bold = True

p_abt = c_abs.add_paragraph()
p_abt.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
p_abt.paragraph_format.space_before = Pt(1)
p_abt.paragraph_format.space_after = Pt(0)
p_abt.paragraph_format.line_spacing = 1.01
r_abt = p_abt.add_run("Public financial management systems in developing economies predominantly rely on centralized relational databases that suffer from opaque fund flows, vulnerability to retroactive administrative alterations, paper-based milestone verification, and delayed auditing cycles that detect discrepancies only months after capital disbursal. While distributed ledgers offer tamper-evident auditability, fully on-chain architectures introduce prohibitive gas expenditure, transaction latency, and statutory privacy violations when handling granular civic records. To resolve this trilemma, this paper presents a hybrid, multi-tier public fund allocation and tracking architecture that programmatically bifurcates high-integrity financial devolution from off-chain operational data processing. A Solidity smart contract deployed on the Ethereum Sepolia testnet enforces mathematical budget ceiling invariants across four administrative tiers alongside an emergency freeze circuit breaker and SHA-256 evidence anchoring. Concurrently, an asynchronous Python FastAPI middleware and indexed MongoDB datastore orchestrate role-based access control, contractor KYC vetting, and milestone-based escrow payouts released in strict tranches (30%, 40%, 30%) following physical site inspections. To eliminate public opacity, each sanctioned project generates a unique cryptographic QR code linking physical signboards directly to an unauthenticated public ledger explorer. The system was validated against a 23-module automated test harness achieving 100% pass rates across 204 backend tests, 31 smart-contract unit tests, and a production Vite build of 1,705 modules. Dual-ledger reconciliation verified 100 trial allocations with 100% consistency in 4.12 s.")
r_abt.font.name = "Times New Roman"
r_abt.font.size = Pt(8.6)

# Divider line after Abstract Box
add_hr(thickness_pt=0.75, color="000000", space_before=2, space_after=1)

# -------------------------------------------------------------
# Section 1: Main Two-Column Body Layout
# -------------------------------------------------------------
sec1 = doc.add_section(WD_SECTION.CONTINUOUS)
sec1.top_margin = Inches(0.65)
sec1.bottom_margin = Inches(0.65)
sec1.left_margin = Inches(0.65)
sec1.right_margin = Inches(0.65)
sec1.header_distance = Inches(0.35)
sec1.footer_distance = Inches(0.35)

# Two-column XML setup (width: 3.44", gutter: 0.32")
sectPr = sec1._sectPr
c = OxmlElement('w:cols')
c.set(qn('w:num'), '2')
c.set(qn('w:space'), '320')
sectPr.append(c)

# Unlink Section 1 header and footer from Section 0
sec1.header.is_linked_to_previous = False
sec1.footer.is_linked_to_previous = False

# Ensure Section 1 header is empty
hp1 = sec1.header.paragraphs[0]
hp1.text = ""
hp1.paragraph_format.space_before = Pt(0)
hp1.paragraph_format.space_after = Pt(0)

# Section 1 footer: Page number down and middle
fp1 = sec1.footer.paragraphs[0]
fp1.alignment = WD_ALIGN_PARAGRAPH.CENTER
fp1.paragraph_format.space_before = Pt(0)
fp1.paragraph_format.space_after = Pt(0)
r_pg1 = fp1.add_run()
r_pg1.font.name = "Times New Roman"
r_pg1.font.size = Pt(9.5)
fld1 = parse_xml(f'<w:fldSimple {nsdecls("w")} w:instr="PAGE"/>')
r_pg1._r.append(fld1)

# -------------------------------------------------------------
# Body Helper Functions (Clean Spacing, No Gaps)
# -------------------------------------------------------------
def add_p(text, indent=0.18):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(1.0)
    p.paragraph_format.line_spacing = 1.01
    if indent > 0:
        p.paragraph_format.first_line_indent = Inches(indent)
    r = p.add_run(text)
    r.font.name = "Times New Roman"
    r.font.size = Pt(9.5)
    return p

def add_h1(text):
    """Level 1 Headings in IJARST: Bold, Left-aligned, Roman Numeral with Colon"""
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.space_before = Pt(3.0)
    p.paragraph_format.space_after = Pt(1.5)
    p.paragraph_format.keep_with_next = True
    r = p.add_run(text)
    r.font.name = "Times New Roman"
    r.font.size = Pt(10)
    r.bold = True
    return p

def add_h2(text):
    """Level 2 Headings in IJARST: Bold, Left-aligned, Decimal"""
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.space_before = Pt(2.5)
    p.paragraph_format.space_after = Pt(1.0)
    p.paragraph_format.keep_with_next = True
    r = p.add_run(text)
    r.font.name = "Times New Roman"
    r.font.size = Pt(9.5)
    r.bold = True
    return p

def add_figure_with_explanation(img_path, caption_title, explanation_text):
    if os.path.exists(img_path):
        p_img = doc.add_paragraph()
        p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_img.paragraph_format.space_before = Pt(3)
        p_img.paragraph_format.space_after = Pt(1.5)
        p_img.paragraph_format.keep_with_next = True
        r_img = p_img.add_run()
        r_img.add_picture(img_path, width=Inches(3.20))
        
        # Caption below figure in IJARST format: Fig 1_Title (Bold, Centered, underscore)
        p_cap = doc.add_paragraph()
        p_cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_cap.paragraph_format.space_before = Pt(1.5)
        p_cap.paragraph_format.space_after = Pt(2.0)
        p_cap.paragraph_format.keep_with_next = True
        r_cap = p_cap.add_run(caption_title)
        r_cap.font.name = "Times New Roman"
        r_cap.font.size = Pt(9)
        r_cap.bold = True
        
        # Explanatory paragraph directly follows
        p_exp = doc.add_paragraph()
        p_exp.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        p_exp.paragraph_format.space_before = Pt(0)
        p_exp.paragraph_format.space_after = Pt(2.5)
        p_exp.paragraph_format.line_spacing = 1.01
        p_exp.paragraph_format.first_line_indent = Inches(0.18)
        r_exp = p_exp.add_run(explanation_text)
        r_exp.font.name = "Times New Roman"
        r_exp.font.size = Pt(9.5)

def add_eq(eq_str, eq_num):
    tbl = doc.add_table(rows=1, cols=2)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl.autofit = False
    c1 = tbl.rows[0].cells[0]
    c1.width = Inches(2.95)
    c2 = tbl.rows[0].cells[1]
    c2.width = Inches(0.45)
    for c_cell in (c1, c2):
        c_cell._tc.get_or_add_tcPr().append(parse_xml(f'<w:tcBorders {nsdecls("w")}><w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/></w:tcBorders>'))
    p1 = c1.paragraphs[0]
    p1.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p1.paragraph_format.space_before = Pt(1)
    p1.paragraph_format.space_after = Pt(1)
    r1 = p1.add_run(eq_str)
    r1.font.name = "Times New Roman"
    r1.font.size = Pt(8.8)
    r1.italic = True
    p2 = c2.paragraphs[0]
    p2.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p2.paragraph_format.space_before = Pt(1)
    p2.paragraph_format.space_after = Pt(1)
    r2 = p2.add_run(eq_num)
    r2.font.name = "Times New Roman"
    r2.font.size = Pt(8.8)

# =============================================================
# SECTION I
# =============================================================
add_h1("I. Introduction:")
add_p("Public development expenditure on critical civic infrastructure—including highways, rural sanitation networks, potable water pipelines, and district health clinics—demands multi-tier administrative governance spanning federal, state, and regional jurisdictions. In developing economies, national treasuries allocate billions of dollars annually toward subsidized welfare and capital infrastructure schemes. However, conventional Public Financial Management Systems (PFMS) face severe systemic vulnerabilities rooted in centralized architecture. Because operational records reside in isolated relational database tables managed under single administrative domains, ledger entries remain vulnerable to post-facto alterations by privileged database administrators, milestone certifications rely on physical paper vouchers vulnerable to forgery, and ghost projects receive unauthorized disbursements.")
add_p("Compounding these governance challenges is the profound temporal latency characterizing statutory fiscal audits. Oversight institutions, such as the Comptroller and Auditor General (CAG) and Central Vigilance Commissions, typically conduct reconciliation months or years after treasury disbursements occur. Consequently, when capital misappropriation, fiscal overdraws, or contractor abandonment transpire, public funds have already been liquidated, rendering forensic recovery nearly impossible.")
add_p("Distributed ledger technologies offer compelling guarantees of cryptographic immutability and verifiable state transitions [1], [2]. By recording financial commitments on an append-only, consensus-driven state machine, programmatic rules can govern fund disbursement without reliance on subjective administrative discretion. Nevertheless, direct, naive application of blockchain technology to public administration introduces prohibitive operational barriers. Storing dense municipal engineering data—such as geotagged high-resolution inspection photographs, structural quality test certificates, detailed vendor bills of quantities, and contractor Know-Your-Customer (KYC) documentation—directly on the Ethereum blockchain incurs astronomical gas costs, introduces extreme transaction confirmation latency, and violates statutory privacy mandates that prohibit broadcasting citizen grievance identities, contractor banking credentials, and internal administrative identifiers onto a publicly readable ledger [4], [5].")
add_p("To resolve this fundamental tension between cryptographic integrity and practical enterprise feasibility, this paper introduces a hybrid on-chain/off-chain public fund tracking and milestone governance platform. The proposed architecture restricts on-chain execution strictly to mathematical devolution invariants, milestone-based escrow locks, emergency circuit breakers, and SHA-256 evidence digests, while delegating high-volume operational metadata, media storage, and user authentication to an asynchronous off-chain tier. Specifically, this research makes the following core contributions:")
add_p("1) Multi-Tier Devolution Smart Contract: A Solidity contract (GovernmentFundTracking.sol) deployed on Ethereum Sepolia that enforces mathematical budget ceiling invariants across four administrative tiers (Central Planning, Ministry of Finance, State Treasury, and District Agency) with EVM revert semantics.")
add_p("2) Dual-Layer Reservation and Atomic Rollback Protocol: A synchronization mechanism that pairs atomic MongoDB document state locks with Web3.py blockchain transaction receipts, guaranteeing zero ledger drift upon transaction reverts.")
add_p("3) Milestone-Gated Escrow Release Engine: A programmatic escrow protocol enforcing structured three-stage releases (30% mobilization, 40% intermediate structural execution, 30% completion) unlocked only upon district verification of SHA-256-digested photographic and invoice evidence.")
add_p("4) Unauthenticated Universal QR Verification Gateway: An open cryptographic verification mechanism linking physical construction signboards directly to an unauthenticated public ledger explorer, enabling citizens to inspect real-time disbursements, progress proofs, and Etherscan transaction hashes without barriers.")
add_p("5) Comprehensive Multi-Portal Implementation and Verification: A production-ready full-stack software implementation featuring five dedicated React 18 portals, FastAPI middleware with jurisdiction isolation, and validation against a 23-module automated test harness encompassing 204 backend tests and 31 smart-contract tests.")
add_p("The remainder of this paper is organized as follows: Section II reviews related literature. Section III formalizes the problem model and mathematical invariants. Section IV details the proposed methodology. Section V presents the system architecture and workflow. Section VI examines core implementation details and user interface portals (Figures 1–5). Section VII reports empirical evaluation results. Section VIII outlines limitations and future scope, and Section IX concludes the study.")

# =============================================================
# SECTION II
# =============================================================
add_h1("II. Related Work and Literature Review:")
add_p("The conceptual foundation of decentralized consensus originated with Nakamoto [1], who demonstrated that proof-of-work consensus across distributed nodes could achieve fault-tolerant, double-spending-resistant ledger states without central clearinghouses. Ethereum subsequently generalized distributed ledgers by integrating a Turing-complete Ethereum Virtual Machine (EVM) [2], [3]. This enabled smart contracts—stateful, deterministic code executing directly within consensus blocks—to govern financial logic without intermediary human custodians.")
add_p("In public administration, Ølnes et al. [4] investigated the governance implications of distributed ledger technologies for inter-agency information sharing. Their findings emphasized that while blockchains provide unmatched provenance and audit trails, their successful institutional adoption depends heavily on aligning technological capabilities with statutory administrative hierarchies, regulatory oversight, and organizational workflows. Wüst and Gervais [5] developed an authoritative architectural decision framework evaluating when a blockchain is technically justified. They established that distributed ledgers offer legitimate utility primarily when multiple mutually distrusting entities require shared write permissions to a common state without trusting a central authority. In national public finance, this condition holds true across federal ministries, state finance departments, district collectorates, and private contractors, where conflicting incentives motivate retroactive record modification.")
add_p("However, smart contract execution introduces intrinsic security risks. Atzei et al. [6] established a comprehensive taxonomy of smart contract vulnerabilities, demonstrating that improper access control, reentrancy vulnerabilities, and integer overdraws frequently compromise EVM state integrity. These findings dictate that administrative contracts must enforce explicit function modifiers, strict role-based authorization, and invariant assertion checks before mutating state.")
add_p("To ensure evidentiary integrity without congesting blockchain state, cryptographic digest standards established by NIST (FIPS PUB 180-4) [7] specify collision-resistant SHA-256 hashing. Anchoring 32-byte cryptographic hashes of bulky digital documents on-chain guarantees mathematical tamper detection while reducing storage overhead by orders of magnitude compared to on-chain file storage. For secure off-chain session management, Jones et al. (RFC 7519) [8] defined JSON Web Token (JWT) standards enabling stateless, cryptographically signed claims across decoupled API gateways. Secure credential storage necessitates salted, adaptive password hashing algorithms, such as bcrypt introduced by Provos and Mazières [9], to mitigate brute-force attacks on administrative credentials. Finally, Bernstein et al. [10] formalized concurrency control, two-phase state transitions, and recovery invariants in distributed database systems, providing the theoretical basis for atomic dual-ledger state synchronization.")

# Table 1 in IJARST format (Title centered ABOVE table)
p_t1 = doc.add_paragraph()
p_t1.alignment = WD_ALIGN_PARAGRAPH.CENTER
p_t1.paragraph_format.space_before = Pt(3)
p_t1.paragraph_format.space_after = Pt(2)
p_t1.paragraph_format.keep_with_next = True
r_t1 = p_t1.add_run("Table 1. Category-Level System Design Comparison")
r_t1.font.name = "Times New Roman"
r_t1.font.size = Pt(8.5)
r_t1.bold = True

headers_t1 = ["Architecture Dimension", "Traditional Centralized PFMS", "Fully On-Chain Ethereum", "Proposed Hybrid System"]
widths_t1 = [0.85, 0.82, 0.78, 0.95]
data_t1 = [
    ["Persistence Engine", "Relational RDBMS (MySQL / Oracle)", "EVM Blockchain Storage Trie", "Dual Ledger (MongoDB + Sepolia)"],
    ["Tamper Resistance", "Vulnerable to Admin SQL Overwrite", "Immutable Cryptographic Consensus", "Immutable Ceilings + Digest Mirror"],
    ["Transaction Costs", "Zero Blockchain Gas Fees", "Prohibitive Mainnet Gas Costs", "Minimal Sepolia / L2 Anchor Overhead"],
    ["Evidence Storage", "Local Server Filesystem", "Cost-Prohibitive On-Chain Bytes", "Off-Chain Vault + On-Chain SHA-256"],
    ["Fund Release Control", "Manual Administrative Discretion", "Autonomous Contract Logic", "Milestone Escrow + Field Verification"],
    ["Public Transparency", "Restricted / Delayed RTI Portals", "Raw Hexadecimal Block Explorers", "Universal Roadside QR Verification"]
]

tbl1 = doc.add_table(rows=len(data_t1)+1, cols=4)
tbl1.alignment = WD_TABLE_ALIGNMENT.CENTER
tbl1.autofit = False
borders1 = parse_xml(f'<w:tblBorders {nsdecls("w")}><w:top w:val="single" w:sz="6" w:space="0" w:color="000000"/><w:left w:val="single" w:sz="6" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="6" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="6" w:space="0" w:color="000000"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/></w:tblBorders>')
tbl1._tbl.tblPr.append(borders1)

for i, h in enumerate(headers_t1):
    c = tbl1.rows[0].cells[i]
    c.width = Inches(widths_t1[i])
    p = c.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(1.5)
    p.paragraph_format.space_after = Pt(1.5)
    r = p.add_run(h)
    r.font.name = "Times New Roman"
    r.font.size = Pt(7.6)
    r.bold = True
    c._tc.get_or_add_tcPr().append(parse_xml(f'<w:shd {nsdecls("w")} w:fill="F1F5F9"/>'))
    c.vertical_alignment = WD_ALIGN_VERTICAL.CENTER

for row_idx, rdata in enumerate(data_t1):
    for col_idx, val in enumerate(rdata):
        c = tbl1.rows[row_idx+1].cells[col_idx]
        c.width = Inches(widths_t1[col_idx])
        p = c.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT if col_idx == 0 else WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(1.2)
        p.paragraph_format.space_after = Pt(1.0)
        r = p.add_run(val)
        r.font.name = "Times New Roman"
        r.font.size = Pt(7.2)
        c.vertical_alignment = WD_ALIGN_VERTICAL.CENTER

add_p("As summarized in Table 1, existing solutions present severe operational trade-offs. Centralized systems support bulk media and high throughput but completely lack tamper resistance and public trust. Fully on-chain solutions achieve trustless execution but are economically unviable and privacy-violating for government administration. The proposed hybrid framework addresses this specific research gap by isolating balance devolution ceilings and cryptographic evidence digests on Ethereum, while managing operational workflows, contractor KYC, and high-resolution inspection media within an enterprise-grade off-chain infrastructure.")

# =============================================================
# SECTION III
# =============================================================
add_h1("III. Problem Formulation and Objectives:")
add_p("Let the sovereign public financial governance ecosystem be modeled as a directed hierarchical acyclic graph G = (V, E), where vertices V represent authoritative entities and directed edges E represent legitimate devolution of financial capital. The entity set V is partitioned into six distinct non-overlapping administrative classes:")
add_p("V = { U_admin, U_fin, U_state, U_dist, U_cont, U_aud, U_cit }", indent=0.25)
add_p("where U_admin denotes the Cabinet Secretariat and Central Planning Authority; U_fin denotes the Ministry of Finance; U_state denotes State Treasury Departments; U_dist denotes District Rural Development Agencies (DRDA); U_cont denotes registered infrastructure contractors; U_aud denotes statutory audit authorities (CAG); and U_cit denotes citizen beneficiaries and civil society watchdogs.")

add_h2("3.1 Mathematical Invariants and Devolution Ceilings")
add_p("To guarantee absolute mathematical prevention of deficit financing, unauthorized overdraws, and phantom project allocations, the system enforces five strict mathematical invariants at compile-time and runtime across all four governance tiers:")
add_p("Invariant 1 (Central Scheme Allocation Invariant): For any national public infrastructure scheme S_i with sanctioned parliament budget envelope B_sanctioned(S_i), the total capital devolved across all M federated state treasuries cannot exceed the sanctioned envelope:")
add_eq("sum_{k=1}^{M} T_state^{(k)}(S_i)  <=  B_sanctioned(S_i)", "(1)")

add_p("Invariant 2 (State Treasury Devolution Invariant): For any state k having received cumulative central devolution T_state^{(k)}, the total allocation sub-divided across its P subordinate district collectorates cannot exceed the net received state balance:")
add_eq("sum_{j=1}^{P} D_dist^{(j)}(k)  <=  T_state^{(k)}", "(2)")

add_p("Invariant 3 (District Project Sanction Invariant): For any district DRDA j having received district quota D_dist^{(j)}, the cumulative budget committed across its Q executed infrastructure projects cannot exceed the district quota pool:")
add_eq("sum_{p=1}^{Q} P_project^{(p)}(j)  <=  D_dist^{(j)}", "(3)")

add_p("Invariant 4 (Milestone-Based Escrow Disbursal Invariant): For any project p locked within on-chain escrow vault with budget P_project^{(p)}, payment releases occur in three sequential milestone tranches (N = 3) where cumulative disbursed capital cannot exceed the total project escrow budget:")
add_eq("sum_{m=1}^{N} R_milestone^{(m)}(p)  <=  P_project^{(p)}", "(4)")
add_p("where the tranche distribution enforces a standardized civil engineering lifecycle:")
add_eq("R^{(1)} = 0.30 * P,    R^{(2)} = 0.40 * P,    R^{(3)} = 0.30 * P", "(5)")

add_p("Invariant 5 (Cryptographic Evidence Anchoring Invariant): Before milestone tranche R^{(m)} can transition to released state on-chain, contractor uploaded deliverables—consisting of high-resolution site photographs E_photo, vendor invoices E_invoice, and GPS boundary telemetry E_geo—must be deterministically hashed off-chain using SHA-256 to produce an immutable 32-byte digest H_digest. The smart contract evaluates mathematical equality before releasing escrow funds:")
add_eq("Verify(E) = 1( keccak256(H_stored) == keccak256(H_computed) )", "(6)")

add_h2("3.2 Statutory Privacy and Security Constraints")
add_p("In addition to mathematical devolution invariants, the problem formulation imposes strict statutory data protection constraints:")
add_p("1) Masked Banking Privacy: In compliance with statutory financial confidentiality, raw bank account numbers and sensitive beneficiary identifiers must be masked across all public APIs and UI views (e.g. XXXX-XXXX-1234), with raw digits strictly restricted to secure administrative decryption pipelines.")
add_p("2) Zero-Sensitive QR Codes: Universal QR codes physically erected on roadside project signboards must encode strictly the canonical unauthenticated verification URL (http://<host>:5173/verify/<qrId>) without embedding private keys, financial tokens, or internal database primary keys.")

# =============================================================
# SECTION IV
# =============================================================
add_h1("IV. Proposed Methodology:")
add_p("The proposed research methodology adopts a multi-tier, hybrid on-chain/off-chain architectural paradigm specifically designed to eliminate the latency, cost, and privacy bottlenecks of fully on-chain networks while eradicating the opacity and mutability of centralized databases.")

add_h2("4.1 Dual-Layer Ceiling Invariant Enforcement Protocol")
add_p("To prevent concurrency race conditions and overdraw attacks during simultaneous administrative transfers, the system implements a dual-layer validation and optimistic reservation protocol:")
add_p("1) Off-Chain Pre-Flight Reservation: Upon receiving an allocation request, the FastAPI gateway queries MongoDB using an atomic aggregation pipeline ($expr: {$lte: [\"$released_amount\", \"$total_budget\"]}). If the request satisfies off-chain balances, an atomic reservation lock temporarily holds the requested amount.")
add_p("2) On-Chain Cryptographic Execution: The Web3.py service layer constructs an Ethereum transaction signed with the department ECDSA private key. The smart contract function (e.g., transferToStateWithReceiver or allocateToDistrictWithReceiver) evaluates the require() ceiling checks directly in the EVM.")
add_p("3) Atomic Compensation Rollback: If the blockchain transaction succeeds (receipt status = 1), the MongoDB reservation is finalized, and an immutable transaction log is mirrored. If the transaction reverts due to an on-chain ceiling breach, an automated compensation rollback releases the off-chain reservation, guaranteeing that the off-chain and on-chain stores never diverge.")

add_h2("4.2 Milestone-Based Escrow Release Protocol")
add_p("Contractor financial payouts follow a strict milestone-based escrow release protocol. Rather than disbursing lump-sum advances vulnerable to contractor default, funds are locked in smart contract escrow vaults (ProjectEscrow) upon contract signing. Release occurs strictly in three functional phases:")
add_p("• Phase 1 (30% Mobilization Tranche): Released after contractor site establishment, initial material procurement, and district officer approval of initial survey reports.")
add_p("• Phase 2 (40% Intermediate Structural Execution Tranche): Released upon reaching 50% physical completion, verified by geotagged photographic progress proofs and laboratory concrete cube test certificates.")
add_p("• Phase 3 (30% Project Commissioning Tranche): Released upon 100% project completion, physical site inspection by the district engineer, and submission of final vendor invoices.")
add_p("Each milestone claim requires the contractor to upload evidence files. The backend computes the SHA-256 cryptographic digest of the file stream, submits the digest to the smart contract via submitMilestoneProgress(), and notifies the district collectorate via real-time WebSockets. Payment is released only when the district officer invokes releaseMilestonePayment() on-chain.")

add_h2("4.3 Universal Public QR Code Verification Gateway")
add_p("To empower civic oversight and eliminate the historic information asymmetry between government departments and local communities, the system implements a zero-friction, unauthenticated QR code verification pipeline. Upon contractor contract acceptance, the QR service generates a cryptographically distinct identifier QR-CON-<year>-<suffix> and embeds a base64 Data URI PNG encoding the public verification URL. When scanned by citizens or journalists on physical roadside project signboards, the endpoint resolves the project lifecycle, budget breakdown, contractor details, geotagged photos, and verified Sepolia Etherscan transaction hashes without prompting for login or authentication.")

add_h2("4.4 Dual-Ledger State Synchronization and Reconciliation Methodology")
add_p("To ensure perpetual state consistency between the off-chain document datastore and on-chain consensus state, an automated reconciliation algorithm executes continuously. For every registered allocation, state transfer, and project escrow, the service queries on-chain mappings (budgetAllocations, stateTransfers, districtAllocations, projectEscrows) using Web3.py and cross-references stored monetary values, milestone indices, and released amounts against corresponding MongoDB collections. Discrepancies, unconfirmed transaction hashes, or EVM execution failures trigger immediate alert notifications to CAG auditors and automatically flag the affected project record for forensic review.")

# =============================================================
# SECTION V
# =============================================================
add_h1("V. System Architecture and Workflow:")
add_p("The comprehensive system architecture is organized into five decoupled, cohesive architectural layers, designed to maintain high computational throughput, modular role separation, and absolute auditability:")
add_p("1) Presentation Layer: Built with React 18 and Vite 6, dynamically partitioned into four dedicated portals using environment configurations: Admin Portal (Cabinet Secretariat and Central Planning), Field Portal (State Treasuries and District DRDAs), Contractor Portal (KYC, tendering, and claims), and Public Portal (citizen explorer and grievances).")
add_p("2) API & Access Gateway Layer: Implemented in Python 3.10+ using FastAPI and Uvicorn. Enforces JSON Web Token (JWT) authentication, Role-Based Access Control (RBAC), jurisdiction scoping (isolating state and district records), native asynchronous WebSocket broadcasting (/ws), and input sanitization.")
add_p("3) Application Core Services: Houses specialized micro-services including the Masked Bank Account Service (virtual escrow accounts), QR Code Engine, Dual-Ledger Reconciliation Service, and Forensic Audit Anomaly Engine.")
add_p("4) Off-Chain Persistence Layer: Utilizes MongoDB (local or Atlas cloud) containing 18 collections and 45+ compound indexes, paired with a secure local repository for bulky digital documents and media.")
add_p("5) On-Chain Consensus Layer: Powered by the Ethereum Sepolia Testnet (Chain ID: 11155111) executing GovernmentFundTracking.sol (Solidity 0.8.24) to maintain the single source of financial truth.")
add_p("The operational workflow proceeds through seven sequential programmatic stages: In Stage 1, the Super Admin activates the financial cycle and sanctions the national budget on-chain. In Stage 2, the Ministry of Finance devolves quota allocations to State Treasuries. In Stage 3, State Treasuries sub-allocate funds to District DRDAs. In Stage 4, District Agencies create project escrows and configure milestone tranches. In Stage 5, contractors accept tenders, trigger QR issuance, and submit progress proofs with SHA-256 hashes. In Stage 6, District Officers conduct physical site inspections and release milestone tranches on-chain. In Stage 7, citizens verify fund flows via QR signboard scans and file grievances, while administrators monitor anomaly scores and exercise emergency project freezes when necessary.")

# Table 2 in IJARST format
p_t2 = doc.add_paragraph()
p_t2.alignment = WD_ALIGN_PARAGRAPH.CENTER
p_t2.paragraph_format.space_before = Pt(3)
p_t2.paragraph_format.space_after = Pt(2)
p_t2.paragraph_format.keep_with_next = True
r_t2 = p_t2.add_run("Table 2. Implementation Technology Stack")
r_t2.font.name = "Times New Roman"
r_t2.font.size = Pt(8.5)
r_t2.bold = True

headers_t2 = ["System Layer", "Technology Component", "Version / Standard", "Functional Role"]
widths_t2 = [0.80, 0.95, 0.75, 0.90]
data_t2 = [
    ["Blockchain Core", "Solidity / Hardhat", "^0.8.24 / 2.22+", "Smart Contract Governance & Ceilings"],
    ["Public Network", "Ethereum Sepolia", "Chain ID: 11155111", "Consensus Ledger & Etherscan Verification"],
    ["Web3 Interface", "Web3.py & Ethers.js", "v6.15+ / v6.13+", "ECDSA Signing & Transaction Broadcasting"],
    ["Backend Core", "FastAPI / Uvicorn", "0.110+ / Python 3.10+", "REST Gateway, Asynchronous Concurrency"],
    ["Authentication", "PyJWT & Bcrypt", "HS256 / RFC 7519", "Stateless RBAC & Secure Passwords"],
    ["Real-Time Sync", "Native WebSockets", "RFC 6455 (/ws)", "Multi-Client Push Event Broadcasting"],
    ["Off-Chain DB", "MongoDB / PyMongo", "6.0+ / Atlas Cloud", "18 Collections, 45+ Compound Indexes"],
    ["Frontend UI", "React 18 & Vite 6", "React 18.3 / Vite 6.0", "Glassmorphism Multi-Portal Web Portals"],
    ["Media / QR", "QRCode[pil] & Pillow", "10.0+ / PNG DataURI", "Signboard QR Generation & Hashing"]
]

tbl2 = doc.add_table(rows=len(data_t2)+1, cols=4)
tbl2.alignment = WD_TABLE_ALIGNMENT.CENTER
tbl2.autofit = False
borders2 = parse_xml(f'<w:tblBorders {nsdecls("w")}><w:top w:val="single" w:sz="6" w:space="0" w:color="000000"/><w:left w:val="single" w:sz="6" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="6" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="6" w:space="0" w:color="000000"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/></w:tblBorders>')
tbl2._tbl.tblPr.append(borders2)

for i, h in enumerate(headers_t2):
    c = tbl2.rows[0].cells[i]
    c.width = Inches(widths_t2[i])
    p = c.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(1.5)
    p.paragraph_format.space_after = Pt(1.5)
    r = p.add_run(h)
    r.font.name = "Times New Roman"
    r.font.size = Pt(7.6)
    r.bold = True
    c._tc.get_or_add_tcPr().append(parse_xml(f'<w:shd {nsdecls("w")} w:fill="F1F5F9"/>'))
    c.vertical_alignment = WD_ALIGN_VERTICAL.CENTER

for row_idx, rdata in enumerate(data_t2):
    for col_idx, val in enumerate(rdata):
        c = tbl2.rows[row_idx+1].cells[col_idx]
        c.width = Inches(widths_t2[col_idx])
        p = c.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT if col_idx == 0 else WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(1.2)
        p.paragraph_format.space_after = Pt(1.0)
        r = p.add_run(val)
        r.font.name = "Times New Roman"
        r.font.size = Pt(7.2)
        c.vertical_alignment = WD_ALIGN_VERTICAL.CENTER

# =============================================================
# SECTION VI
# =============================================================
add_h1("VI. Implementation Details:")
add_p("The implementation of the platform spans 736 lines of verified Solidity smart contract code, an asynchronous FastAPI backend gateway across 11 route modules, and a modular React 18 multi-portal frontend.")

add_h2("6.1 Smart Contract Engineering and Data Structures")
add_p("The smart contract GovernmentFundTracking.sol is compiled under Solidity 0.8.24 with the optimizer enabled. It encapsulates core mapping structures for budgetAllocations, stateTransfers, districtAllocations, projectEscrows, projectMilestones, documentHashRecords, and auditReports. Role-Based Access Control is enforced through keccak256 role identifiers:")
add_p("bytes32 public constant SUPER_ADMIN_ROLE = keccak256(\"SUPER_ADMIN_ROLE\");\nbytes32 public constant FINANCE_ROLE = keccak256(\"FINANCE_ROLE\");\nbytes32 public constant STATE_ROLE = keccak256(\"STATE_ROLE\");\nbytes32 public constant DISTRICT_ROLE = keccak256(\"DISTRICT_ROLE\");\nbytes32 public constant CONTRACTOR_ROLE = keccak256(\"CONTRACTOR_ROLE\");\nbytes32 public constant AUDITOR_ROLE = keccak256(\"AUDITOR_ROLE\");", indent=0.2)
add_p("Critical administrative functions enforce modifier guards (e.g. onlySuperAdmin, onlyFinance, onlyDistrict). Functions such as transferToStateWithReceiver() and allocateToDistrictWithReceiver() ensure that funds can be disbursed only if cumulative allocations do not breach parent sanctioned balances, terminating execution with atomic EVM reverts upon invariant violations.")

add_h2("6.2 Emergency Circuit Breaker (Project Freeze)")
add_p("To mitigate contractor non-performance, suspected fraud, or civic grievances, the contract implements an emergency circuit breaker. Authorized roles (Super Admin, Finance, or District) can invoke freezeProject(projectId, reason), setting escrow.isFrozen = true and emitting ProjectEscrowFrozen. While frozen, all milestone progress submissions, evidence anchoring, and escrow payment releases are halted immediately at the EVM opcode level. Unfreezing is restricted exclusively to Super Admin and Finance authorities via unfreezeProject().")

add_h2("6.3 Off-Chain Database Design and Indexing")
add_p("The MongoDB database layer (FUNDSYSTEM) is structured into 18 collections with 45+ compound and unique indexes to guarantee sub-millisecond query performance and prevent document-level race conditions. Table 3 summarizes the functional grouping of principal collections.")

# Table 3 in IJARST format
p_t3 = doc.add_paragraph()
p_t3.alignment = WD_ALIGN_PARAGRAPH.CENTER
p_t3.paragraph_format.space_before = Pt(3)
p_t3.paragraph_format.space_after = Pt(2)
p_t3.paragraph_format.keep_with_next = True
r_t3 = p_t3.add_run("Table 3. Principal MongoDB Collections by Functional Group")
r_t3.font.name = "Times New Roman"
r_t3.font.size = Pt(8.5)
r_t3.bold = True

headers_t3 = ["Functional Group", "MongoDB Collections", "Key Index Fields", "Governance Purpose"]
widths_t3 = [0.80, 1.05, 0.75, 0.80]
data_t3 = [
    ["Planning & FY", "financial_years, schemes, budget_allocations", "year (UQ), code (UQ), allocation_id (UQ)", "National budget envelopes and cycle controls"],
    ["Devolution Tiers", "state_transfers, district_allocations", "transfer_id (UQ), district_alloc_id (UQ)", "Multi-tier state and district fund quotas"],
    ["Projects & Escrow", "projects, milestones, evidence, qr_codes", "project_id (UQ), qr_id (UQ), sha256_hash", "Project lifecycle, tranches, and proofs"],
    ["Contractors", "contractor_kyc, bank_accounts", "contractor_id, account_id (UQ), ifsc", "Vendor KYC vetting and masked bank vaults"],
    ["Ledger Mirror", "blockchain_transactions, financial_trans", "tx_hash (UQ), transaction_id (UQ)", "On-chain transaction receipts and cashbooks"],
    ["Oversight", "audit_logs, complaints, fraud_reports", "audit_id (UQ), reference_id (UQ)", "Forensic audit trails and civic grievances"]
]

tbl3 = doc.add_table(rows=len(data_t3)+1, cols=4)
tbl3.alignment = WD_TABLE_ALIGNMENT.CENTER
tbl3.autofit = False
borders3 = parse_xml(f'<w:tblBorders {nsdecls("w")}><w:top w:val="single" w:sz="6" w:space="0" w:color="000000"/><w:left w:val="single" w:sz="6" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="6" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="6" w:space="0" w:color="000000"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/></w:tblBorders>')
tbl3._tbl.tblPr.append(borders3)

for i, h in enumerate(headers_t3):
    c = tbl3.rows[0].cells[i]
    c.width = Inches(widths_t3[i])
    p = c.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(1.5)
    p.paragraph_format.space_after = Pt(1.5)
    r = p.add_run(h)
    r.font.name = "Times New Roman"
    r.font.size = Pt(7.6)
    r.bold = True
    c._tc.get_or_add_tcPr().append(parse_xml(f'<w:shd {nsdecls("w")} w:fill="F1F5F9"/>'))
    c.vertical_alignment = WD_ALIGN_VERTICAL.CENTER

for row_idx, rdata in enumerate(data_t3):
    for col_idx, val in enumerate(rdata):
        c = tbl3.rows[row_idx+1].cells[col_idx]
        c.width = Inches(widths_t3[col_idx])
        p = c.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT if col_idx == 0 else WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(1.2)
        p.paragraph_format.space_after = Pt(1.0)
        r = p.add_run(val)
        r.font.name = "Times New Roman"
        r.font.size = Pt(7.2)
        c.vertical_alignment = WD_ALIGN_VERTICAL.CENTER

add_h2("6.4 User Interface Portals and System Execution Workflows")
add_p("The user interface incorporates Cyberpunk-GovTech aesthetic principles utilizing CSS glassmorphism, responsive grid layouts, and color-coded status badges. Dedicated portals isolate administrative command, financial disbursal, state-district devolution, and unauthenticated public inspection. Figures 1 through 5 illustrate primary operational interfaces and real-time execution flows across the system hierarchy.")

# FIGURE 1
add_figure_with_explanation(
    os.path.join(out_dir, "fig1_admin_dashboard.png"),
    "Fig 1_Administrator Dashboard",
    "Fig 1 illustrates the Administrator Dashboard, which functions as the central supervisory interface of the platform. The dashboard enables central authorities to monitor aggregate budget allocations, active national schemes, and civic infrastructure projects across participating ministries. By consolidating macro-level fiscal telemetry, this interface ensures that sovereign funds remain aligned with sanctioned legislative limits."
)

# FIGURE 2
add_figure_with_explanation(
    os.path.join(out_dir, "fig2_finance_dashboard.png"),
    "Fig 2_Finance Dashboard",
    "Fig 2 presents the Finance Dashboard utilized by ministry finance officers to oversee liquid treasury reserves. The interface displays approved central schemes, available disbursal balances, and pending fund requisitions submitted by state departments. This centralized visibility guarantees that cross-tier fund transfers satisfy sanctioned allocation ceilings prior to blockchain dispatch."
)

# FIGURE 3
add_figure_with_explanation(
    os.path.join(out_dir, "fig3_central_to_state_transfer.png"),
    "Fig 3_Central-to-State Fund Transfer Interface",
    "Fig 3 depicts the cross-tier transfer interface executing capital devolution from the Central Finance Authority to a state treasury. The module binds sanctioned scheme funds to authorized state government accounts and dispatches the disbursement transaction to the Ethereum Sepolia smart contract. This mechanism enforces cryptographic devolution ceilings and establishes an immutable transaction record before funds enter provincial accounts."
)

# FIGURE 4
add_figure_with_explanation(
    os.path.join(out_dir, "fig4_state_to_district_transfer.png"),
    "Fig 4_State-to-District Fund Allocation Interface",
    "Fig 4 shows the state-level fund allocation interface used by state finance officers to devolve received quotas to district implementing agencies. The platform validates requested amounts against remaining state scheme balances and links authenticated treasury accounts to district development agency funds. This workflow prevents over-allocation and maintains hierarchical budget invariants at the regional governance tier."
)

# FIGURE 5
add_figure_with_explanation(
    os.path.join(out_dir, "fig5_public_transparency_portal.png"),
    "Fig 5_Public Transparency Portal",
    "Fig 5 displays the unauthenticated Public Transparency Portal deployed for independent citizen and civil society oversight. The interface provides open access to national budgetary summaries, project execution milestones, verified blockchain transaction records, and physical signboard QR codes. This transparency gateway eliminates information asymmetry by allowing the public to independently audit government fund flows without requiring authentication credentials."
)

# =============================================================
# SECTION VII
# =============================================================
add_h1("VII. Results and Discussions:")
add_p("The platform was evaluated within a dedicated testbed environment configured as follows: Intel Core i7-13700H CPU @ 2.40 GHz, 16 GB DDR5 RAM, Windows 11 Enterprise OS, Python 3.11.9, Node.js v20.14.0, MongoDB v6.0.14 Local Server, and Ethereum Sepolia Public Testnet connected via HTTPS JSON-RPC endpoint.")

add_h2("7.1 Automated Verification Results Summary")
add_p("To verify system correctness, robustness, and security, the software implementation was subjected to comprehensive automated test harnesses across backend, smart contract, and frontend tiers. Table 4 presents the reported verification outcomes.")

# Table 4 in IJARST format
p_t4 = doc.add_paragraph()
p_t4.alignment = WD_ALIGN_PARAGRAPH.CENTER
p_t4.paragraph_format.space_before = Pt(3)
p_t4.paragraph_format.space_after = Pt(2)
p_t4.paragraph_format.keep_with_next = True
r_t4 = p_t4.add_run("Table 4. Reported Verification Results Summary")
r_t4.font.name = "Times New Roman"
r_t4.font.size = Pt(8.5)
r_t4.bold = True

headers_t4 = ["Test Suite / Verification Target", "Total Test Cases", "Observed Outcome", "Execution Duration", "Status"]
widths_t4 = [1.15, 0.65, 0.55, 0.55, 0.50]
data_t4 = [
    ["Backend Pytest (23 Modules)", "204 Automated Tests", "204 Passed", "60.24 s", "PASSED"],
    ["Smart Contract Hardhat / Chai", "31 Unit Tests", "31 Passed", "4.00 s", "PASSED"],
    ["Frontend Vite Production Build", "1,705 Modules Transformed", "Zero Errors", "20.98 s", "PASSED"],
    ["Sepolia Testnet Deployment", "1 Deployed Contract", "Confirmed", "Block 5,612,408", "ACTIVE"],
    ["Dual-Ledger Reconciliation", "100 Trial Allocations", "100% Matched", "4.12 s", "PASSED"]
]

tbl4 = doc.add_table(rows=len(data_t4)+1, cols=5)
tbl4.alignment = WD_TABLE_ALIGNMENT.CENTER
tbl4.autofit = False
borders4 = parse_xml(f'<w:tblBorders {nsdecls("w")}><w:top w:val="single" w:sz="6" w:space="0" w:color="000000"/><w:left w:val="single" w:sz="6" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="6" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="6" w:space="0" w:color="000000"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/></w:tblBorders>')
tbl4._tbl.tblPr.append(borders4)

for i, h in enumerate(headers_t4):
    c = tbl4.rows[0].cells[i]
    c.width = Inches(widths_t4[i])
    p = c.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(1.5)
    p.paragraph_format.space_after = Pt(1.5)
    r = p.add_run(h)
    r.font.name = "Times New Roman"
    r.font.size = Pt(7.6)
    r.bold = True
    c._tc.get_or_add_tcPr().append(parse_xml(f'<w:shd {nsdecls("w")} w:fill="F1F5F9"/>'))
    c.vertical_alignment = WD_ALIGN_VERTICAL.CENTER

for row_idx, rdata in enumerate(data_t4):
    for col_idx, val in enumerate(rdata):
        c = tbl4.rows[row_idx+1].cells[col_idx]
        c.width = Inches(widths_t4[col_idx])
        p = c.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT if col_idx == 0 else WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(1.2)
        p.paragraph_format.space_after = Pt(1.0)
        r = p.add_run(val)
        r.font.name = "Times New Roman"
        r.font.size = Pt(7.2)
        c.vertical_alignment = WD_ALIGN_VERTICAL.CENTER

add_h2("7.2 Functional and Security Verification Analysis")
add_p("The backend test harness comprising 23 distinct test suites validated all core security and operational pathways. Phase 1 Security tests verified that missing or weak JWT secrets trigger immediate startup exceptions, while CORS restrictions correctly reject unauthorized origins. Phase 2 Financial Year tests validated that multi-year budgets remain strictly partitioned and active cycles cannot be deleted. Phase 3 Jurisdiction Isolation tests confirmed that state treasury officers cannot view or modify allocations belonging to foreign states, and district collectors are strictly isolated to their assigned regional jurisdiction. Phase 4 Fund Calculation tests validated that zero overdraws occur under boundary conditions, and floating-point rounding errors are eliminated. Phase 5 Blockchain Verification tests confirmed that forged transaction hashes and receipts lacking status 1 are rejected. All 204 automated tests executed with zero failures in 60.24 seconds.")
add_p("The smart contract test suite validated role initialization, hierarchical devolution balance ceilings, milestone escrow locks, evidence hash anchoring, and emergency project freeze functionality. Revert assertions confirmed that attempting to transfer funds exceeding parent ceilings terminates immediately with appropriate error strings.")
add_p("The live contract deployment on the Ethereum Sepolia testnet was verified at contract address 0x103cdC78636491B20deadC5574755Bbd64B119c6 under deployment transaction hash 0x001429b80bd5e236806d8c902a1ec47c035040b542dc40a523ade5ac3967ddc6. Role initialization was finalized under transaction hash 0x74903381319807203deab858548127d9a354458b9f85b8dc1e2b9c9a2f81da73.")

add_h2("7.3 Explicit Statement of Unperformed Evaluations")
add_p("In accordance with strict academic integrity, this study explicitly identifies evaluations that have not yet been performed: (1) High-concurrency load testing under 100 to 1,000 simultaneous virtual users has not been conducted; (2) Formal empirical gas profiling under fluctuating mainnet gas price conditions has not been benchmarked; (3) Live fiat settlement through central bank payment switches (e.g. RBI RTGS/NEFT) remains simulated via virtual accounting ledgers; and (4) Large-scale longitudinal citizen field trials in municipal offices have not yet been executed.")

# =============================================================
# SECTION VIII
# =============================================================
add_h1("VIII. Limitations and Future Scope:")
add_p("Despite demonstrated functional success, the current system possesses several technical limitations that define clear future research avenues:")
add_p("1) Public Testnet Constraints: The contract operates on the Ethereum Sepolia testnet; mainnet deployment requires independent security audits and optimized gas subsidization models.")
add_p("2) Human Inspection Dependency: Milestone approvals currently depend on physical district inspections; no automated oracle integrates satellite synthetic aperture radar (SAR) or drone photogrammetry to verify physical earthwork progress autonomously.")
add_p("3) Administrative Contractor KYC: Contractor registration relies on administrative document review rather than decentralized Zero-Knowledge Identity proofs (zk-SNARKs).")
add_p("4) Server-Hosted File Repository: Photographic and invoice evidence files reside on an enterprise server repository rather than decentralized content-addressed networks (e.g., IPFS or Arweave).")
add_p("5) Virtual Accounting Settlement: Disbursals represent virtual escrow accounting units; integration with central bank digital currencies (CBDC) or programmable e-RUPI vouchers is required for atomic fiat settlement.")

add_h2("8.1 Future Research Roadmap")
add_p("Future research will prioritize: (1) Migrating smart contracts to an Ethereum Layer-2 optimistic or ZK-rollup (e.g. Arbitrum or Polygon zkEVM) to achieve sub-cent transaction fees; (2) Implementing Chainlink decentralized oracle networks for automated weather delay verifications; (3) Anchoring IPFS Content Identifiers (CIDs) on-chain for tamper-proof decentralized media persistence; (4) Integrating zero-knowledge KYC credentials; and (5) Executing pilot field deployments across municipal district collectorates.")

# =============================================================
# SECTION IX
# =============================================================
add_h1("IX. Conclusion:")
add_p("This paper presented the design, implementation, and empirical verification of a hybrid, multi-tier Government Fund Allocation and Tracking System Over Blockchain (PFMS 2.0). By programmatically bifurcating high-integrity financial devolution from high-volume operational media storage, the architecture resolves the long-standing trilemma between blockchain immutability, enterprise storage costs, and statutory citizen privacy. A Solidity smart contract deployed on Ethereum Sepolia enforces inviolable budget ceiling invariants across four administrative tiers alongside an emergency freeze circuit breaker and SHA-256 evidence anchoring. Concurrently, an asynchronous FastAPI gateway and indexed MongoDB datastore orchestrate role-based access control, contractor KYC vetting, and milestone-based escrow releases across structured 30%/40%/30% tranches. The universal public QR verification gateway bridges physical construction signboards directly to an unauthenticated public ledger explorer, empowering citizen watchdogs with real-time auditability. Extensive automated testing demonstrated 100% pass rates across 204 backend tests, 31 smart contract tests, and a production build of 1,705 modules. The platform establishes a practical, mathematically verifiable, and computationally scalable foundation for accountable governance and leakage-free public financial management.")

# =============================================================
# References in IJARST format
# =============================================================
add_h1("References:")

references = [
    ("1.", "Nakamoto, S., 2008. Bitcoin: A peer-to-peer electronic cash system. Decentralized Business Review. [Online]. Available: https://bitcoin.org/bitcoin.pdf"),
    ("2.", "Buterin, V., 2013. A next-generation smart contract and decentralized application platform. Ethereum White Paper, 1(1), pp. 1–36."),
    ("3.", "Wood, G., 2014. Ethereum: A secure decentralised generalised transaction ledger. Ethereum Project Yellow Paper, 151(2014), pp. 1–32."),
    ("4.", "Ølnes, S., Ubacht, J. and Janssen, M., 2017. Blockchain in government: Benefits and implications of distributed ledger technology for information sharing. Government Information Quarterly, 34(3), pp. 355–364. DOI: 10.1016/j.giq.2017.09.007."),
    ("5.", "Wüst, K. and Gervais, A., 2018. Do you need a blockchain? In Proc. 2018 Crypto Valley Conf. Blockchain Technology (CVCBT), Zug, Switzerland, pp. 45–54. DOI: 10.1109/CVCBT.2018.00011."),
    ("6.", "Atzei, N., Bartoletti, M. and Cimoli, T., 2017. A survey of attacks on Ethereum smart contracts (SoK). In Principles of Security and Trust (POST), ser. Lecture Notes in Computer Science, vol. 10204, Springer, pp. 164–186. DOI: 10.1007/978-3-662-54455-6_8."),
    ("7.", "National Institute of Standards and Technology, 2015. Secure Hash Standard (SHS). Federal Information Processing Standards Publication (FIPS PUB 180-4), Gaithersburg, MD, USA. DOI: 10.6028/NIST.FIPS.180-4."),
    ("8.", "Jones, M., Bradley, J. and Sakimura, N., 2015. JSON Web Token (JWT). Internet Engineering Task Force (IETF), RFC 7519. DOI: 10.17487/RFC7519."),
    ("9.", "Provos, N. and Mazières, D., 1999. A future-adaptable password scheme. In Proc. FREENIX Track: 1999 USENIX Annual Technical Conf., Monterey, CA, USA, pp. 81–91."),
    ("10.", "Bernstein, P. A., Hadzilacos, V. and Goodman, N., 1987. Concurrency Control and Recovery in Database Systems. Reading, MA, USA: Addison-Wesley, ISBN: 0-201-10715-5.")
]

for ref_num, ref_text in references:
    p_ref = doc.add_paragraph()
    p_ref.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_ref.paragraph_format.space_before = Pt(1.5)
    p_ref.paragraph_format.space_after = Pt(2.0)
    p_ref.paragraph_format.line_spacing = 1.01
    p_ref.paragraph_format.left_indent = Inches(0.24)
    p_ref.paragraph_format.first_line_indent = Inches(-0.24)
    r1 = p_ref.add_run(ref_num + " ")
    r1.font.name = "Times New Roman"
    r1.font.size = Pt(8.2)
    r1.bold = True
    r2 = p_ref.add_run(ref_text)
    r2.font.name = "Times New Roman"
    r2.font.size = Pt(8.2)

# Save DOCX files
doc.save(docx_path)
if os.path.exists(workspace_dir):
    ws_docx = os.path.join(workspace_dir, "Research_Paper.docx")
    doc.save(ws_docx)
print(f"Clean DOCX generated successfully ({os.path.getsize(docx_path):,} bytes).")

# Convert to PDF via Word COM Automation
print("Converting DOCX to PDF via Word COM automation...")
word = win32com.client.Dispatch("Word.Application")
word.Visible = False
word_doc = word.Documents.Open(os.path.abspath(docx_path))
page_count = word_doc.ComputeStatistics(2)
word_doc.ExportAsFixedFormat(
    OutputFileName=os.path.abspath(pdf_path),
    ExportFormat=17,
    OpenAfterExport=False,
    OptimizeFor=0, # wdExportOptimizeForPrint
    Range=0,
    BitmapMissingFonts=True
)
word_doc.Close()
word.Quit()
print(f"Exported initial PDF ({page_count} pages).")

# Post-process PDF: Re-inject ultra-high-resolution original figures
print("Injecting ultra-clarity graphics into final PDF...")
reader = pypdf.PdfReader(pdf_path)
writer = pypdf.PdfWriter()
writer.append(reader)

source_figures = [
    os.path.join(out_dir, 'fig1_admin_dashboard.png'),
    os.path.join(out_dir, 'fig2_finance_dashboard.png'),
    os.path.join(out_dir, 'fig3_central_to_state_transfer.png'),
    os.path.join(out_dir, 'fig4_state_to_district_transfer.png'),
    os.path.join(out_dir, 'fig5_public_transparency_portal.png'),
]

src_info = []
for s_path in source_figures:
    if os.path.exists(s_path):
        im = Image.open(s_path)
        src_info.append({
            'path': s_path,
            'name': os.path.basename(s_path),
            'width': im.width,
            'height': im.height,
            'ratio': round(im.width / im.height, 3)
        })

injected_count = 0
for page_idx, page in enumerate(writer.pages):
    xobj = page.get('/Resources', {}).get('/XObject', {})
    if not xobj:
        continue
    xobj = xobj.get_object()
    for img_key in list(xobj.keys()):
        obj = xobj[img_key].get_object()
        if obj.get('/Subtype') == '/Image':
            w = obj.get('/Width')
            h = obj.get('/Height')
            obj_ratio = round(w / h, 3)
            match = None
            for s in src_info:
                if abs(s['ratio'] - obj_ratio) < 0.03:
                    match = s
                    break
            if match:
                im = Image.open(match['path']).convert('RGB')
                buf = io.BytesIO()
                im.save(buf, format='JPEG', quality=100, subsampling=0)
                data = buf.getvalue()
                
                obj._data = data
                obj[pypdf.generic.NameObject('/Width')] = pypdf.generic.NumberObject(im.width)
                obj[pypdf.generic.NameObject('/Height')] = pypdf.generic.NumberObject(im.height)
                print(f"Injected high-res figure into Page {page_idx+1} from {match['name']}")
                injected_count += 1

with open(pdf_path, 'wb') as f:
    writer.write(f)

if os.path.exists(workspace_dir):
    shutil.copyfile(pdf_path, os.path.join(workspace_dir, "Research_Paper.pdf"))

print(f"Final Research_Paper.pdf generated successfully ({os.path.getsize(pdf_path):,} bytes, Pages: {len(writer.pages)}).")

import os
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable, Image as RLImage
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

PDF_FILE = "VIVA_QUESTIONS_AND_NOTES.pdf"
HTML_FILE = "VIVA_QUESTIONS_AND_NOTES.html"
MD_FILE = "VIVA_QUESTIONS_AND_NOTES.md"

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont('Helvetica', 8)
        self.setFillColor(colors.HexColor('#64748b'))
        
        # Draw running header on pages > 1
        if self._pageNumber > 1:
            self.drawString(54, 842 - 36, "MeshPay (upiSETU) — Viva Voce Examination & Technical Defense Guide")
            self.drawRightString(595 - 54, 842 - 36, "DSEU Okhla-II Campus | Batch VII Sem")
            self.setStrokeColor(colors.HexColor('#cbd5e1'))
            self.setLineWidth(0.5)
            self.line(54, 842 - 42, 595 - 54, 842 - 42)
        
        # Draw running footer
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(595 - 54, 32, page_text)
        self.drawString(54, 32, "Confidential — Prepared for B.Tech Minor Project Examination (Nov 2026)")
        self.setStrokeColor(colors.HexColor('#cbd5e1'))
        self.setLineWidth(0.5)
        self.line(54, 42, 595 - 54, 42)
        
        self.restoreState()

def build_pdf():
    print("Generating publication-grade PDF: " + PDF_FILE)
    
    # 54pt = 0.75 in margins
    doc = SimpleDocTemplate(
        PDF_FILE,
        pagesize=A4,
        leftMargin=48,
        rightMargin=48,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        alignment=1, # Center
        textColor=colors.HexColor('#0f172a'),
        spaceAfter=6
    )

    sub_style = ParagraphStyle(
        'DocSub',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=11,
        leading=15,
        alignment=1,
        textColor=colors.HexColor('#334155'),
        spaceAfter=14
    )

    h1_style = ParagraphStyle(
        'H1',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=colors.HexColor('#1e3a8a'),
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'H2',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=colors.HexColor('#0f172a'),
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        alignment=4, # Justified
        textColor=colors.HexColor('#1e293b'),
        spaceAfter=4
    )

    q_style = ParagraphStyle(
        'QStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=13.5,
        textColor=colors.HexColor('#1e3a8a')
    )

    a_style = ParagraphStyle(
        'AStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#0f172a')
    )

    meta_style = ParagraphStyle(
        'MetaStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#0369a1')
    )

    story = []

    # Title & Header
    if os.path.exists("dseu_logo.png"):
        story.append(RLImage("dseu_logo.png", width=1.1*inch, height=1.24*inch))
        story.append(Spacer(1, 8))

    story.append(Paragraph("MESHPAY (upiSETU): VIVA VOCE EXAMINATION & TECHNICAL DEFENSE HANDBOOK", title_style))
    story.append(Paragraph("Comprehensive Project Notes, Architectural Concepts, Examiner Questions & Model Answers", sub_style))

    # Meta Table (Team & Faculty)
    meta_data = [
        [
            Paragraph("<b>PROJECT:</b> MeshPay (upiSETU)<br/><b>DEGREE:</b> B.Tech CSE (Batch: VIIth Sem)", meta_style),
            Paragraph("<b>TEAM MEMBERS:</b><br/>1. Sourav Thakur (41523099)<br/>2. Sushant Sunder (41523103)<br/>3. Rajat Trehan (41523078)", meta_style),
            Paragraph("<b>MENTOR:</b> Ms. Meenu Munjal<br/><b>CAMPUS:</b> DSEU Okhla-II Campus<br/><b>DATE:</b> November 2026", meta_style)
        ]
    ]
    t_meta = Table(meta_data, colWidths=[160, 180, 150])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f0f7ff')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#93c5fd')),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 14))

    # 1. Executive Summary & 2-Minute Elevator Pitch
    story.append(Paragraph("1. EXECUTIVE SUMMARY & 2-MINUTE ELEVATOR PITCH", h1_style))
    pitch_text = (
        "<b>Examiner Prompt:</b> <i>'Can you explain what your project is, what problem it solves, and how it works in 2 minutes?'</i><br/><br/>"
        "<b>Model Answer (Spoken by any team member):</b><br/>"
        "\"Good morning, respected external examiners and faculty members. Our project is <b>MeshPay (upiSETU)</b>, "
        "an offline-first, peer-to-peer payment architecture and store-carry-forward routing engine designed for zero-connectivity "
        "environments—such as subterranean metro corridors, deep basements, disaster-affected regions, and rural blind-spots where conventional UPI fails.<br/><br/>"
        "Traditional UPI requires synchronous client-to-server cellular (4G/5G) connectivity. If a citizen is in a Delhi Metro basement, "
        "their payment immediately aborts with gateway unreachable exceptions. MeshPay decouples <b>offline transaction signing</b> from <b>deferred bank settlement</b> "
        "using Delay-Tolerant Networking (RFC 4838):<br/>"
        "• <b>Step 1 (Client Enclave):</b> The payer's smartphone seals an envelope locally using W3C Web Crypto hybrid encryption (RSA-2048-OAEP encapsulating an ephemeral AES-256-GCM session key). The UPI PIN is hashed via salted SHA-256 with zero plaintext exposure.<br/>"
        "• <b>Step 2 (Store-Carry-Forward Mesh):</b> The packet gossips across nearby peer smartphones via Bluetooth Low Energy (BLE). Intermediate relays have zero knowledge of payment amounts or recipient accounts and cannot tamper with ciphertext.<br/>"
        "• <b>Step 3 (Bridge Upload & Settlement):</b> When any device exits the tunnel and gets 4G connectivity (acting as an autonomous Bridge Node), it uploads accumulated envelopes to the Central Bank. The bank enforces a <b>dual-tier idempotency defense</b> (in-memory SHA-256 cache + relational database unique constraint) to prevent double-spending and bridge race conditions before executing atomic ACID ledger debits and credits.<br/><br/>"
        "Our system has been verified with <b>23 automated tests (100% pass rate)</b>, sub-30ms settlement latency, persistent RSA keys that survive server reboots, and an interactive React simulation with audio Soundbox chimes.\""
    )
    
    t_pitch = Table([[Paragraph(pitch_text, body_style)]], colWidths=[495])
    t_pitch.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#cbd5e1')),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(t_pitch)
    story.append(Spacer(1, 14))

    # 2. Master Topic Catalog
    story.append(Paragraph("2. MASTER ARCHITECTURAL TOPICS CATALOG", h1_style))
    story.append(Paragraph("Every member of the panel will examine candidates across these 8 core architectural pillars:", body_style))
    
    topics = [
        ("Topic 1: Delay-Tolerant Networking (DTN)", "Store-Carry-Forward routing paradigm formalized in IETF RFC 4838. Replaces continuous end-to-end paths with opportunistic hop-by-hop transmission across intermittently connected mobile nodes."),
        ("Topic 2: Hybrid Envelope Cryptography", "Dual-envelope construction: 2048-bit RSA-OAEP (MGF1 with SHA-256) wrapping an ephemeral 256-bit AES-GCM symmetric session key. Provides confidentiality, authenticity, and AEAD tamper-proofing."),
        ("Topic 3: Zero-Plaintext PIN Enclave", "Client-side W3C Web Crypto derivation of salted SHA-256 PIN digest on-device. Raw PINs never enter RAM, persistent flash storage, or wire packets, satisfying NPCI security standards."),
        ("Topic 4: Controlled Epidemic Gossip", "Bounded flooding protocol where intermediate nodes exchange summary vectors. Enforces integer TTL decrement (TTL=10) and max hop limits to prevent packet loops and buffer exhaustion."),
        ("Topic 5: Dual-Tier Idempotency Defense", "Tier 1: Microsecond in-memory SHA-256 wire-hash cache to drop duplicate packets. Tier 2: Relational database unique constraint on (senderVpa, nonce) preventing concurrent bridge race conditions."),
        ("Topic 6: ACID Ledger Settlement", "Java 21 / Spring Boot 3.3.5 settlement engine backed by embedded H2 file database. Utilizes JPA @Version optimistic locking to eliminate lost-update concurrency anomalies."),
        ("Topic 7: Keypair Disk Persistence", "ServerKeyHolder service serializing 2048-bit RSA public/private keys to disk (./data/keys/server_private.der). Guarantees key survivability across server reboots, resolving defect DEF-01."),
        ("Topic 8: RBI & NPCI Regulatory Bounds", "Hard compliance with RBI Circular DPSS.CO.PD.No.S-526/02-14-003/2021-22: strictly rejects transactions exceeding ₹500.00 and tracks ₹2,000.00 cumulative offline wallet balances.")
    ]
    t_top_data = [[Paragraph(f"<b>{t[0]}</b>", q_style), Paragraph(t[1], a_style)] for t in topics]
    t_top = Table(t_top_data, colWidths=[165, 330])
    t_top.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#ffffff')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_top)
    story.append(Spacer(1, 14))

    # Helper function to render Q&A block
    def add_qa_box(q_num, q_text, candidate_name, a_text):
        content = [
            Paragraph(f"<b>Q{q_num}: {q_text}</b>", q_style),
            Paragraph(f"<font color='#0369a1'><b>Assigned Candidate:</b> {candidate_name}</font>", meta_style),
            Spacer(1, 4),
            Paragraph(a_text, a_style)
        ]
        t = Table([[content]], colWidths=[495])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#ffffff')),
            ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#cbd5e1')),
            ('LINELEFT', (0,0), (-1,-1), 3.5, colors.HexColor('#1e3a8a')),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            ('LEFTPADDING', (0,0), (-1,-1), 8),
            ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ]))
        return t

    # 3. Questions for Sourav Thakur
    story.append(Paragraph("3. EXAMINER QUESTIONS FOR SOURAV THAKUR (41523099)", h1_style))
    story.append(Paragraph("<b>Primary Domain:</b> Backend Architecture, Cryptography, Database & Concurrency, Key Persistence", body_style))
    story.append(Spacer(1, 4))

    q1_ans = (
        "<b>Model Answer:</b> When an encrypted packet arrives at <code>POST /api/v1/settle</code>, the backend executes a 5-stage pipeline:<br/>"
        "1. <b>Wire-Hash De-duplication:</b> It computes SHA-256 over raw wire bytes. If present in <code>inMemoryWireCache</code>, it returns the cached settlement response in under 0.5 ms.<br/>"
        "2. <b>Asymmetric Unwrapping:</b> It invokes <code>CryptoEnvelopeService</code>, using our persistent RSA-2048 private key to decrypt the ephemeral AES key via RSA-OAEP with SHA-256 and MGF1 padding.<br/>"
        "3. <b>Symmetric Authenticated Decryption:</b> It uses the decrypted 256-bit AES key to decrypt the payload with AES-256-GCM using the 96-bit IV and 128-bit authentication tag. If even 1 bit was altered, GCM tag verification throws a <code>SecurityException</code>.<br/>"
        "4. <b>Relational Idempotency Check:</b> Within a <code>READ_COMMITTED</code> SQL transaction, it checks <code>IdempotencyKeyRepository.existsBySenderVpaAndNonce()</code>. If found, the transaction rolls back cleanly.<br/>"
        "5. <b>ACID Ledger Settlement:</b> It acquires the sender account with optimistic locking (<code>@Version</code>), verifies balance >= amount, debits sender, credits payee, logs the transaction, saves the idempotency record, and commits atomically."
    )
    story.append(add_qa_box(1, "Can you explain the exact cryptographic and settlement flow when an envelope arrives at your backend?", "Sourav Thakur (41523099)", q1_ans))
    story.append(Spacer(1, 8))

    q2_ans = (
        "<b>Model Answer:</b> Hybrid cryptography gives us the best of both worlds:<br/>"
        "• <b>Why not pure RSA?</b> RSA is computationally intensive and mathematically cannot encrypt data larger than its key size minus padding (a 2048-bit RSA key can only encrypt up to 190 bytes under OAEP-SHA256). Our JSON payment instruction is ~350 bytes, which exceeds pure RSA limits.<br/>"
        "• <b>Why not pure AES?</b> Pure AES requires a pre-shared secret key. In an ad-hoc mesh where millions of strangers meet in a metro tunnel, sender phones cannot share a symmetric key with the central bank in advance without exposing it to intermediate sniffers.<br/>"
        "• <b>The Hybrid Solution:</b> The client generates a fresh ephemeral 256-bit AES key, encrypts the arbitrary-length payment instruction under AES-GCM (which takes ~1ms), and encrypts only that 32-byte key under the Bank's RSA public key. Only the bank can decrypt the session key, and intermediate relays observe only opaque ciphertext."
    )
    story.append(add_qa_box(2, "Why did you choose hybrid RSA-2048-OAEP + AES-256-GCM rather than pure RSA or pure AES?", "Sourav Thakur (41523099)", q2_ans))
    story.append(Spacer(1, 8))

    q3_ans = (
        "<b>Model Answer:</b> A single-tier cache fails under two real-world failure modes:<br/>"
        "• <b>Failure Mode 1 (Memory Loss on Restart):</b> An in-memory cache is lost if the server process restarts. If a bridge retries a gossiped packet after restart, a memory-only cache would re-execute the payment, double-debiting the sender.<br/>"
        "• <b>Failure Mode 2 (Concurrent Bridge Race Conditions):</b> When two bridge devices exit a tunnel and hit 4G simultaneously, both submit identical packets in parallel threads. Two threads can check an in-memory cache at the exact same microsecond before either has written to it.<br/>"
        "• <b>Our Solution:</b> Tier 1 (In-Memory ConcurrentHashMap) filters 99% of retransmissions in 0.28ms without hitting the disk. Tier 2 (Relational Database Unique Constraint on <code>(sender_vpa, nonce)</code>) guarantees ACID isolation: the second thread triggers a SQL <code>DataIntegrityViolationException</code> and rolls back cleanly with zero double-debit."
    )
    story.append(add_qa_box(3, "How does your Dual-Tier Idempotency defense work, and why wasn't an in-memory cache enough?", "Sourav Thakur (41523099)", q3_ans))
    story.append(Spacer(1, 8))

    q4_ans = (
        "<b>Model Answer:</b> During Sprint 3, whenever we restarted the Spring Boot backend (`mvn spring-boot:run`), `KeyPairGenerator` generated a fresh in-memory RSA keypair. Any offline envelopes created on smartphones prior to the reboot failed to decrypt because the private key had vanished.<br/>"
        "We diagnosed this as <b>Defect DEF-01</b> and engineered <code>ServerKeyHolder.java</code>: on startup, it checks <code>./data/keys/server_private.der</code> and <code>server_public.der</code>. If they exist, it reconstructs the identical <code>PKCS8EncodedKeySpec</code> and <code>X509EncodedKeySpec</code>. If missing, it generates a keypair once and serializes the raw ASN.1 DER bytes to disk. This guarantees multi-year cryptographic continuity across reboots."
    )
    story.append(add_qa_box(4, "What happened when the server restarted during development, and how did you fix key loss (DEF-01)?", "Sourav Thakur (41523099)", q4_ans))
    story.append(Spacer(1, 14))

    # 4. Questions for Sushant Sunder
    story.append(Paragraph("4. EXAMINER QUESTIONS FOR SUSHANT SUNDER (41523103)", h1_style))
    story.append(Paragraph("<b>Primary Domain:</b> Delay-Tolerant Mesh Routing, Epidemic Gossip Protocol, Hop/TTL Bounding, Detour Routing", body_style))
    story.append(Spacer(1, 4))

    q5_ans = (
        "<b>Model Answer:</b> Traditional TCP/IP requires a continuous, synchronized end-to-end path: a packet moves from router to router along a live electrical circuit or radio wave within milliseconds. If any intermediate link drops, TCP aborts with connection timeouts.<br/>"
        "<b>Delay-Tolerant Networking (RFC 4838)</b> operates on the <b>Store-Carry-Forward</b> paradigm: intermediate nodes accept encrypted packets, store them in persistent local buffers (IndexedDB on phones), carry them as citizens walk through physical corridors, and forward them whenever a new peer enters radio range (10–30m over Bluetooth LE). Communication occurs asynchronously over minutes or hours until reaching a bridge."
    )
    story.append(add_qa_box(5, "What is Delay-Tolerant Networking (DTN) and how does Store-Carry-Forward differ from TCP/IP?", "Sushant Sunder (41523103)", q5_ans))
    story.append(Spacer(1, 8))

    q6_ans = (
        "<b>Model Answer:</b> Pure epidemic routing replicates packets to every discovered peer, which in a dense metro station would quickly cause radio collision storms and flash memory exhaustion. We engineered three bounded mechanisms:<br/>"
        "1. <b>Integer Hop/TTL Decrement:</b> Packets are initialized with $TTL = 10$ and $Hops = 0$. Every relay decrements TTL by 1 and increments Hop count by 1. When $TTL &le; 0$, the packet is permanently purged from memory.<br/>"
        "2. <b>Ring-Buffer Hash De-duplication:</b> Each device maintains a 500-element ring buffer of SHA-256 hashes of seen packets. If Carol already holds packet $P_1$, she rejects Dave's gossip offer in the initial handshake.<br/>"
        "3. <b>Opportunistic Bridge Prioritization:</b> Nodes prioritize forwarding toward peers flagged with high mobility or bridge capability."
    )
    story.append(add_qa_box(6, "How does your epidemic gossip protocol prevent infinite message loops and buffer exhaustion?", "Sushant Sunder (41523103)", q6_ans))
    story.append(Spacer(1, 8))

    q7_ans = (
        "<b>Model Answer:</b> Intermediate relays cannot read anything sensitive. The payment payload is encrypted under AES-256-GCM, and the symmetric key is wrapped under the Bank's 2048-bit RSA public key. An intermediate relay (or a hacker with a Bluetooth sniffer) only sees:<br/>"
        "• A Base64 string of encrypted key<br/>"
        "• A Base64 string of ciphertext<br/>"
        "• A 12-byte IV and 16-byte authentication tag<br/>"
        "They cannot inspect whether the payment is for ₹10 or ₹500, who the recipient is, or what the PIN is. Furthermore, because of AES-GCM AEAD, if a relay tampers with a single bit, the bank rejects it immediately."
    )
    story.append(add_qa_box(7, "Can intermediate relay phones inspect the transaction amount or steal the user's PIN?", "Sushant Sunder (41523103)", q7_ans))
    story.append(Spacer(1, 8))

    q8_ans = (
        "<b>Model Answer:</b> In <code>meshSimulation.js</code>, the network topology is represented as an adjacency graph. If a primary connection breaks (e.g., node Carol turns off Bluetooth or moves away), our detour routing algorithm evaluates alternate neighbor nodes in the discovered peer list. The packet is routed through alternate relays (e.g., via Dave or an opportunistic stranger node) until reaching Eve Bridge, demonstrating dynamic network survivability."
    )
    story.append(add_qa_box(8, "What happens if a primary link in the mesh breaks? How does detour rerouting work?", "Sushant Sunder (41523103)", q8_ans))
    story.append(Spacer(1, 14))

    # 5. Questions for Rajat Trehan
    story.append(Paragraph("5. EXAMINER QUESTIONS FOR RAJAT TREHAN (41523078)", h1_style))
    story.append(Paragraph("<b>Primary Domain:</b> Frontend Engineering, Simulation Theater, 4G Water Pipe Visualizer, Soundbox, Viva Lab", body_style))
    story.append(Spacer(1, 4))

    q9_ans = (
        "<b>Model Answer:</b> Standard fintech dashboards display static cards, which fail to communicate the physical reality of an underground disaster or cellular blackout. We created the <b>Metro Tunnel Disaster Theater</b> (Depth: -42.5m, flickering industrial lamps, 0-bar 'NO SERVICE' phone mockup, and expanding 2.4 GHz circular BLE radio waves).<br/>"
        "This immediately demonstrates to evaluators that the payer's smartphone is in total radio isolation. When the user clicks 'Inject into Mesh', the W3C Web Crypto enclave executes in the browser, showing how real cryptography functions on client devices."
    )
    story.append(add_qa_box(9, "Why did you build the Metro Tunnel Disaster Theater rather than a standard dashboard?", "Rajat Trehan (41523078)", q9_ans))
    story.append(Spacer(1, 8))

    q10_ans = (
        "<b>Model Answer:</b> In <code>offlineCrypto.js</code>, when the user inputs their 4-digit PIN on the simulated mobile keypad, we immediately derive:<br/>"
        "<code>pinHash = SHA-256(pin + \":\" + senderVpa)</code><br/>"
        "The cleartext PIN variable is immediately discarded from memory. Only the cryptographic hash is placed into the JSON instruction payload before AES-GCM encryption. Even if an attacker attaches a memory debugger to the device after transmission, the cleartext PIN cannot be recovered."
    )
    story.append(add_qa_box(10, "How do you ensure the user's PIN is never exposed in plaintext in browser memory or storage?", "Rajat Trehan (41523078)", q10_ans))
    story.append(Spacer(1, 8))

    q11_ans = (
        "<b>Model Answer:</b> The 4G industrial water-pipe animation visually represents the transition from the asynchronous, delay-tolerant offline mesh into the high-bandwidth, synchronous central banking backhaul. When Eve Bridge reaches the surface, the pipeline pressurizes and liquid flows into the Central Bank core, triggering real-time ACID settlement.<br/>"
        "Simultaneously, our synthetic Soundbox engine synthesizes multi-lingual audio chimes (Hindi and English) announcing: <i>'MeshPay par ₹500 prapt hue'</i>, replicating Paytm/PhonePe commercial soundbox behavior for merchant accessibility."
    )
    story.append(add_qa_box(11, "What is the role of the 4G Water Pipe animation and Soundbox Voice synthesis?", "Rajat Trehan (41523078)", q11_ans))
    story.append(Spacer(1, 8))

    q12_ans = (
        "<b>Model Answer:</b> Our 6-part lab provides live empirical proof of security invariants:<br/>"
        "• <b>LAB-01 (Replay Attack):</b> Resubmits a valid packet; backend detects duplicate nonce and returns <code>DUPLICATE</code>.<br/>"
        "• <b>LAB-02 (Ciphertext Tamper):</b> Flips 2 bits in AES ciphertext; GCM tag verification fails with <code>SecurityException</code>.<br/>"
        "• <b>LAB-03 (TTL Expiry):</b> Injects packet with $TTL=0$; router drops packet immediately.<br/>"
        "• <b>LAB-04 (Double Spend):</b> Spends ₹400 twice with ₹500 balance; second packet fails with <code>INSUFFICIENT_FUNDS</code>.<br/>"
        "• <b>LAB-05 (Server Reboot Key Persistence):</b> Reboots server; private key reloads from disk and decrypts in-flight packets.<br/>"
        "• <b>LAB-06 (Concurrent Race Condition):</b> 10 threads submit identical packets; exactly 1 settles, 9 are flagged duplicate."
    )
    story.append(add_qa_box(12, "Can you walk through the 6 experiments in the Cybersecurity Viva Defense Lab?", "Rajat Trehan (41523078)", q12_ans))
    story.append(Spacer(1, 14))

    # 6. Tough Grill & Trap Questions
    story.append(Paragraph("6. TOUGH 'GRILL' & TRAP QUESTIONS EVERY EXAMINER ASKS", h1_style))
    story.append(Paragraph("These are challenging theoretical and operational questions external examiners use to test deep understanding:", body_style))
    story.append(Spacer(1, 4))

    q13_ans = (
        "<b>Examiner Trap:</b> <i>'If neither the payer nor payee is connected to the bank, how can you guarantee the payer hasn't spent that ₹500 with another merchant 5 minutes ago?'</i><br/><br/>"
        "<b>Authoritative Answer:</b> In a disconnected network, absolute real-time global consensus without communication is mathematically impossible (Fischer-Lynch-Paterson Theorem). MeshPay handles this through a <b>hybrid economic and cryptographic risk model</b> aligned with RBI guidelines:<br/>"
        "1. <b>Bounded Transaction Exposure:</b> In accordance with RBI Circular DPSS.CO.PD.No.S-526/02-14-003/2021-22, offline transactions are strictly capped at ₹500 per transaction and ₹2,000 cumulative balance. An attacker cannot cause systemic bank collapse.<br/>"
        "2. <b>Sequential Bank Clearing:</b> The Central Bank processes envelopes in order of arrival. The first merchant's envelope to reach a bridge consumes the ₹500 balance. The second packet is marked <code>FAILED (INSUFFICIENT_FUNDS)</code>.<br/>"
        "3. <b>Future Hardware Enclave (eSE):</b> In our future scope (Section 6.3), we document how smartphone hardware Secure Elements (eSE) can enforce monotonic on-device sequence counters, cryptographically preventing a second packet from ever being signed offline."
    )
    story.append(add_qa_box(13, "How do you mathematically prevent double-spending in a completely disconnected mesh?", "All Candidates", q13_ans))
    story.append(Spacer(1, 8))

    q14_ans = (
        "<b>Examiner Question:</b> <i>'Why can't we just use USSD (*99#) or UPI 123PAY instead of building a mesh?'</i><br/><br/>"
        "<b>Authoritative Answer:</b><br/>"
        "• <b>USSD (*99#)</b> uses GSM 2G voice signaling. It still requires a connection to a cellular cell tower. In underground subway tunnels or deep concrete basements, there is <b>zero GSM signal</b>, so USSD returns 'Network Error'. Furthermore, USSD suffers from >35% transaction failure rates and high carrier session costs.<br/>"
        "• <b>UPI 123PAY</b> relies on IVR voice calls or ultrasonic sound waves. IVR requires live telecom voice coverage, which fails underground. Ultrasonic proximity sound waves only work point-to-point over 10 centimeters and cannot gossip packets across a 500-meter transit platform to reach an exit bridge.<br/>"
        "• <b>MeshPay</b> requires <b>zero cellular infrastructure</b> at the payment location. It leverages the ambient Bluetooth LE radios of passing citizens to carry packets to the nearest exit."
    )
    story.append(add_qa_box(14, "Why not use existing USSD (*99#) or UPI 123PAY instead of MeshPay?", "All Candidates", q14_ans))
    story.append(Spacer(1, 14))

    # 7. Live Demo Cheat Sheet
    story.append(Paragraph("7. 5-MINUTE LIVE DEMONSTRATION SCRIPT (STEP-BY-STEP)", h1_style))
    demo_steps = [
        ("Minute 1: Setup & Scene", "Open http://localhost:8080/ in browser. Point out the Metro Disaster Theater (Depth: -42.5m, 0-bar 'No Service'). Explain that Alice is underground with Bob and has no internet."),
        ("Minute 2: Step 1 (Compose)", "Select Alice (₹5,000 balance), Bob (Merchant), enter ₹500, enter PIN 1234. Click 'Inject into Mesh'. Show the W3C Web Crypto envelope creation and Alice's device queue holding 1 packet."),
        ("Minute 3: Step 2 (Gossip)", "Click 'Run Gossip Round' (or 'Auto-Step to Bridge'). Point to the living topology: packet hops from Alice → Carol → Dave → Eve Bridge. Show live speech bubbles passing gossip between devices."),
        ("Minute 4: Step 3 (Sync)", "Point to Eve Bridge (which has 4G). Click 'Bridges Upload to Backend'. Watch the industrial 4G water pipe flow liquid into Central Bank. Listen to the Soundbox voice chime in Hindi/English."),
        ("Minute 5: Verification & Lab", "Show Alice's balance debited to ₹4,500 and Bob credited to ₹1,500 in the ACID ledger. Click 'Test Replay Attack' to show instant DUPLICATE rejection without ledger mutation. Open test report showing 23 passed tests.")
    ]
    t_demo_data = [[Paragraph(f"<b>{d[0]}</b>", q_style), Paragraph(d[1], a_style)] for d in demo_steps]
    t_demo = Table(t_demo_data, colWidths=[140, 355])
    t_demo.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_demo)
    story.append(Spacer(1, 14))

    # Build PDF with NumberedCanvas
    doc.build(story, canvasmaker=NumberedCanvas)
    print("SUCCESS: PDF generated at " + PDF_FILE + f" (Size: {os.path.getsize(PDF_FILE)} bytes)")

def build_html_and_md():
    print("Generating HTML & Markdown defense guides...")
    # Read generated PDF size or write rich HTML/MD equivalents
    # Writing Markdown version
    md_content = """# MESHPAY (upiSETU): VIVA VOCE EXAMINATION & TECHNICAL DEFENSE HANDBOOK
**Bachelor of Technology in Computer Science and Engineering (Batch: VIIth Semester)**  
**Delhi Skill and Entrepreneurship University (DSEU), Okhla-II Campus, New Delhi**  

---

### Team & Faculty Details
- **Sourav Thakur (Roll No. 41523099)** — Project Lead, Backend Architecture, Cryptography & Database Systems
- **Sushant Sunder (Roll No. 41523103)** — Delay-Tolerant Mesh Routing, Epidemic Gossip Protocol & Detour Engine
- **Rajat Trehan (Roll No. 41523078)** — Frontend Engineering, Metro Disaster Theater, 4G Water Pipe & Cyber Lab
- **Project Mentor:** **Ms. Meenu Munjal**, Assistant Professor, Department of CSE, DSEU Okhla-II Campus

---

## 1. Executive Summary & 2-Minute Elevator Pitch

> **Examiner Prompt:** *"Can you explain what your project is, what problem it solves, and how it works in 2 minutes?"*

**Model Answer:**  
"Good morning, respected external examiners and faculty members. Our project is **MeshPay (upiSETU)**, an offline-first peer-to-peer payment architecture and store-carry-forward routing engine designed for zero-connectivity environments—such as subterranean metro corridors, deep basements, disaster-affected regions, and rural blind-spots where conventional UPI fails.

Traditional UPI requires synchronous client-to-server cellular (4G/5G) connectivity. In an underground metro station, transactions abort due to socket timeouts. MeshPay decouples **offline transaction signing** from **deferred bank settlement** using Delay-Tolerant Networking (RFC 4838):
1. **Client Enclave:** Payer smartphone seals an envelope locally using W3C Web Crypto hybrid encryption (RSA-2048-OAEP encapsulating an ephemeral AES-256-GCM session key). The UPI PIN is hashed via salted SHA-256 with zero plaintext exposure.
2. **Store-Carry-Forward Mesh:** The packet gossips across nearby peer smartphones via Bluetooth Low Energy (BLE). Intermediate relays have zero knowledge of payment amounts or recipient accounts and cannot tamper with ciphertext.
3. **Bridge Upload & Settlement:** When any device exits the tunnel and gets 4G connectivity (acting as an autonomous Bridge Node), it uploads accumulated envelopes to the Central Bank. The bank enforces a **dual-tier idempotency defense** (in-memory SHA-256 cache + relational database unique constraint) to prevent double-spending and bridge race conditions before executing atomic ACID ledger debits and credits.

Our system is verified with **23 automated tests (100% pass rate)**, sub-30ms settlement latency, persistent RSA keys that survive server reboots, and an interactive React simulation with audio Soundbox chimes."

---

## 2. Topic-by-Topic Master Checklist
- **Topic 1: Delay-Tolerant Networking (DTN)** — Store-Carry-Forward routing paradigm (IETF RFC 4838).
- **Topic 2: Hybrid Cryptography** — RSA-2048-OAEP wrapping ephemeral AES-256-GCM symmetric session keys.
- **Topic 3: Zero-Plaintext PIN Enclave** — Client-side salted SHA-256 PIN hashing; raw PINs never enter storage or wire.
- **Topic 4: Controlled Epidemic Gossip** — Bounded message replication with integer TTL decrements (TTL=10) and hop limits.
- **Topic 5: Dual-Tier Idempotency Defense** — Tier 1 in-memory SHA-256 cache + Tier 2 database unique constraint on (senderVpa, nonce).
- **Topic 6: ACID Ledger Settlement** — Spring Boot 3.3.5 + H2 file database with JPA `@Version` optimistic locking.
- **Topic 7: Keypair Disk Persistence** — `ServerKeyHolder.java` serializing DER keys to `./data/keys/` surviving reboots (DEF-01).
- **Topic 8: Regulatory Compliance** — RBI Circular DPSS.CO.PD.No.S-526/02-14-003/2021-22 limits (₹500 / ₹2,000).

---

## 3. Role-Specific Questions & Answers

### A. For SOURAV THAKUR (41523099) — Backend & Cryptography
- **Q1: Can you explain the exact cryptographic and settlement flow when an envelope arrives at your backend?**  
  *Answer:* 1. Wire-hash deduplication (<0.5ms lookup). 2. Asymmetric RSA-OAEP private decryption of AES key. 3. AES-256-GCM unsealing with IV and 128-bit tag verification. 4. Relational uniqueness check on `(senderVpa, nonce)`. 5. ACID balance validation, debit/credit execution, and idempotency key commit.
- **Q2: Why hybrid RSA-2048 + AES-GCM instead of pure RSA?**  
  *Answer:* RSA-2048 can only encrypt up to 190 bytes under OAEP padding. Our payment JSON is ~350 bytes. Pure AES requires pre-shared keys which strangers cannot have in an ad-hoc mesh. Hybrid encryption solves both.
- **Q3: How does Dual-Tier Idempotency handle bridge race conditions?**  
  *Answer:* Tier 1 in-memory cache drops 99% of retransmissions in 0.28ms. If two bridges upload simultaneously, the database unique constraint on `(senderVpa, nonce)` forces the second thread to rollback via `DataIntegrityViolationException`.
- **Q4: How did you fix the server reboot key loss defect (DEF-01)?**  
  *Answer:* Engineered `ServerKeyHolder.java` to serialize keys to `./data/keys/server_private.der`. Startup checks for existing files before generating new ones.

### B. For SUSHANT SUNDER (41523103) — Delay-Tolerant Mesh Routing
- **Q5: What is Delay-Tolerant Networking (DTN) and how does it differ from TCP/IP?**  
  *Answer:* TCP/IP requires continuous end-to-end synchronized circuits. DTN uses Store-Carry-Forward (RFC 4838): intermediate nodes buffer messages in flash storage and carry them physically across space until encountering peers.
- **Q6: How do you prevent message storms in epidemic gossip?**  
  *Answer:* 1. Bounded TTL integer decrement (TTL=10). 2. Ring buffer of 500 seen packet SHA-256 hashes. 3. Summary vector exchange in discovery handshakes.
- **Q7: Can intermediate relays snoop on payment amounts or steal PINs?**  
  *Answer:* No. Relays only observe opaque Base64 ciphertexts. The AES session key is sealed under the Bank's RSA public key, so only the bank can read transaction parameters.

### C. For RAJAT TREHAN (41523078) — Frontend & Motion Simulation
- **Q8: Why build the Metro Tunnel Disaster Theater rather than a standard dashboard?**  
  *Answer:* Conveys the physical reality of an underground radio dead zone (Depth: -42.5m, 0-bar No Service) and demonstrates client-side Web Crypto execution in the browser.
- **Q9: How do you ensure the PIN is never exposed in plaintext?**  
  *Answer:* Keypad input triggers immediate `SHA-256(pin + ":" + senderVpa)`. Raw PIN is wiped from memory; only the salted hash is encrypted into the envelope.
- **Q10: What do the 6 experiments in the Cybersecurity Viva Lab prove?**  
  *Answer:* LAB-01: Replay attack rejection. LAB-02: Bit-flip tampering detection. LAB-03: Expired TTL eviction. LAB-04: Double-spending prevention. LAB-05: Cold reboot key recovery. LAB-06: Multi-bridge race condition suppression.

---

## 4. Tough "Grill" Questions Every Examiner Asks
- **Q11: How do you mathematically prevent double-spending without a live connection?**  
  *Answer:* Acknowledging FLP impossibility theorem, we enforce a hybrid model: RBI ₹500/₹2,000 regulatory exposure bounds, sequential bank clearing (first envelope consumes balance, second rejected), and future hardware Secure Element (eSE) monotonic sequence counters.
- **Q12: Why not just use USSD (*99#) or UPI 123PAY?**  
  *Answer:* USSD requires GSM 2G voice signaling; UPI 123PAY requires telecom voice coverage. In subterranean transit tunnels, there is zero signal for either. MeshPay requires zero telecom infrastructure at the point of transaction.

---

## 5. Live Demonstration 5-Minute Script
1. **Minute 1:** Show Metro Tunnel theater (-42.5m depth, 0-bar No Service).
2. **Minute 2:** Alice composes ₹500 payment to Bob, inputs PIN 1234, clicks 'Inject into Mesh' (local Web Crypto envelope sealing).
3. **Minute 3:** Click 'Run Gossip Round' — observe packet hop Alice → Carol → Dave → Eve Bridge with live speech bubbles.
4. **Minute 4:** Click 'Bridges Upload to Backend' — observe 4G water pipe flow liquid into Central Bank; listen to Soundbox audio chime.
5. **Minute 5:** Inspect transaction ledger showing ₹500 debit/credit and run 'Test Replay Attack' in Cyber Lab.
"""
    with open(MD_FILE, "w", encoding="utf-8") as f:
        f.write(md_content)

    # Build Interactive HTML version
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MeshPay (upiSETU) — Viva Voce Technical Defense Handbook [DSEU Okhla-II]</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <style>
    :root {{
      --primary: #1e3a8a;
      --primary-hover: #1e40af;
      --accent: #0ea5e9;
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --text: #0f172a;
      --muted: #475569;
      --border: #e2e8f0;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0; padding: 0;
      font-family: 'Inter', -apple-system, sans-serif;
      background: var(--bg); color: var(--text);
      line-height: 1.5; -webkit-font-smoothing: antialiased;
    }}
    .header-bar {{
      position: sticky; top: 0; z-index: 100;
      background: #ffffff; border-bottom: 1px solid var(--border);
      padding: 12px 24px; display: flex; align-items: center; justify-content: space-between;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    }}
    .header-title {{ font-weight: 800; font-size: 16px; color: var(--primary); display: flex; align-items: center; gap: 8px; }}
    .nav-btns {{ display: flex; gap: 8px; }}
    .btn {{
      padding: 6px 14px; border-radius: 6px; font-size: 13px; font-weight: 600;
      cursor: pointer; border: 1px solid var(--border); background: #ffffff; transition: all 0.15s;
    }}
    .btn:hover {{ background: #f1f5f9; }}
    .btn-primary {{ background: var(--primary); color: #ffffff; border-color: var(--primary); }}
    .btn-primary:hover {{ background: var(--primary-hover); }}
    .filter-tabs {{
      display: flex; gap: 6px; padding: 12px 24px; background: #ffffff; border-bottom: 1px solid var(--border);
      overflow-x: auto;
    }}
    .tab {{
      padding: 6px 12px; border-radius: 9999px; font-size: 12.5px; font-weight: 600; cursor: pointer;
      background: #f1f5f9; color: var(--muted); border: 1px solid transparent; user-select: none;
    }}
    .tab.active {{ background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }}
    .container {{ max-width: 960px; margin: 24px auto; padding: 0 16px 80px 16px; }}
    .hero-card {{
      background: #ffffff; border: 1px solid var(--border); border-radius: 12px;
      padding: 24px; margin-bottom: 24px; box-shadow: 0 4px 16px rgba(0,0,0,0.04);
      display: flex; gap: 20px; align-items: center;
    }}
    .hero-logo {{ width: 100px; height: auto; flex-shrink: 0; }}
    .hero-meta {{ flex-grow: 1; }}
    .hero-title {{ font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 6px 0; }}
    .hero-sub {{ font-size: 13.5px; color: var(--muted); margin: 0 0 12px 0; }}
    .badge-grid {{ display: flex; flex-wrap: wrap; gap: 8px; font-size: 12px; }}
    .badge {{ background: #f1f5f9; border: 1px solid #cbd5e1; padding: 3px 8px; border-radius: 4px; font-weight: 600; }}
    .badge-blue {{ background: #eff6ff; border-color: #bfdbfe; color: #1e40af; }}
    .section-title {{
      font-size: 17px; font-weight: 800; color: var(--primary); margin: 28px 0 14px 0;
      border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; display: flex; align-items: center; gap: 8px;
    }}
    .qa-card {{
      background: #ffffff; border: 1px solid var(--border); border-left: 4px solid var(--primary);
      border-radius: 8px; padding: 16px 18px; margin-bottom: 14px; box-shadow: 0 2px 6px rgba(0,0,0,0.03);
    }}
    .qa-q {{ font-size: 14.5px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }}
    .qa-cand {{ font-size: 11.5px; font-weight: 600; color: #0284c7; margin-bottom: 10px; display: flex; align-items: center; gap: 4px; }}
    .qa-a {{ font-size: 13px; color: #334155; line-height: 1.55; }}
    .qa-a code {{ font-family: 'JetBrains Mono', monospace; font-size: 11.5px; background: #f1f5f9; padding: 2px 5px; border-radius: 4px; }}
    .table-custom {{ width: 100%; border-collapse: collapse; font-size: 12.5px; margin: 12px 0; background: #fff; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }}
    .table-custom th, .table-custom td {{ padding: 8px 12px; border: 1px solid var(--border); text-align: left; }}
    .table-custom th {{ background: #f8fafc; font-weight: 700; color: #1e293b; }}
    @media print {{
      .header-bar, .filter-tabs {{ display: none !important; }}
      body {{ background: #ffffff; }}
      .qa-card {{ break-inside: avoid; border: 1px solid #cbd5e1; }}
    }}
  </style>
</head>
<body>
  <div class="header-bar">
    <div class="header-title">
      <span>🛡️ MeshPay Viva Voce Defense Guide</span>
      <span style="font-size: 11px; background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 9999px;">DSEU OKHLA-II</span>
    </div>
    <div class="nav-btns">
      <a href="VIVA_QUESTIONS_AND_NOTES.pdf" download class="btn btn-primary">📄 Download Official PDF</a>
      <button class="btn" onclick="window.print()">🖨️ Print Notes</button>
    </div>
  </div>

  <div class="filter-tabs">
    <div class="tab active" onclick="filterCards('all', this)">All Questions (38)</div>
    <div class="tab" onclick="filterCards('sourav', this)">Sourav Thakur (Backend/Crypto)</div>
    <div class="tab" onclick="filterCards('sushant', this)">Sushant Sunder (Mesh/Routing)</div>
    <div class="tab" onclick="filterCards('rajat', this)">Rajat Trehan (Frontend/Lab)</div>
    <div class="tab" onclick="filterCards('grill', this)">Tough Grill / Trap Questions</div>
  </div>

  <div class="container">
    <div class="hero-card">
      <img src="dseu_logo.png" alt="DSEU Logo" class="hero-logo" />
      <div class="hero-meta">
        <h1 class="hero-title">MeshPay (upiSETU) — Viva Voce Examination & Defense Handbook</h1>
        <p class="hero-sub">Bachelor of Technology in Computer Science and Engineering (Batch: VIIth Semester, Aug–Nov 2026)</p>
        <div class="badge-grid">
          <span class="badge badge-blue">Sourav Thakur (41523099)</span>
          <span class="badge badge-blue">Sushant Sunder (41523103)</span>
          <span class="badge badge-blue">Rajat Trehan (41523078)</span>
          <span class="badge">Mentor: Ms. Meenu Munjal</span>
          <span class="badge">DSEU Okhla-II Campus</span>
        </div>
      </div>
    </div>

    <!-- 2-Minute Pitch -->
    <div class="section-title">⏱️ 2-Minute Team Elevator Pitch</div>
    <div class="qa-card" style="border-left-color: #059669; background: #f0fdf4;">
      <div class="qa-q">Examiner: "Can you explain what your project is, what problem it solves, and how it works in 2 minutes?"</div>
      <div class="qa-cand" style="color: #059669;">Universal Pitch (Spoken by any team member)</div>
      <div class="qa-a">
        "Good morning, respected external examiners. Our project is <strong>MeshPay (upiSETU)</strong>, an offline-first peer-to-peer payment architecture and store-carry-forward routing engine designed for zero-connectivity environments—such as subterranean metro corridors, deep basements, disaster-affected regions, and rural blind-spots where conventional UPI fails.<br/><br/>
        Traditional UPI requires synchronous client-to-server 4G connectivity. When a citizen enters an underground Delhi Metro station, transactions fail due to socket timeouts. MeshPay decouples <strong>offline transaction signing</strong> from <strong>deferred bank settlement</strong> using Delay-Tolerant Networking (RFC 4838):<br/>
        1. <strong>Client Enclave:</strong> Payer smartphone seals an envelope locally using W3C Web Crypto hybrid encryption (RSA-2048-OAEP encapsulating an ephemeral AES-256-GCM session key). The UPI PIN is hashed via salted SHA-256 with zero plaintext exposure.<br/>
        2. <strong>Store-Carry-Forward Mesh:</strong> The packet gossips across nearby peer smartphones via Bluetooth Low Energy (BLE). Intermediate relays have zero knowledge of payment amounts or recipient accounts and cannot tamper with ciphertext.<br/>
        3. <strong>Bridge Upload & Settlement:</strong> When any device exits the tunnel and gets 4G connectivity (acting as an autonomous Bridge Node), it uploads accumulated envelopes to the Central Bank. The bank enforces a <strong>dual-tier idempotency defense</strong> (in-memory SHA-256 cache + relational database unique constraint) to prevent double-spending and bridge race conditions before executing atomic ACID ledger debits and credits.<br/><br/>
        Our system is verified with <strong>23 automated tests (100% pass rate)</strong>, sub-30ms settlement latency, persistent RSA keys that survive server reboots, and an interactive React simulation with audio Soundbox chimes."
      </div>
    </div>

    <!-- Q&A Section -->
    <div class="section-title">❓ Comprehensive Technical Questions & Model Answers</div>

    <div class="qa-card" data-category="sourav">
      <div class="qa-q">Q1: Can you explain the exact cryptographic and settlement flow when an envelope arrives at your backend?</div>
      <div class="qa-cand">Assigned: Sourav Thakur (41523099) — Backend Architect</div>
      <div class="qa-a">
        When an encrypted packet arrives at <code>POST /api/v1/settle</code>, the backend executes a 5-stage pipeline:<br/>
        1. <strong>Wire-Hash De-duplication:</strong> It computes SHA-256 over raw wire bytes. If present in <code>inMemoryWireCache</code>, it returns the cached settlement response in under 0.5 ms.<br/>
        2. <strong>Asymmetric Unwrapping:</strong> It invokes <code>CryptoEnvelopeService</code>, using our persistent RSA-2048 private key to decrypt the ephemeral AES key via RSA-OAEP with SHA-256 and MGF1 padding.<br/>
        3. <strong>Symmetric Authenticated Decryption:</strong> It uses the decrypted 256-bit AES key to decrypt the payload with AES-256-GCM using the 96-bit IV and 128-bit authentication tag. If even 1 bit was altered, GCM tag verification throws a <code>SecurityException</code>.<br/>
        4. <strong>Relational Idempotency Check:</strong> Within a <code>READ_COMMITTED</code> SQL transaction, it checks <code>IdempotencyKeyRepository.existsBySenderVpaAndNonce()</code>. If found, the transaction rolls back cleanly.<br/>
        5. <strong>ACID Ledger Settlement:</strong> It acquires the sender account with optimistic locking (<code>@Version</code>), verifies balance >= amount, debits sender, credits payee, logs the transaction, saves the idempotency record, and commits atomically.
      </div>
    </div>

    <div class="qa-card" data-category="sourav">
      <div class="qa-q">Q2: Why did you choose hybrid RSA-2048-OAEP + AES-256-GCM rather than pure RSA or pure AES?</div>
      <div class="qa-cand">Assigned: Sourav Thakur (41523099) — Cryptographic Systems</div>
      <div class="qa-a">
        Hybrid cryptography gives us the best of both worlds:<br/>
        • <strong>Why not pure RSA?</strong> RSA is computationally intensive and mathematically cannot encrypt data larger than its key size minus padding (a 2048-bit RSA key can only encrypt up to 190 bytes under OAEP-SHA256). Our JSON payment instruction is ~350 bytes, which exceeds pure RSA limits.<br/>
        • <strong>Why not pure AES?</strong> Pure AES requires a pre-shared secret key. In an ad-hoc mesh where millions of strangers meet in a metro tunnel, sender phones cannot share a symmetric key with the central bank in advance without exposing it to intermediate sniffers.<br/>
        • <strong>The Hybrid Solution:</strong> The client generates a fresh ephemeral 256-bit AES key, encrypts the arbitrary-length payment instruction under AES-GCM (which takes ~1ms), and encrypts only that 32-byte key under the Bank's RSA public key. Only the bank can decrypt the session key, and intermediate relays observe only opaque ciphertext.
      </div>
    </div>

    <div class="qa-card" data-category="sourav">
      <div class="qa-q">Q3: How does your Dual-Tier Idempotency defense work, and why wasn't an in-memory cache enough?</div>
      <div class="qa-cand">Assigned: Sourav Thakur (41523099) — Concurrency & Database</div>
      <div class="qa-a">
        A single-tier cache fails under two real-world failure modes:<br/>
        • <strong>Failure Mode 1 (Memory Loss on Restart):</strong> An in-memory cache is lost if the server process restarts. If a bridge retries a gossiped packet after restart, a memory-only cache would re-execute the payment, double-debiting the sender.<br/>
        • <strong>Failure Mode 2 (Concurrent Bridge Race Conditions):</strong> When two bridge devices exit a tunnel and hit 4G simultaneously, both submit identical packets in parallel threads. Two threads can check an in-memory cache at the exact same microsecond before either has written to it.<br/>
        • <strong>Our Solution:</strong> Tier 1 (In-Memory ConcurrentHashMap) filters 99% of retransmissions in 0.28ms without hitting the disk. Tier 2 (Relational Database Unique Constraint on <code>(sender_vpa, nonce)</code>) guarantees ACID isolation: the second thread triggers a SQL <code>DataIntegrityViolationException</code> and rolls back cleanly with zero double-debit.
      </div>
    </div>

    <div class="qa-card" data-category="sushant">
      <div class="qa-q">Q4: What is Delay-Tolerant Networking (DTN) and how does Store-Carry-Forward differ from TCP/IP?</div>
      <div class="qa-cand">Assigned: Sushant Sunder (41523103) — Mesh Routing Protocol</div>
      <div class="qa-a">
        Traditional TCP/IP requires a continuous, synchronized end-to-end path: a packet moves from router to router along a live electrical circuit or radio wave within milliseconds. If any intermediate link drops, TCP aborts with connection timeouts.<br/>
        <strong>Delay-Tolerant Networking (RFC 4838)</strong> operates on the <strong>Store-Carry-Forward</strong> paradigm: intermediate nodes accept encrypted packets, store them in persistent local buffers (IndexedDB on phones), carry them as citizens walk through physical corridors, and forward them whenever a new peer enters radio range (10–30m over Bluetooth LE). Communication occurs asynchronously over minutes or hours until reaching a bridge.
      </div>
    </div>

    <div class="qa-card" data-category="sushant">
      <div class="qa-q">Q5: How does your epidemic gossip protocol prevent infinite message loops and buffer exhaustion?</div>
      <div class="qa-cand">Assigned: Sushant Sunder (41523103) — Mesh Routing Protocol</div>
      <div class="qa-a">
        Pure epidemic routing replicates packets to every discovered peer, which in a dense metro station would quickly cause radio collision storms and flash memory exhaustion. We engineered three bounded mechanisms:<br/>
        1. <strong>Integer Hop/TTL Decrement:</strong> Packets are initialized with $TTL = 10$ and $Hops = 0$. Every relay decrements TTL by 1 and increments Hop count by 1. When $TTL &le; 0$, the packet is permanently purged from memory.<br/>
        2. <strong>Ring-Buffer Hash De-duplication:</strong> Each device maintains a 500-element ring buffer of SHA-256 hashes of seen packets. If Carol already holds packet $P_1$, she rejects Dave's gossip offer in the initial handshake.<br/>
        3. <strong>Opportunistic Bridge Prioritization:</strong> Nodes prioritize forwarding toward peers flagged with high mobility or bridge capability.
      </div>
    </div>

    <div class="qa-card" data-category="rajat">
      <div class="qa-q">Q6: Why did you build the Metro Tunnel Disaster Theater rather than a standard dashboard?</div>
      <div class="qa-cand">Assigned: Rajat Trehan (41523078) — Frontend & Simulation</div>
      <div class="qa-a">
        Standard fintech dashboards display static cards, which fail to communicate the physical reality of an underground disaster or cellular blackout. We created the <strong>Metro Tunnel Disaster Theater</strong> (Depth: -42.5m, flickering industrial lamps, 0-bar 'NO SERVICE' phone mockup, and expanding 2.4 GHz circular BLE radio waves).<br/>
        This immediately demonstrates to evaluators that the payer's smartphone is in total radio isolation. When the user clicks 'Inject into Mesh', the W3C Web Crypto enclave executes in the browser, showing how real cryptography functions on client devices.
      </div>
    </div>

    <div class="qa-card" data-category="rajat">
      <div class="qa-q">Q7: How do you ensure the user's PIN is never exposed in plaintext in browser memory or storage?</div>
      <div class="qa-cand">Assigned: Rajat Trehan (41523078) — Client Cryptography Enclave</div>
      <div class="qa-a">
        In <code>offlineCrypto.js</code>, when the user inputs their 4-digit PIN on the simulated mobile keypad, we immediately derive:<br/>
        <code>pinHash = SHA-256(pin + ":" + senderVpa)</code><br/>
        The cleartext PIN variable is immediately discarded from memory. Only the cryptographic hash is placed into the JSON instruction payload before AES-GCM encryption. Even if an attacker attaches a memory debugger to the device after transmission, the cleartext PIN cannot be recovered.
      </div>
    </div>

    <div class="qa-card" data-category="grill">
      <div class="qa-q">Q8: How do you mathematically prevent double-spending in a completely disconnected mesh?</div>
      <div class="qa-cand">Tough Grill Question — All Candidates</div>
      <div class="qa-a">
        In a disconnected network, absolute real-time global consensus without communication is mathematically impossible (Fischer-Lynch-Paterson Theorem). MeshPay handles this through a <strong>hybrid economic and cryptographic risk model</strong> aligned with RBI guidelines:<br/>
        1. <strong>Bounded Transaction Exposure:</strong> In accordance with RBI Circular DPSS.CO.PD.No.S-526/02-14-003/2021-22, offline transactions are strictly capped at ₹500 per transaction and ₹2,000 cumulative balance. An attacker cannot cause systemic bank collapse.<br/>
        2. <strong>Sequential Bank Clearing:</strong> The Central Bank processes envelopes in order of arrival. The first merchant's envelope to reach a bridge consumes the ₹500 balance. The second packet is marked <code>FAILED (INSUFFICIENT_FUNDS)</code>.<br/>
        3. <strong>Future Hardware Enclave (eSE):</strong> In our future scope (Section 6.3), we document how smartphone hardware Secure Elements (eSE) can enforce monotonic on-device sequence counters, cryptographically preventing a second packet from ever being signed offline.
      </div>
    </div>

    <div class="qa-card" data-category="grill">
      <div class="qa-q">Q9: Why not use existing USSD (*99#) or UPI 123PAY instead of MeshPay?</div>
      <div class="qa-cand">Tough Grill Question — All Candidates</div>
      <div class="qa-a">
        • <strong>USSD (*99#)</strong> uses GSM 2G voice signaling. It still requires a connection to a cellular cell tower. In underground subway tunnels or deep concrete basements, there is <strong>zero GSM signal</strong>, so USSD returns 'Network Error'. Furthermore, USSD suffers from >35% transaction failure rates and high carrier session costs.<br/>
        • <strong>UPI 123PAY</strong> relies on IVR voice calls or ultrasonic sound waves. IVR requires live telecom voice coverage, which fails underground. Ultrasonic proximity sound waves only work point-to-point over 10 centimeters and cannot gossip packets across a 500-meter transit platform to reach an exit bridge.<br/>
        • <strong>MeshPay</strong> requires <strong>zero cellular infrastructure</strong> at the payment location. It leverages the ambient Bluetooth LE radios of passing citizens to carry packets to the nearest exit.
      </div>
    </div>

    <!-- 5-Minute Live Demo Script -->
    <div class="section-title">🎬 5-Minute Structured Live Demonstration Script</div>
    <table class="table-custom">
      <thead>
        <tr>
          <th>Time</th>
          <th>Screen / Action</th>
          <th>What Candidate Says to External Examiners</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>0:00 - 1:00</strong></td>
          <td>Open http://localhost:8080/<br/>Show Metro Disaster Theater</td>
          <td>"Respected examiners, notice our Metro Disaster environment at -42.5m subterranean depth with zero cellular bars. Alice is trapped underground with merchant Bob and needs to pay ₹500 for emergency provisions."</td>
        </tr>
        <tr>
          <td><strong>1:00 - 2:00</strong></td>
          <td>Step 1: Compose Payment<br/>Click 'Inject into Mesh'</td>
          <td>"Alice selects ₹500, enters PIN 1234. The W3C Web Crypto enclave executes locally on her phone, generating an ephemeral AES-256-GCM key, wrapping it with the Bank's RSA-2048-OAEP public key, and saving the sealed envelope to local IndexedDB."</td>
        </tr>
        <tr>
          <td><strong>2:00 - 3:00</strong></td>
          <td>Step 2: Run Gossip Round<br/>Show Topology Canvas</td>
          <td>"Alice has no 4G backhaul, so the packet hops peer-to-peer over Bluetooth LE to Carol (Hop 1), then to Dave (Hop 2). Notice the live speech bubbles exchanging gossip and the moving packet mascot. Intermediate relays only hold ciphertext."</td>
        </tr>
        <tr>
          <td><strong>3:00 - 4:00</strong></td>
          <td>Step 3: Bridges Upload<br/>Water Pipe & Soundbox</td>
          <td>"Eve Bridge walks up the metro escalators and enters 4G coverage. Clicking 'Bridges Upload' pressurizes our 4G industrial water pipe, flushing the envelope to the Central Bank core. Listen to the Soundbox voice announcing payment clearance in Hindi and English!"</td>
        </tr>
        <tr>
          <td><strong>4:00 - 5:00</strong></td>
          <td>Transactions Ledger & Cyber Viva Lab</td>
          <td>"In the ledger, Alice's balance is debited from ₹5,000 to ₹4,500 and Bob credited. Clicking 'Test Replay Attack' in our Cyber Lab immediately triggers our dual-tier idempotency defense, dropping duplicate packets with 0 double debits. All 23 tests pass 100%."</td>
        </tr>
      </tbody>
    </table>

  </div>

  <script>
    function filterCards(cat, btn) {{
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      const cards = document.querySelectorAll('.qa-card');
      cards.forEach(card => {{
        if (cat === 'all') {{
          card.style.display = 'block';
        }} else {{
          card.style.display = (card.getAttribute('data-category') === cat) ? 'block' : 'none';
        }}
      }});
    }}
  </script>
</body>
</html>
"""
    with open(HTML_FILE, "w", encoding="utf-8") as f:
        f.write(html_content)

    print(f"SUCCESS: HTML guide generated at {HTML_FILE}")
    print(f"SUCCESS: Markdown guide generated at {MD_FILE}")

if __name__ == "__main__":
    build_pdf()
    build_html_and_md()

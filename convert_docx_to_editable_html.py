import os
import docx
from docx.oxml.text.paragraph import CT_P
from docx.oxml.table import CT_Tbl
from docx.text.paragraph import Paragraph
from docx.table import Table
from docx.enum.text import WD_ALIGN_PARAGRAPH

DOCX_FILE = "PROJECT_REPORT.docx"
OUTPUT_HTML = "PROJECT_REPORT.html"

def convert():
    print(f"Reading {DOCX_FILE} and converting to editable interactive HTML...")
    doc = docx.Document(DOCX_FILE)

    html_parts = []

    for child in doc.element.body:
        if isinstance(child, CT_P):
            p = Paragraph(child, doc)
            text = p.text.strip()
            
            # Check for page break
            is_page_break = False
            for r in p.runs:
                if 'lastRenderedPageBreak' in r._r.xml or 'w:br w:type="page"' in r._r.xml:
                    is_page_break = True
                    break

            if is_page_break:
                html_parts.append('<div class="page-break" title="Page Break"></div>')

            if not text:
                html_parts.append('<p class="empty-p"><br></p>')
                continue

            # Determine alignment
            align_class = "align-left"
            if p.alignment == WD_ALIGN_PARAGRAPH.CENTER:
                align_class = "align-center"
            elif p.alignment == WD_ALIGN_PARAGRAPH.RIGHT:
                align_class = "align-right"
            elif p.alignment == WD_ALIGN_PARAGRAPH.JUSTIFY:
                align_class = "align-justify"

            # Check if chapter heading or section heading
            heading_tag = "p"
            extra_class = ""
            
            # Extract runs with formatting
            run_htmls = []
            for r in p.runs:
                r_text = r.text
                if not r_text:
                    continue
                # Escape HTML special chars
                clean = (r_text.replace("&", "&amp;")
                               .replace("<", "&lt;")
                               .replace(">", "&gt;"))
                
                # Check formatting
                style_bits = []
                if r.font.name:
                    style_bits.append(f"font-family: '{r.font.name}', serif;")
                if r.font.size:
                    pt_size = r.font.size.pt
                    style_bits.append(f"font-size: {pt_size}pt;")
                if r.font.color and r.font.color.rgb:
                    style_bits.append(f"color: #{r.font.color.rgb};")
                
                style_str = " ".join(style_bits)

                # Format wrappers
                if r.bold:
                    clean = f"<strong>{clean}</strong>"
                if r.italic:
                    clean = f"<em>{clean}</em>"
                if r.underline:
                    clean = f"<u>{clean}</u>"
                if r.font.highlight_color:
                    clean = f'<mark style="background-color: #fef08a; padding: 2px 4px; border-radius: 2px; color: #854d0e;">{clean}</mark>'

                if style_str:
                    clean = f'<span style="{style_str}">{clean}</span>'

                run_htmls.append(clean)

            inner_html = "".join(run_htmls)

            # Check if this paragraph is a figure caption for Figures 5.2 - 5.5
            fig_img_map = {
                "Figure 5.2:": "screenshot_wide_dashboard.png",
                "Figure 5.3:": "screenshot_topology.png",
                "Figure 5.4:": "screenshot_ledger_devices.png",
                "Figure 5.5:": "screenshot_test_suite.png"
            }
            matched_fig = None
            for f_key, f_path in fig_img_map.items():
                if text.startswith(f_key):
                    matched_fig = f_path
                    break

            if matched_fig and os.path.exists(matched_fig):
                import base64
                with open(matched_fig, "rb") as mf:
                    mf_b64 = base64.b64encode(mf.read()).decode("utf-8")
                html_parts.append(f'''
                <div class="figure-container" style="text-align: center; margin: 20pt 0 8pt 0;">
                    <img src="data:image/png;base64,{mf_b64}" alt="{text}" style="max-width: 95%; border: 1px solid #cbd5e1; border-radius: 6px; box-shadow: 0 4px 14px rgba(0,0,0,0.12); margin: 0 auto; display: block;" />
                </div>
                ''')

            # Detect heading styles from content
            if text.startswith("CHAPTER ") and len(text) < 20:
                heading_tag = "h2"
                extra_class = "chapter-num"
            elif any(text.startswith(f"{i}.") for i in range(1, 9)) and len(text) < 120 and p.runs and p.runs[0].bold:
                if text.count(".") == 1:
                    heading_tag = "h2"
                    extra_class = "section-heading"
                elif text.count(".") == 2:
                    heading_tag = "h3"
                    extra_class = "subsection-heading"
            elif text.isupper() and len(text) < 120 and p.runs and p.runs[0].bold and p.alignment == WD_ALIGN_PARAGRAPH.CENTER:
                heading_tag = "h1"
                extra_class = "title-heading"

            html_parts.append(f'<{heading_tag} class="{align_class} {extra_class}">{inner_html}</{heading_tag}>')

        elif isinstance(child, CT_Tbl):
            tbl = Table(child, doc)
            rows = tbl.rows
            
            # Check if 1x1 table (callout or code snippet)
            if len(rows) == 1 and len(tbl.columns) == 1:
                cell = tbl.cell(0, 0)
                cell_text = cell.text.strip()
                
                # Check if code block (Consolas font)
                is_code = False
                for cp in cell.paragraphs:
                    for cr in cp.runs:
                        if cr.font.name and 'consolas' in cr.font.name.lower():
                            is_code = True
                            break
                    if is_code:
                        break

                if is_code:
                    clean_code = (cell_text.replace("&", "&amp;")
                                           .replace("<", "&lt;")
                                           .replace(">", "&gt;"))
                    html_parts.append(f'<div class="code-box"><pre><code>{clean_code}</code></pre></div>')
                elif "[INSERT DSEU LOGO HERE]" in cell_text or "dseu" in cell_text.lower() or (len(cell.paragraphs) > 0 and 'drawing' in cell.paragraphs[0]._p.xml):
                    import base64
                    logo_b64 = ""
                    if os.path.exists("dseu_logo.png"):
                        with open("dseu_logo.png", "rb") as lf:
                            logo_b64 = base64.b64encode(lf.read()).decode("utf-8")
                    if logo_b64:
                        html_parts.append(f'''
                        <div class="logo-box">
                            <img src="data:image/png;base64,{logo_b64}" alt="Delhi Skill and Entrepreneurship University (DSEU) Logo" style="width: 145px; height: auto; margin: 10px auto 14px auto; display: block;" />
                        </div>
                        ''')
                    else:
                        html_parts.append('''
                        <div class="logo-box">
                            <div class="logo-placeholder">
                                <span class="logo-icon">🏛️</span><br>
                                <strong>[INSERT DSEU LOGO HERE]</strong><br>
                                <small style="color: #64748b;">Delhi Skill and Entrepreneurship University</small>
                            </div>
                        </div>
                        ''')
                elif cell_text.startswith("[FIGURE") or cell_text.startswith("[Table") or cell_text.startswith("["):
                    clean_callout = (cell_text.replace("&", "&amp;")
                                              .replace("<", "&lt;")
                                              .replace(">", "&gt;"))
                    html_parts.append(f'<div class="callout-box">{clean_callout}</div>')
                else:
                    clean_t = (cell_text.replace("&", "&amp;")
                                        .replace("<", "&lt;")
                                        .replace(">", "&gt;"))
                    html_parts.append(f'<div class="generic-box">{clean_t}</div>')
            else:
                # Regular data table
                tbl_html = ['<div class="table-responsive"><table class="report-table">']
                for r_idx, row in enumerate(rows):
                    tr_class = "table-header-row" if r_idx == 0 else ("even-row" if r_idx % 2 == 0 else "odd-row")
                    tbl_html.append(f'<tr class="{tr_class}">')
                    for cell in row.cells:
                        cell_tag = "th" if r_idx == 0 else "td"
                        cell_content = []
                        for cp in cell.paragraphs:
                            p_align = "text-center" if cp.alignment == WD_ALIGN_PARAGRAPH.CENTER else "text-left"
                            c_runs = []
                            for cr in cp.runs:
                                c_text = cr.text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                                if cr.bold:
                                    c_text = f"<strong>{c_text}</strong>"
                                if cr.italic:
                                    c_text = f"<em>{c_text}</em>"
                                if cr.font.highlight_color:
                                    c_text = f'<mark style="background-color: #fef08a; padding: 2px 4px; border-radius: 2px; color: #854d0e;">{c_text}</mark>'
                                c_runs.append(c_text)
                            cell_content.append(f'<div class="{p_align}">{"".join(c_runs)}</div>')
                        tbl_html.append(f'<{cell_tag}>{"".join(cell_content)}</{cell_tag}>')
                    tbl_html.append('</tr>')
                tbl_html.append('</table></div>')
                html_parts.append("".join(tbl_html))

    body_html = "\n".join(html_parts)

    full_page = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MeshPay (upiSETU) — B.Tech Minor Project Report [Editable Document]</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=JetBrains+Mono:wght@400;600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;0,6..72,700;1,6..72,400&display=swap" rel="stylesheet">
  <style>
    :root {{
      --primary: #1e3a8a;
      --primary-light: #3b82f6;
      --accent: #0ea5e9;
      --bg-page: #f1f5f9;
      --sheet-bg: #ffffff;
      --text: #0f172a;
      --muted: #475569;
      --border: #cbd5e1;
      --toolbar-bg: #ffffff;
    }}

    * {{
      box-sizing: border-box;
    }}

    body {{
      margin: 0;
      padding: 0;
      background-color: var(--bg-page);
      color: var(--text);
      font-family: 'Newsreader', 'Times New Roman', Times, serif;
      font-size: 11pt;
      line-height: 1.25;
      -webkit-font-smoothing: antialiased;
    }}

    /* Sticky Ribbon Toolbar */
    .toolbar-wrapper {{
      position: sticky;
      top: 0;
      z-index: 1000;
      background: var(--toolbar-bg);
      border-bottom: 1px solid var(--border);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      padding: 8px 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }}

    .toolbar-top {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 1px solid #f1f5f9;
    }}

    .doc-meta {{
      display: flex;
      align-items: center;
      gap: 12px;
    }}

    .doc-badge {{
      background: #eff6ff;
      color: #1d4ed8;
      font-weight: 700;
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 9999px;
      border: 1px solid #bfdbfe;
      letter-spacing: 0.5px;
    }}

    .doc-title-input {{
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
      border: 1px solid transparent;
      padding: 4px 8px;
      border-radius: 4px;
      outline: none;
      transition: all 0.2s;
    }}

    .doc-title-input:hover, .doc-title-input:focus {{
      background: #f8fafc;
      border-color: #cbd5e1;
    }}

    .save-status {{
      font-size: 12px;
      color: #059669;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 4px;
    }}

    .action-buttons {{
      display: flex;
      align-items: center;
      gap: 8px;
    }}

    .btn {{
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #ffffff;
      color: #1e293b;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      user-select: none;
    }}

    .btn:hover {{
      background: #f8fafc;
      border-color: #94a3b8;
    }}

    .btn-primary {{
      background: #1e3a8a;
      color: #ffffff;
      border-color: #1e3a8a;
    }}

    .btn-primary:hover {{
      background: #1e40af;
      border-color: #1e40af;
    }}

    .btn-green {{
      background: #059669;
      color: #ffffff;
      border-color: #059669;
    }}

    .btn-green:hover {{
      background: #047857;
      border-color: #047857;
    }}

    /* Formatting controls row */
    .toolbar-tools {{
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
    }}

    .tool-group {{
      display: inline-flex;
      align-items: center;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      background: #f8fafc;
      padding: 2px;
    }}

    .tool-btn {{
      background: transparent;
      border: none;
      border-radius: 4px;
      padding: 4px 8px;
      font-size: 13px;
      font-weight: 600;
      color: #334155;
      cursor: pointer;
      min-width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s;
    }}

    .tool-btn:hover {{
      background: #e2e8f0;
      color: #0f172a;
    }}

    .tool-btn.active {{
      background: #cbd5e1;
      color: #0f172a;
    }}

    select.tool-select {{
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 4px 8px;
      font-size: 12px;
      background: #ffffff;
      color: #334155;
      outline: none;
      height: 28px;
      cursor: pointer;
    }}

    /* Workspace canvas */
    .workspace {{
      padding: 24px 16px 80px 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }}

    /* Single or Multi-Sheet Paper Look */
    .document-page {{
      width: 8.5in;
      min-height: 11in;
      background: var(--sheet-bg);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.08);
      border-radius: 2px;
      padding: 1in;
      margin: 0 auto 30px auto;
      outline: none;
      position: relative;
    }}

    .document-page:focus {{
      box-shadow: 0 6px 28px rgba(30, 58, 138, 0.18), 0 2px 6px rgba(0, 0, 0, 0.08);
    }}

    /* Page Breaks Visual */
    .page-break {{
      height: 24px;
      margin: 32px -1in;
      background: #e2e8f0;
      border-top: 1px dashed #94a3b8;
      border-bottom: 1px dashed #94a3b8;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }}

    .page-break::after {{
      content: "— PAGE BREAK —";
      font-family: -apple-system, sans-serif;
      font-size: 10px;
      letter-spacing: 1.5px;
      font-weight: 700;
      color: #64748b;
      background: #f1f5f9;
      padding: 2px 10px;
      border-radius: 4px;
      border: 1px solid #cbd5e1;
    }}

    /* Typography & Hierarchy */
    h1.title-heading {{
      font-family: 'Newsreader', 'Times New Roman', serif;
      font-size: 15pt;
      font-weight: 700;
      text-align: center;
      margin-top: 24pt;
      margin-bottom: 8pt;
      color: #0f172a;
      line-height: 1.2;
    }}

    h2.chapter-num {{
      font-family: 'Newsreader', 'Times New Roman', serif;
      font-size: 18pt;
      font-weight: 700;
      text-align: right;
      margin-top: 28pt;
      margin-bottom: 4pt;
      color: #1e3a8a;
    }}

    h2.section-heading {{
      font-family: 'Newsreader', 'Times New Roman', serif;
      font-size: 13pt;
      font-weight: 700;
      margin-top: 14pt;
      margin-bottom: 4pt;
      color: #0f172a;
    }}

    h3.subsection-heading {{
      font-family: 'Newsreader', 'Times New Roman', serif;
      font-size: 11.5pt;
      font-weight: 700;
      margin-top: 10pt;
      margin-bottom: 2pt;
      color: #1e293b;
    }}

    p {{
      margin-top: 0;
      margin-bottom: 6pt;
      text-align: justify;
    }}

    .empty-p {{
      margin-bottom: 6pt;
    }}

    .align-center {{ text-align: center; }}
    .align-right {{ text-align: right; }}
    .align-left {{ text-align: left; }}
    .align-justify {{ text-align: justify; }}

    /* Tables */
    .table-responsive {{
      margin: 12pt 0;
      overflow-x: auto;
    }}

    table.report-table {{
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
      font-family: 'Newsreader', 'Times New Roman', serif;
      border: 1px solid #94a3b8;
    }}

    table.report-table th, table.report-table td {{
      border: 1px solid #cbd5e1;
      padding: 5px 8px;
      line-height: 1.15;
    }}

    table.report-table th {{
      background-color: #eaeff5;
      font-weight: 700;
      text-align: center;
      color: #1e293b;
    }}

    table.report-table tr.even-row td {{
      background-color: #ffffff;
    }}

    table.report-table tr.odd-row td {{
      background-color: #f8fafc;
    }}

    /* Code Snippets */
    .code-box {{
      margin: 10pt 0;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #1e3a8a;
      border-radius: 4px;
      padding: 8px 12px;
      font-family: 'JetBrains Mono', Consolas, 'Courier New', monospace;
      font-size: 8.5pt;
      line-height: 1.25;
      overflow-x: auto;
    }}

    .code-box pre {{
      margin: 0;
      white-space: pre-wrap;
      word-break: break-all;
    }}

    /* Callout & Figure Boxes */
    .callout-box {{
      margin: 12pt 0;
      background: #f0f7ff;
      border: 1px solid #bfdbfe;
      border-left: 5px solid #2563eb;
      border-radius: 4px;
      padding: 10px 14px;
      font-size: 9.5pt;
      line-height: 1.35;
      font-style: italic;
    }}

    .logo-box {{
      text-align: center;
      margin: 18pt 0 12pt 0;
    }}

    .logo-placeholder {{
      display: inline-block;
      border: 2px dashed #94a3b8;
      border-radius: 8px;
      padding: 16px 28px;
      background: #f8fafc;
    }}

    .logo-icon {{
      font-size: 32px;
    }}

    /* Floating Stats Badge */
    .floating-stats {{
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      box-shadow: 0 4px 14px rgba(0,0,0,0.12);
      border-radius: 9999px;
      padding: 6px 14px;
      display: flex;
      align-items: center;
      gap: 12px;
      font-family: -apple-system, sans-serif;
      font-size: 12px;
      font-weight: 600;
      color: #334155;
      z-index: 999;
    }}

    .badge-dot {{
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
      display: inline-block;
      animation: pulse 2s infinite;
    }}

    @keyframes pulse {{
      0% {{ transform: scale(0.95); opacity: 0.8; }}
      50% {{ transform: scale(1.15); opacity: 1; }}
      100% {{ transform: scale(0.95); opacity: 0.8; }}
    }}

    /* Print Styles */
    @media print {{
      .toolbar-wrapper, .floating-stats {{
        display: none !important;
      }}
      body {{
        background: #ffffff;
      }}
      .workspace {{
        padding: 0;
      }}
      .document-page {{
        box-shadow: none;
        padding: 0.8in;
        margin: 0;
        width: 100%;
        min-height: auto;
      }}
      .page-break {{
        border: none;
        height: 0;
        margin: 0;
        background: transparent;
        page-break-after: always;
        break-after: page;
      }}
      .page-break::after {{
        display: none;
      }}
    }}
  </style>
</head>
<body>

  <!-- Sticky Ribbon Toolbar -->
  <header class="toolbar-wrapper">
    <div class="toolbar-top">
      <div class="doc-meta">
        <span class="doc-badge">LIVE EDITABLE REPORT</span>
        <span class="doc-title-input" id="doc-title">MeshPay_Minor_Project_Report.docx</span>
        <span class="save-status" id="save-status">
          <span style="color: #059669;">●</span> Live Autosave Active
        </span>
      </div>
      <div class="action-buttons">
        <button class="btn" onclick="restoreOriginal()" title="Reset to original generated report">
          🔄 Reset Original
        </button>
        <button class="btn btn-green" onclick="saveEditsManually()" title="Save changes to browser memory">
          💾 Save Changes
        </button>
        <button class="btn btn-primary" onclick="downloadEditedHtml()" title="Download updated HTML file to your computer">
          📥 Download HTML
        </button>
        <button class="btn" onclick="window.print()" title="Print directly or save as publication PDF">
          🖨️ Print / Save PDF
        </button>
      </div>
    </div>

    <!-- Formatting Tools Bar -->
    <div class="toolbar-tools">
      <div class="tool-group">
        <button class="tool-btn" onclick="formatDoc('undo')" title="Undo (Ctrl+Z)">↩️</button>
        <button class="tool-btn" onclick="formatDoc('redo')" title="Redo (Ctrl+Y)">↪️</button>
      </div>

      <div class="tool-group">
        <select class="tool-select" onchange="formatHeading(this.value)">
          <option value="p">Paragraph Style</option>
          <option value="h1">Title (H1)</option>
          <option value="h2">Chapter / Section (H2)</option>
          <option value="h3">Subsection (H3)</option>
        </select>
        <select class="tool-select" onchange="formatDoc('fontName', this.value)">
          <option value="'Times New Roman', serif">Times New Roman</option>
          <option value="'Arial', sans-serif">Arial</option>
          <option value="'Calibri', sans-serif">Calibri</option>
          <option value="'JetBrains Mono', monospace">Consolas / Code</option>
        </select>
        <select class="tool-select" onchange="formatDoc('fontSize', this.value)">
          <option value="3">11 pt (Standard)</option>
          <option value="1">8.5 pt (Table)</option>
          <option value="2">10 pt</option>
          <option value="4">13 pt (H2)</option>
          <option value="5">16 pt (H1)</option>
          <option value="6">18 pt (Title)</option>
        </select>
      </div>

      <div class="tool-group">
        <button class="tool-btn" onclick="formatDoc('bold')" title="Bold (Ctrl+B)"><strong>B</strong></button>
        <button class="tool-btn" onclick="formatDoc('italic')" title="Italic (Ctrl+I)"><em>I</em></button>
        <button class="tool-btn" onclick="formatDoc('underline')" title="Underline (Ctrl+U)"><u>U</u></button>
        <button class="tool-btn" onclick="formatDoc('strikeThrough')" title="Strikethrough"><s>S</s></button>
        <button class="tool-btn" onclick="highlightYellow()" title="Highlight in Yellow" style="background: #fef08a; color: #854d0e; font-weight: 700;">🖍️</button>
      </div>

      <div class="tool-group">
        <button class="tool-btn" onclick="formatDoc('justifyLeft')" title="Align Left">⬅️</button>
        <button class="tool-btn" onclick="formatDoc('justifyCenter')" title="Center">↔️</button>
        <button class="tool-btn" onclick="formatDoc('justifyRight')" title="Align Right">➡️</button>
        <button class="tool-btn" onclick="formatDoc('justifyFull')" title="Justify">☰</button>
      </div>

      <div class="tool-group">
        <button class="tool-btn" onclick="formatDoc('insertUnorderedList')" title="Bullet List">• List</button>
        <button class="tool-btn" onclick="formatDoc('insertOrderedList')" title="Numbered List">1. List</button>
      </div>

      <div class="tool-group">
        <button class="tool-btn" onclick="insertPageBreak()" title="Insert Page Break">📄 Page Break</button>
        <button class="tool-btn" onclick="insertTableRow()" title="Insert Table Row Below">➕ Row</button>
        <button class="tool-btn" onclick="deleteTableRow()" title="Delete Table Row">➖ Row</button>
      </div>
    </div>
  </header>

  <!-- Main Document Canvas -->
  <main class="workspace">
    <div class="document-page" id="editor" contenteditable="true" spellcheck="true" autocomplete="off" autocorrect="off">
{body_html}
    </div>
  </main>

  <!-- Live Stats Badge -->
  <div class="floating-stats" id="stats-badge">
    <span class="badge-dot"></span>
    <span id="word-count">Loading words...</span>
    <span style="color: #cbd5e1;">|</span>
    <span>Editable Document Mode</span>
  </div>

  <script>
    const STORAGE_KEY = "meshpay_report_saved_html_v3";
    const editor = document.getElementById("editor");
    const saveStatus = document.getElementById("save-status");
    const wordCountEl = document.getElementById("word-count");

    // Load saved edits if present
    window.addEventListener("DOMContentLoaded", () => {{
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {{
        editor.innerHTML = saved;
        saveStatus.innerHTML = '<span style="color: #059669;">●</span> Restored from Browser Storage';
      }}
      updateWordCount();
    }});

    // Format Commands
    function formatDoc(cmd, val = null) {{
      document.execCommand(cmd, false, val);
      editor.focus();
      triggerAutosave();
    }}

    function formatHeading(tag) {{
      if (tag === 'p') {{
        document.execCommand('formatBlock', false, 'p');
      }} else {{
        document.execCommand('formatBlock', false, tag);
      }}
      editor.focus();
      triggerAutosave();
    }}

    function highlightYellow() {{
      const selection = window.getSelection();
      if (!selection.rangeCount) return;
      document.execCommand('hiliteColor', false, '#fef08a');
      editor.focus();
      triggerAutosave();
    }}

    function insertPageBreak() {{
      const pb = '<div class="page-break" title="Page Break"></div><p><br></p>';
      document.execCommand('insertHTML', false, pb);
      editor.focus();
      triggerAutosave();
    }}

    function insertTableRow() {{
      const selection = window.getSelection();
      if (!selection.anchorNode) return;
      const td = selection.anchorNode.nodeType === 3 ? selection.anchorNode.parentElement.closest('td, th') : selection.anchorNode.closest('td, th');
      if (!td) {{
        alert("Please click inside a table cell first to insert a row.");
        return;
      }}
      const tr = td.closest('tr');
      const newTr = tr.cloneNode(true);
      Array.from(newTr.querySelectorAll('td, th')).forEach(c => c.innerHTML = '<div>&nbsp;</div>');
      tr.parentNode.insertBefore(newTr, tr.nextSibling);
      triggerAutosave();
    }}

    function deleteTableRow() {{
      const selection = window.getSelection();
      if (!selection.anchorNode) return;
      const td = selection.anchorNode.nodeType === 3 ? selection.anchorNode.parentElement.closest('td, th') : selection.anchorNode.closest('td, th');
      if (!td) {{
        alert("Please click inside a table cell first to delete a row.");
        return;
      }}
      const tr = td.closest('tr');
      if (tr.parentNode.children.length > 1) {{
        tr.remove();
        triggerAutosave();
      }} else {{
        alert("Cannot delete the only row in table.");
      }}
    }}

    // Autosave Debounced
    let saveTimeout = null;
    function triggerAutosave() {{
      saveStatus.innerHTML = '<span style="color: #f59e0b;">⏳</span> Saving changes...';
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {{
        localStorage.setItem(STORAGE_KEY, editor.innerHTML);
        const timeStr = new Date().toLocaleTimeString();
        saveStatus.innerHTML = `<span style="color: #059669;">●</span> Saved at ${{timeStr}}`;
        updateWordCount();
      }}, 1000);
    }}

    editor.addEventListener('input', triggerAutosave);

    function saveEditsManually() {{
      localStorage.setItem(STORAGE_KEY, editor.innerHTML);
      const timeStr = new Date().toLocaleTimeString();
      saveStatus.innerHTML = `<span style="color: #059669;">●</span> Saved manually at ${{timeStr}}`;
      alert("All edits saved successfully to local browser storage! Your changes are persisted across reloads.");
    }}

    function restoreOriginal() {{
      if (confirm("Are you sure you want to revert all manual edits and restore the original generated report?")) {{
        localStorage.removeItem(STORAGE_KEY);
        window.location.reload();
      }}
    }}

    function downloadEditedHtml() {{
      const clone = document.documentElement.cloneNode(true);
      // Remove any temporary alerts
      const blob = new Blob([clone.outerHTML], {{ type: 'text/html;charset=utf-8' }});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'PROJECT_REPORT_EDITABLE.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }}

    function updateWordCount() {{
      const text = editor.innerText || editor.textContent || "";
      const words = text.trim().split(/\\s+/).filter(w => w.length > 0).length;
      const pagesEstimate = Math.ceil(words / 450);
      wordCountEl.innerText = `${{words.toLocaleString()}} words (~${{pagesEstimate}} pages)`;
    }}
  </script>
</body>
</html>
"""

    with open(OUTPUT_HTML, "w", encoding="utf-8") as f:
        f.write(full_page)

    print(f"SUCCESS: Editable HTML generated at {OUTPUT_HTML} (Size: {os.path.getsize(OUTPUT_HTML)} bytes)")

if __name__ == "__main__":
    convert()

import io
import hashlib
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

class PDFService:
    @staticmethod
    def generate_chat_report(query_history: list) -> bytes:
        """Compile chat history and audit trails into a secure KSP report PDF."""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=54,
            bottomMargin=54
        )

        styles = getSampleStyleSheet()
        
        # Custom Premium Styles (KSP Navy and Gold branding)
        title_style = ParagraphStyle(
            name="KSPTitle",
            parent=styles["Title"],
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=26,
            textColor=colors.HexColor("#0A2540"), # Navy Blue
            spaceAfter=15
        )
        
        subtitle_style = ParagraphStyle(
            name="KSPSubtitle",
            parent=styles["Normal"],
            fontName="Helvetica-Oblique",
            fontSize=10,
            leading=12,
            textColor=colors.HexColor("#D4AF37"), # Gold/Bronze
            spaceAfter=25,
            alignment=1 # Center
        )

        heading_style = ParagraphStyle(
            name="KSPHeading",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=18,
            textColor=colors.HexColor("#0A2540"),
            spaceBefore=12,
            spaceAfter=8
        )

        meta_label_style = ParagraphStyle(
            name="MetaLabel",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9,
            textColor=colors.HexColor("#333333")
        )

        meta_val_style = ParagraphStyle(
            name="MetaVal",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=9,
            textColor=colors.HexColor("#555555")
        )

        query_style = ParagraphStyle(
            name="KSPQuery",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=14,
            textColor=colors.HexColor("#0B3C5D"),
            spaceBefore=10,
            spaceAfter=4
        )

        reply_style = ParagraphStyle(
            name="KSPReply",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=10,
            leading=13,
            textColor=colors.HexColor("#222222"),
            spaceAfter=12
        )

        hash_style = ParagraphStyle(
            name="KSPHash",
            parent=styles["Normal"],
            fontName="Courier",
            fontSize=7,
            textColor=colors.HexColor("#777777")
        )

        elements = []

        # 1. Header Title & Badge
        elements.append(Paragraph("KARNATAKA STATE POLICE", title_style))
        elements.append(Paragraph("State Crime Records Bureau (SCRB) • Confidential Investigation Log", subtitle_style))
        elements.append(Spacer(1, 10))

        # 2. Metadata Box
        report_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        meta_data = [
            [Paragraph("Report Type:", meta_label_style), Paragraph("Conversational Case Query Ledger", meta_val_style),
             Paragraph("Generated On:", meta_label_style), Paragraph(report_time, meta_val_style)],
            [Paragraph("Classification:", meta_label_style), Paragraph("CONFIDENTIAL // POLICE USE ONLY", meta_val_style),
             Paragraph("Log Code:", meta_label_style), Paragraph(f"KSP-LOG-{int(datetime.now().timestamp())}", meta_val_style)]
        ]
        
        meta_table = Table(meta_data, colWidths=[90, 180, 90, 180])
        meta_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F4F6F9")),
            ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#0A2540")),
            ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            ('TOPPADDING', (0,0), (-1,-1), 6),
        ]))
        elements.append(meta_table)
        elements.append(Spacer(1, 20))

        # 3. Investigation Ledger Heading
        elements.append(Paragraph("Intelligence Query History Ledger", heading_style))
        elements.append(Spacer(1, 10))

        # 4. Chat Logs Iteration
        for idx, chat in enumerate(query_history, 1):
            q_text = chat.get("query_text", "")
            r_text = chat.get("reply_text", "")
            timestamp = chat.get("timestamp", report_time)
            
            # Generate cryptographic verification hash for audit trail
            raw_hash_data = f"{q_text}{r_text}{timestamp}"
            ver_hash = hashlib.sha256(raw_hash_data.encode("utf-8")).hexdigest()

            elements.append(Paragraph(f"Query {idx} ({timestamp}):", query_style))
            elements.append(Paragraph(q_text, reply_style))
            elements.append(Paragraph(f"<b>Response:</b> {r_text}", reply_style))
            elements.append(Paragraph(f"Verification Ledger Hash: {ver_hash}", hash_style))
            elements.append(Spacer(1, 10))

        # 5. Footer Signature Block
        elements.append(Spacer(1, 30))
        sig_data = [
            ["", ""],
            ["_____________________________________", "_____________________________________"],
            ["SCRB Reviewing Executive Signature", "Investigator Signature & Seal"]
        ]
        sig_table = Table(sig_data, colWidths=[270, 270])
        sig_table.setStyle(TableStyle([
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('FONTNAME', (0,2), (-1,2), 'Helvetica-Bold'),
            ('FONTSIZE', (0,2), (-1,2), 9),
            ('TEXTCOLOR', (0,2), (-1,2), colors.HexColor("#333333")),
            ('TOPPADDING', (0,1), (-1,1), 40), # Space for signatures
        ]))
        elements.append(sig_table)

        # Build PDF
        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()

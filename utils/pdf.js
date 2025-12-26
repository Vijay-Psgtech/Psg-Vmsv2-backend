import PDFDocument from "pdfkit";


export function generateBadge(visitor, res) {
const doc = new PDFDocument({ size: "A6" });


res.setHeader("Content-Type", "application/pdf");
doc.pipe(res);


doc.fontSize(18).text("VISITOR PASS", { align: "center" });
doc.moveDown();


doc.fontSize(12).text(`Name: ${visitor.name}`);
doc.text(`Gate: ${visitor.gateId}`);
doc.text(`Time: ${new Date().toLocaleString()}`);


doc.end();
}
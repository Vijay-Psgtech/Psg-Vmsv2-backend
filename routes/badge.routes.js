import PDFDocument from "pdfkit";
import QRCode from "qrcode";

router.get("/:id", auth, async (req, res) => {
  const visitor = await Visitor.findById(req.params.id).populate("building");

  const qr = await QRCode.toDataURL(visitor._id.toString());

  const doc = new PDFDocument({ size: "A6" });
  res.setHeader("Content-Type", "application/pdf");
  doc.pipe(res);

  doc.fontSize(16).text("VISITOR PASS", { align: "center" });
  doc.moveDown();
  doc.fontSize(12).text(`Name: ${visitor.name}`);
  doc.text(`Building: ${visitor.building.name}`);
  doc.text(`Purpose: ${visitor.purpose}`);
  doc.moveDown();

  doc.image(qr, { width: 120, align: "center" });
  doc.end();
});

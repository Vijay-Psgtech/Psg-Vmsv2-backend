export const approveVisitor = async (req, res) => {
  const visitor = await Visitor.findOne({
    approvalToken: req.params.token,
    approvalExpiresAt: { $gt: new Date() },
  });

  if (!visitor) return res.send("Approval link expired or invalid");

  visitor.status = "APPROVED";
  visitor.approvedAt = new Date();
  visitor.approvalToken = null;

  visitor.history.push({
    action: "APPROVED",
    note: "Approved via email",
  });

  await visitor.save();

  // 📩 Notify Security + Visitor
  await sendFinalMail(visitor, true);

  res.send("Visitor Approved Successfully");
};
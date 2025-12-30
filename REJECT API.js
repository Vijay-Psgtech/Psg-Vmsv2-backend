export const rejectVisitor = async (req, res) => {
  const visitor = await Visitor.findOne({
    approvalToken: req.params.token,
  });

  if (!visitor) return res.send("Invalid link");

  visitor.status = "REJECTED";
  visitor.rejectionReason = "Rejected by host";
  visitor.approvalToken = null;

  visitor.history.push({
    action: "REJECTED",
    note: "Rejected via email",
  });

  await visitor.save();

  await sendFinalMail(visitor, false);

  res.send("Visitor Rejected");
};
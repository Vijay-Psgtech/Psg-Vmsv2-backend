export async function sendFinalMail(visitor, approved) {
  await transporter.sendMail({
    to: [
      visitor.email,
      "security@company.com",
    ],
    subject: approved ? "Visitor Approved" : "Visitor Rejected",
    html: `
      <h3>Visitor ${approved ? "Approved" : "Rejected"}</h3>
      <p><b>Name:</b> ${visitor.name}</p>
      <p><b>Gate:</b> ${visitor.gate}</p>
      <p><b>Status:</b> ${visitor.status}</p>
    `,
  });
}
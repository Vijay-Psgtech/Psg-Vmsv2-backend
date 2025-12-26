import express from "express";
const router = express.Router();

router.get("/", (req, res) => {
  res.json([
    { name: "Anita Rao", phone: "9566844908", department: "HR" },
    { name: "Karthik Kumar", phone: "8754885648", department: "IT" },
    { name: "Priya Singh", phone: "9876543333", department: "Finance" },
    { name: "Arjun Mehta", phone: "9876543444", department: "IT" },
    { name: "Divya Menon", phone: "9876543555", department: "Admin" },
  ]);
});

export default router;
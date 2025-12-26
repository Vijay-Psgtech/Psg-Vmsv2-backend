import express from "express";
const router = express.Router();

router.post("/", async (req, res) => {
  const { to, message } = req.body;

  console.log("📩 Notify:", to, message);

  res.json({ success: true });
});

export default router;
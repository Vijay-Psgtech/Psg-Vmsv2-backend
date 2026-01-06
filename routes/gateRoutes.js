import express from "express";
import Gate from "../models/Gate.js";
const router = express.Router();

router.get ("/", async (req, res) => {
  try{
    const gates = await Gate.find();
    res.json(gates);
  } catch (err) {
    console.log("Get gates error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;

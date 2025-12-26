import express from "express";
const router = express.Router();

router.get("/", (req, res) => {
  res.json([
    { _id: "b1", name: "Main Block" },
    { _id: "b2", name: "Admin Block" },
    { _id: "b3", name: "R&D Block" },
  ]);
});

export default router;

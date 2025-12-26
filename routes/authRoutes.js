import express from "express";
import {
  login,
  sendOtp,
  verifyOtp,
  resendOtp,
  register,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/login", login);
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);
router.post("/register", register);

export default router;


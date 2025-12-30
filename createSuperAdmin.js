// scripts/createSuperAdmin.js
// Run this script to create the first super admin account
// Usage: node scripts/createSuperAdmin.js

import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import readline from "readline";

dotenv.config();

// Simple User Schema (inline to avoid import issues)
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: String,
  role: { type: String, default: "superadmin" },
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: true },
  history: [
    {
      action: String,
      note: String,
      at: { type: Date, default: Date.now },
    },
  ],
}, { timestamps: true });

const User = mongoose.model("User", userSchema);

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function createSuperAdmin() {
  try {
    console.log("\n╔════════════════════════════════════════════════╗");
    console.log("║   🚀 VPASS - Super Admin Account Creator      ║");
    console.log("╚════════════════════════════════════════════════╝\n");

    // Connect to MongoDB
    console.log("📡 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    // Check if super admin already exists
    const existingSuperAdmin = await User.findOne({ role: "superadmin" });
    if (existingSuperAdmin) {
      console.log("⚠️  Super Admin already exists:");
      console.log(`   Name: ${existingSuperAdmin.name}`);
      console.log(`   Email: ${existingSuperAdmin.email}\n`);

      const overwrite = await question("Do you want to create another super admin? (yes/no): ");

      if (overwrite.toLowerCase() !== "yes") {
        console.log("\n❌ Operation cancelled");
        process.exit(0);
      }
    }

    // Get user input
    console.log("\n📝 Please provide the following information:\n");

    const name = await question("Full Name: ");
    if (!name.trim()) {
      console.log("❌ Name is required");
      process.exit(1);
    }

    const email = await question("Email: ");
    if (!email.trim() || !email.includes("@")) {
      console.log("❌ Valid email is required");
      process.exit(1);
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log(`❌ Email ${email} is already registered`);
      process.exit(1);
    }

    const phone = await question("Phone (optional): ");

    let password, confirmPassword;
    do {
      password = await question("Password (min 6 characters): ");
      if (password.length < 6) {
        console.log("❌ Password must be at least 6 characters");
        continue;
      }

      confirmPassword = await question("Confirm Password: ");
      if (password !== confirmPassword) {
        console.log("❌ Passwords do not match. Please try again.\n");
      }
    } while (password !== confirmPassword || password.length < 6);

    // Hash password
    console.log("\n🔒 Hashing password...");
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create super admin
    console.log("👤 Creating super admin account...");
    const superAdmin = await User.create({
      name,
      email,
      phone: phone || "",
      password: hashedPassword,
      role: "superadmin",
      isActive: true,
      isVerified: true,
      history: [
        {
          action: "ACCOUNT_CREATED",
          note: "Initial super admin account created via script",
          at: new Date(),
        },
      ],
    });

    console.log("\n╔════════════════════════════════════════════════╗");
    console.log("║   ✅ SUPER ADMIN CREATED SUCCESSFULLY!        ║");
    console.log("╚════════════════════════════════════════════════╝\n");

    console.log("📋 Account Details:");
    console.log(`   Name:  ${superAdmin.name}`);
    console.log(`   Email: ${superAdmin.email}`);
    console.log(`   Phone: ${superAdmin.phone || "Not provided"}`);
    console.log(`   Role:  Super Admin`);
    console.log(`   ID:    ${superAdmin._id}`);

    console.log("\n🔐 Login Credentials:");
    console.log(`   Email:    ${superAdmin.email}`);
    console.log(`   Password: [HIDDEN]`);

    console.log("\n🌐 Access URL:");
    console.log(`   http://localhost:5173/superadmin`);

    console.log("\n⚠️  Important Security Notes:");
    console.log("   1. Change your password after first login");
    console.log("   2. Enable two-factor authentication (if available)");
    console.log("   3. Never share your super admin credentials");
    console.log("   4. Use a strong, unique password");
    console.log("   5. Keep this account for emergency use only\n");

    await mongoose.disconnect();
    console.log("✅ Database connection closed\n");

    process.exit(0);
  } catch (err) {
    console.error("\n❌ Error creating super admin:", err.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Handle Ctrl+C gracefully
process.on("SIGINT", async () => {
  console.log("\n\n⚠️  Operation cancelled by user");
  await mongoose.disconnect();
  process.exit(0);
});

// Run the script
createSuperAdmin();
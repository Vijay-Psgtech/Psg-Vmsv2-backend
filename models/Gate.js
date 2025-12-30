import mongoose from "mongoose";

const gateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, unique: true }, // e.g., "GATE-1", "GATE-2"
});

export default mongoose.model("Gate", gateSchema);
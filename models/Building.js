import mongoose from "mongoose";

const buildingSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, unique: true },
});

export default mongoose.model("Building", buildingSchema);

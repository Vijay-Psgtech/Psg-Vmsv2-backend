import mongoose from "mongoose";

const departmentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    code: { type: String, unique: true },
    description: { type: String },
});

export default mongoose.model("Department", departmentSchema);
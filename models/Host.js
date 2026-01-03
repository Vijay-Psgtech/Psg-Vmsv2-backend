import mongoose from "mongoose";

const hostSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String },
    department: { type: String },
});

export default mongoose.model("Host", hostSchema);
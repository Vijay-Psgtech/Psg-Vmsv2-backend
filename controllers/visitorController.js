import Visitor from "../models/Visitor.js";

export const getVisitors = async (req, res) => {
  try {
    const visitors = await Visitor.find().sort({ createdAt: -1 });
    res.json(visitors);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const checkInVisitor = async (req, res) => {
  try {
    const visitor = await Visitor.create({
      ...req.body,
      status: "IN",
      checkInTime: new Date(),
    });

    res.status(201).json(visitor);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const checkOutVisitor = async (req, res) => {
  try {
    const visitor = await Visitor.findByIdAndUpdate(
      req.params.id,
      {
        status: "OUT",
        checkOutTime: new Date(),
      },
      { new: true, runValidators: true }
    );

    if (!visitor) {
      return res.status(404).json({ message: "Visitor not found" });
    }

    res.json(visitor);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

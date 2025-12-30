import Visitor from "../models/Visitor.js";
import Notification from "../models/Notification.js"; // if you have one
import User from "../models/User.js";

export async function notifyOverstay() {
  const overstays = await Visitor.find({
    status: "IN",
    allowedUntil: { $lt: new Date() },
    overstayNotified: { $ne: true },
  });

  for (const v of overstays) {
    const hostUser = await User.findById(v.host);

    if (hostUser) {
      await Notification.create({
        userId: hostUser._id,
        title: "Visitor Overstay Alert",
        message: `${v.name} has overstayed at gate ${v.gate}`,
        severity: "HIGH",
      });
    }

    v.overstayNotified = true;
    await v.save();
  }
}
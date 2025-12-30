import Visitor from "../models/Visitor.js";
import Alert from "../models/Alert.js";

export const startOverstayWatcher = (io) => {
  // Check every minute
  setInterval(async () => {
    try {
      const now = new Date();

      const overstayVisitors = await Visitor.find({
        status: "IN",
        allowedUntil: { $lt: now },
        overstayNotified: false,
      });

      for (const visitor of overstayVisitors) {
        const overstayMs = now - visitor.allowedUntil;
        const overstayMinutes = Math.floor(overstayMs / 60000);

        let severity = "LOW";
        if (overstayMinutes >= 120) severity = "CRITICAL";
        else if (overstayMinutes >= 60) severity = "HIGH";
        else if (overstayMinutes >= 30) severity = "MEDIUM";

        const alert = await Alert.create({
          type: "OVERSTAY",
          severity,
          visitor: visitor._id,
          title: `Overstay Alert - ${visitor.name}`,
          message: `Visitor ${visitor.name} (ID: ${visitor.visitorId}) has overstayed by ${overstayMinutes} minutes at Gate ${visitor.gate}`,
          gate: visitor.gate,
        });

        visitor.status = "OVERSTAY";
        visitor.overstayNotified = true;
        visitor.overstayAlertSentAt = now;
        visitor.overstayMinutes = overstayMinutes;
        visitor.history.push({
          action: "OVERSTAY_DETECTED",
          at: now,
          note: `${overstayMinutes} minutes`,
        });

        await visitor.save();

        // Real-time updates
        io.emit("alert:new", alert);
        io.emit("visitors:update", await Visitor.find().sort({ createdAt: -1 }).limit(100));

        console.log(`⚠️ OVERSTAY: ${visitor.name} (${severity}) - ${overstayMinutes}min`);
      }
    } catch (err) {
      console.error("❌ Overstay watcher error:", err);
    }
  }, 60000);

  console.log("✅ Overstay watcher started");
};
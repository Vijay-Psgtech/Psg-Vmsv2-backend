router.get("/summary", requireRole("admin"), async (req, res) => {
  const today = new Date();
  today.setHours(0,0,0,0);

  const totalToday = await Visitor.countDocuments({
    createdAt: { $gte: today }
  });

  const inside = await Visitor.countDocuments({ status: "checked-in" });

  const avgDuration = await Visitor.aggregate([
    { $match: { checkOutTime: { $ne: null } } },
    {
      $project: {
        duration: {
          $divide: [
            { $subtract: ["$checkOutTime", "$checkInTime"] },
            60000
          ]
        }
      }
    },
    { $group: { _id: null, avg: { $avg: "$duration" } } }
  ]);

  res.json({ totalToday, inside, avgDuration: avgDuration[0]?.avg || 0 });
});

export function makeDailyRevenue(days = 14) {
  const out = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push({
      date: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      revenue: Math.round(20000 + Math.random() * 80000),
      orders: Math.round(20 + Math.random() * 180),
    });
  }
  return out;
}

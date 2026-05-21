const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();

app.use(express.json({ limit: "10mb" }));

// ==========================================
// CONFIG
// ==========================================
const PORT = process.env.PORT || 3000;

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
  console.log("❌ Missing ENV variables");
  process.exit(1);
}

// ==========================================
// ROOT
// ==========================================
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    owner: "VRIXO",
    message: "🚀 VRIXO WhatsApp Ultra API Running",
    version: "ULTIMATE GOD LEVEL V9",
    timestamp: new Date(),
  });
});

// ==========================================
// HEALTH CHECK
// ==========================================
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "online",
    uptime: process.uptime(),
    serverTime: new Date(),
  });
});

// ==========================================
// SEND MESSAGE
// ==========================================
app.post("/send-message", async (req, res) => {
  try {
    let { number, message } = req.body;

    // ==========================
    // VALIDATION
    // ==========================
    if (!number || !message) {
      return res.status(400).json({
        success: false,
        message: "Number and message required",
      });
    }

    // ==========================
    // CLEAN NUMBER
    // ==========================
    number = number
      .toString()
      .replace(/\s+/g, "")
      .replace(/\+/g, "")
      .replace(/-/g, "");

    // ==========================
    // INDIA FIX
    // ==========================
    if (!number.startsWith("91")) {
      number = "91" + number;
    }

    // ==========================
    // SEND WHATSAPP MESSAGE
    // ==========================
    const whatsappResponse = await axios({
      method: "POST",
      url: `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`,
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      data: {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: number,
        type: "text",
        text: {
          preview_url: false,
          body: message,
        },
      },
    });

    // ==========================
    // SUCCESS
    // ==========================
    return res.status(200).json({
      success: true,
      brand: "VRIXO",
      message: "🔥 Message Sent Successfully",
      sentTo: number,
      response: whatsappResponse.data,
    });
  } catch (error) {
    console.log("❌ ERROR:", error.response?.data || error.message);

    return res.status(500).json({
      success: false,
      error:
        error.response?.data ||
        error.message ||
        "Unknown server error",
    });
  }
});

// ==========================================
// 404 HANDLER
// ==========================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// ==========================================
// START SERVER
// ==========================================
app.listen(PORT, () => {
  console.log(`
🔥 =====================================
🚀 VRIXO WHATSAPP API STARTED
🌍 PORT: ${PORT}
⚡ STATUS: ONLINE
=====================================
  `);
});

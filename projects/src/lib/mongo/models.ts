import mongoose, { Schema, Document, Model } from "mongoose";

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/vrixo";

export async function connectMongo() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  return mongoose.connect(uri, { dbName: process.env.MONGODB_DB || "vrixo" });
}

export interface IDeliveryLog extends Document {
  orderId: string;
  trackingId?: string;
  carrier?: string;
  status: string;
  eta?: Date;
  location?: { lat?: number; lng?: number; label?: string };
  raw?: any;
  createdAt: Date;
}

const DeliveryLogSchema = new Schema<IDeliveryLog>(
  {
    orderId: { type: String, required: true, index: true },
    trackingId: { type: String },
    carrier: { type: String },
    status: { type: String, required: true },
    eta: { type: Date },
    location: { type: Schema.Types.Mixed },
    raw: { type: Schema.Types.Mixed }
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

export const DeliveryLog: Model<IDeliveryLog> = mongoose.models.DeliveryLog || mongoose.model("DeliveryLog", DeliveryLogSchema);

export interface IWhatsAppAttempt extends Document {
  orderId: string;
  attempt: number;
  status: string;
  error?: string;
  response?: any;
  createdAt: Date;
}

const WhatsAppAttemptSchema = new Schema<IWhatsAppAttempt>(
  {
    orderId: { type: String, required: true, index: true },
    attempt: { type: Number, required: true },
    status: { type: String, required: true },
    error: { type: String },
    response: { type: Schema.Types.Mixed }
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

export const WhatsAppAttempt: Model<IWhatsAppAttempt> = mongoose.models.WhatsAppAttempt || mongoose.model("WhatsAppAttempt", WhatsAppAttemptSchema);

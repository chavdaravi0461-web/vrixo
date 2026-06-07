import PDFDocument from "pdfkit";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

type InvoiceItem = {
  title: string;
  quantity?: number;
  price: number;
};

export async function generateInvoicePdfBuffer({ orderNumber, customerName, items, total, issuedAt }: { orderNumber: string; customerName: string; items: InvoiceItem[]; total: number; issuedAt?: string }) {
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  doc.on("end", () => {});

  // Header
  doc.fontSize(20).text("VRIXO", { align: "left" });
  doc.fontSize(10).text(`Invoice #: ${orderNumber}`, { align: "right" });
  doc.moveDown();
  doc.fontSize(12).text(`Billed To: ${customerName}`);
  doc.moveDown();

  doc.fontSize(12).text("Items:");
  items.forEach((it) => {
    doc.fontSize(10).text(`${it.title} x${it.quantity} — ₹${it.price * (it.quantity ?? 1)}`);
  });

  doc.moveDown();
  doc.fontSize(12).text(`Total: ₹${total}`);
  doc.moveDown();
  doc.fontSize(9).text(`Issued: ${issuedAt ?? new Date().toISOString()}`);

  doc.end();

  await new Promise((resolve) => doc.on("end", resolve));
  return Buffer.concat(chunks);
}

export async function uploadInvoiceToS3(buffer: Buffer, key: string) {
  const bucket = process.env.INVOICE_S3_BUCKET;
  if (!bucket) throw new Error("INVOICE_S3_BUCKET not configured");

  const region = process.env.AWS_REGION ?? "ap-south-1";
  const client = new S3Client({ region });
  const command = new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: "application/pdf", ACL: "private" });
  await client.send(command);
  const url = `https://${bucket}.s3.${region}.amazonaws.com/${encodeURIComponent(key)}`;
  return url;
}

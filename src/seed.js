import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User, Item } from "./models.js";
export async function seed({ adminEmail, adminPassword, demoPassword } = {}) {
  if (
    !adminEmail ||
    !adminPassword ||
    adminPassword.length < 10 ||
    !demoPassword ||
    demoPassword.length < 10
  )
    throw new Error(
      "Set ADMIN_EMAIL, ADMIN_PASSWORD and DEMO_PASSWORD (10+ characters).",
    );
  let admin = await User.findOne({ email: adminEmail });
  if (!admin)
    admin = await User.create({
      name: "Campus Administrator",
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 12),
      role: "admin",
    });
  let student = await User.findOne({ email: "student@example.com" });
  if (!student)
    student = await User.create({
      name: "Demo Student",
      email: "student@example.com",
      passwordHash: await bcrypt.hash(demoPassword, 12),
    });
  const records = [
    [
      "Sony wireless headphones",
      "Electronics",
      "Library",
      "found",
      "Black over-ear headphones found near the reading tables.",
    ],
    [
      "Blue canvas backpack",
      "Bags",
      "Academic Block",
      "lost",
      "Navy canvas backpack with a small mountain patch on the front pocket.",
    ],
    [
      "Student ID card",
      "Cards & IDs",
      "Cafeteria",
      "found",
      "Student identification card handed in near the cafeteria counter.",
    ],
    [
      "Silver key ring",
      "Keys",
      "Hostel",
      "found",
      "A silver ring with multiple keys found near the hostel entrance.",
    ],
    [
      "Calculus notebook",
      "Books",
      "Library",
      "lost",
      "A spiral notebook containing handwritten calculus notes and blue page tabs.",
    ],
    [
      "Steel water bottle",
      "Accessories",
      "Sports Complex",
      "found",
      "A reusable steel bottle left beside the indoor court seating area.",
    ],
    [
      "Olive green hoodie",
      "Clothing",
      "Auditorium",
      "lost",
      "Olive green pullover hoodie with a small white logo on the sleeve.",
    ],
    [
      "White charging adapter",
      "Electronics",
      "Academic Block",
      "found",
      "A white USB-C wall adapter found after the afternoon class.",
    ],
    [
      "Black reading glasses",
      "Accessories",
      "Library",
      "lost",
      "Rectangular reading glasses inside a hard black case.",
    ],
    [
      "Brown leather wallet",
      "Accessories",
      "Campus Grounds",
      "found",
      "A compact brown wallet found along the main campus walkway.",
    ],
    [
      "USB-C adapter",
      "Electronics",
      "Library",
      "lost",
      "A white charging adapter with a small label on its side.",
    ],
    [
      "Badminton racket bag",
      "Bags",
      "Sports Complex",
      "lost",
      "A dark racket bag with a bright orange zip and shoulder strap.",
    ],
  ];
  for (let i = 0; i < records.length; i++) {
    const [name, category, location, type, description] = records[i];
    if (!(await Item.exists({ sample: true, name }))) {
      const date = new Date();
      date.setUTCDate(date.getUTCDate() - (i % 6));
      await Item.create({
        name,
        category,
        location,
        type,
        description,
        date,
        type,
        owner: i % 3 === 0 ? student._id : admin._id,
        sample: true,
      });
    }
  }
  return { admin, student };
}
if (process.argv[1]?.endsWith("seed.js")) {
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    await seed({
      adminEmail: process.env.ADMIN_EMAIL,
      adminPassword: process.env.ADMIN_PASSWORD,
      demoPassword: process.env.DEMO_PASSWORD,
    });
    console.log(
      "Seed complete: 12 clearly marked demonstration items. Existing records preserved.",
    );
  } finally {
    await mongoose.disconnect();
  }
}

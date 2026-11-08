import mongoose from "mongoose";
const { Schema, model } = mongoose;
const text = (max, extra = {}) => ({
  type: String,
  trim: true,
  maxlength: max,
  ...extra,
});
export const CATEGORIES = [
  "Electronics",
  "Cards & IDs",
  "Bags",
  "Keys",
  "Books",
  "Clothing",
  "Accessories",
  "Other",
];
export const LOCATIONS = [
  "Library",
  "Academic Block",
  "Cafeteria",
  "Hostel",
  "Sports Complex",
  "Auditorium",
  "Campus Grounds",
  "Other",
];
const userSchema = new Schema(
  {
    name: text(80, { required: true }),
    email: text(160, { required: true, unique: true, lowercase: true }),
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["student", "admin"], default: "student" },
  },
  { timestamps: true },
);
const itemSchema = new Schema(
  {
    name: text(100, { required: true }),
    description: text(1500, { required: true, minlength: 10 }),
    category: { type: String, enum: CATEGORIES, required: true },
    location: { type: String, enum: LOCATIONS, required: true },
    date: { type: Date, required: true },
    type: { type: String, enum: ["lost", "found"], required: true },
    status: {
      type: String,
      enum: ["open", "recovered", "closed"],
      default: "open",
    },
    image: { type: Buffer, select: false },
    imageType: String,
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sample: { type: Boolean, default: false },
  },
  { timestamps: true },
);
itemSchema.index({ createdAt: -1 });
itemSchema.index({ type: 1, category: 1, location: 1, status: 1 });
const claimSchema = new Schema(
  {
    item: { type: Schema.Types.ObjectId, ref: "Item", required: true },
    claimant: { type: Schema.Types.ObjectId, ref: "User", required: true },
    evidence: text(1500, { required: true, minlength: 15 }),
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    reviewNote: text(500),
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
claimSchema.index({ item: 1, claimant: 1 }, { unique: true });
export const User = model("User", userSchema);
export const Item = model("Item", itemSchema);
export const Claim = model("Claim", claimSchema);

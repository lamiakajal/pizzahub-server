import { Router } from "express";
import mongoose from "mongoose";

const router = Router();

router.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "PizzaHub API is running",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

export default router;

import cors from "cors";
import express from "express";
import { connectDB } from "./config/db";
import { env } from "./config/env";
import { errorHandler, notFound } from "./middleware/errorHandler";
import adminMenuItemsRouter from "./routes/adminMenuItems";
import adminOverviewRouter from "./routes/adminOverview";
import adminTransactionsRouter from "./routes/adminTransactions";
import adminUsersRouter from "./routes/adminUsers";
import customerOrdersRouter from "./routes/customerOrders";
import healthRouter from "./routes/health";
import meRouter from "./routes/me";
import { stripeWebhookHandler } from "./routes/stripeWebhook";
import menuItemsRouter from "./routes/menuItems";
import { customerOverviewRouter, vendorOverviewRouter } from "./routes/overview";
import vendorOrdersRouter from "./routes/vendorOrders";
import vendorSubscriptionRouter from "./routes/vendorSubscription";
import vendorMenuItemsRouter from "./routes/vendorMenuItems";

const app = express();

app.use(
  cors({
    origin: env.clientUrls,
    credentials: true,
  })
);

// Serverless hosts skip server.ts, so connect on the first request (cached after that).
app.use(async (_req, _res, next) => {
  await connectDB();
  next();
});

// Stripe signature check needs the raw body, so this goes before express.json().
app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), stripeWebhookHandler);

app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ success: true, message: "PizzaHub API is running" });
});

app.use("/api/health", healthRouter);
app.use("/api/me", meRouter);
app.use("/api/menu-items", menuItemsRouter);
app.use("/api/vendor/menu-items", vendorMenuItemsRouter);
app.use("/api/admin/menu-items", adminMenuItemsRouter);
app.use("/api/admin/users", adminUsersRouter);
app.use("/api/admin/transactions", adminTransactionsRouter);
app.use("/api/admin/overview", adminOverviewRouter);
app.use("/api/customer/orders", customerOrdersRouter);
app.use("/api/vendor/orders", vendorOrdersRouter);
app.use("/api/customer/overview", customerOverviewRouter);
app.use("/api/vendor/overview", vendorOverviewRouter);
app.use("/api/vendor/subscription", vendorSubscriptionRouter);

app.use(notFound);
app.use(errorHandler);

export default app;

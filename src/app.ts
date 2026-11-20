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

// Serverless hosts load this file without running server.ts, so the database
// connection is opened on the first request. The connection is cached, so
// later requests pass straight through.
app.use(async (_req, _res, next) => {
  await connectDB();
  next();
});

// The Stripe webhook needs the raw body to check the signature,
// so it must be registered before express.json().
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

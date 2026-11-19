import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { errorHandler, notFound } from "./middleware/errorHandler";
import adminMenuItemsRouter from "./routes/adminMenuItems";
import customerOrdersRouter from "./routes/customerOrders";
import healthRouter from "./routes/health";
import meRouter from "./routes/me";
import menuItemsRouter from "./routes/menuItems";
import { customerOverviewRouter, vendorOverviewRouter } from "./routes/overview";
import vendorOrdersRouter from "./routes/vendorOrders";
import vendorMenuItemsRouter from "./routes/vendorMenuItems";

const app = express();

app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  })
);

app.use(express.json());

app.use("/api/health", healthRouter);
app.use("/api/me", meRouter);
app.use("/api/menu-items", menuItemsRouter);
app.use("/api/vendor/menu-items", vendorMenuItemsRouter);
app.use("/api/admin/menu-items", adminMenuItemsRouter);
app.use("/api/customer/orders", customerOrdersRouter);
app.use("/api/vendor/orders", vendorOrdersRouter);
app.use("/api/customer/overview", customerOverviewRouter);
app.use("/api/vendor/overview", vendorOverviewRouter);

app.use(notFound);
app.use(errorHandler);

export default app;

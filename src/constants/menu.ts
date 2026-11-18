export const MENU_CATEGORIES = [
  "Classic Pizzas",
  "Vegetarian Pizzas",
  "Meat Lovers",
  "Specialty / Gourmet Pizzas",
  "Sides & Appetizers",
  "Beverages & Desserts",
] as const;
export type MenuCategory = (typeof MENU_CATEGORIES)[number];

// "inactive" means the vendor has paused an approved item.
export const MENU_ITEM_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "inactive",
] as const;
export type MenuItemStatus = (typeof MENU_ITEM_STATUSES)[number];

// Free vendors may keep at most this many active (approved) items.
export const FREE_PLAN_ITEM_LIMIT = 3;

// Items in these statuses count toward the free plan limit.
export const ACTIVE_MENU_STATUSES: MenuItemStatus[] = ["pending", "approved"];

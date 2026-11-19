import { MENU_CATEGORIES, type MenuCategory } from "../constants/menu";
import { ApiError } from "./ApiError";

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

// Images must come from ImgBB, which is where our upload route sends them.
const ALLOWED_IMAGE_HOSTS = ["ibb.co", "ibb.co.com"];

export function requireObjectId(value: unknown, label = "id"): string {
  if (typeof value !== "string" || !OBJECT_ID_PATTERN.test(value)) {
    throw new ApiError(400, `Invalid ${label}`);
  }
  return value;
}

export function readText(value: unknown, label: string, min: number, max: number) {
  if (typeof value !== "string") throw new ApiError(400, `${label} is required`);
  const text = value.trim();
  if (text.length < min || text.length > max) {
    throw new ApiError(400, `${label} must be between ${min} and ${max} characters`);
  }
  return text;
}

// Optional free text: empty is fine, too long is not.
export function readOptionalText(value: unknown, label: string, max: number) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") throw new ApiError(400, `${label} must be text`);
  const text = value.trim();
  if (text.length > max) throw new ApiError(400, `${label} must be ${max} characters or fewer`);
  return text;
}

function readPrice(value: unknown) {
  const number = typeof value === "string" ? Number(value) : value;
  if (
    typeof number !== "number" ||
    !Number.isFinite(number) ||
    number <= 0 ||
    number > 10000
  ) {
    throw new ApiError(400, "Price must be a number greater than 0 and at most 10000");
  }
  return Math.round(number * 100) / 100;
}

function readCategory(value: unknown): MenuCategory {
  if (!MENU_CATEGORIES.includes(value as MenuCategory)) {
    throw new ApiError(400, "Please choose a valid category");
  }
  return value as MenuCategory;
}

function readImages(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 4) {
    throw new ApiError(400, "Add between 1 and 4 images");
  }

  return value.map((entry) => {
    if (typeof entry !== "string" || entry.length > 500) {
      throw new ApiError(400, "Image URL is invalid");
    }

    let url: URL;
    try {
      url = new URL(entry);
    } catch {
      throw new ApiError(400, "Image URL is invalid");
    }

    const allowed =
      url.protocol === "https:" &&
      ALLOWED_IMAGE_HOSTS.some(
        (host) => url.hostname === host || url.hostname.endsWith(`.${host}`)
      );
    if (!allowed) {
      throw new ApiError(400, "Images must be uploaded through PizzaHub");
    }
    return url.toString();
  });
}

export type MenuItemInput = {
  itemName: string;
  category: MenuCategory;
  description: string;
  price: number;
  location: string;
  images: string[];
};

// Reads only the fields a vendor may set. Anything else in the body
// (status, vendorId, ...) is ignored, so it can never be injected.
export function parseMenuItemInput(body: unknown, partial = false): Partial<MenuItemInput> {
  if (!body || typeof body !== "object") {
    throw new ApiError(400, "Request body is required");
  }

  const data = body as Record<string, unknown>;
  const wants = (key: string) => !partial || data[key] !== undefined;
  const input: Partial<MenuItemInput> = {};

  if (wants("itemName")) input.itemName = readText(data.itemName, "Item name", 2, 80);
  if (wants("category")) input.category = readCategory(data.category);
  if (wants("description")) input.description = readText(data.description, "Description", 10, 1000);
  if (wants("price")) input.price = readPrice(data.price);
  if (wants("location")) input.location = readText(data.location, "Location", 2, 100);
  if (wants("images")) input.images = readImages(data.images);

  return input;
}

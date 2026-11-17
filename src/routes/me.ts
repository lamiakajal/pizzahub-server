import { Router } from "express";
import { authenticate } from "../middleware/authenticate";

const router = Router();

// Returns the verified user. Handy for testing the token flow end to end.
router.get("/", authenticate, (req, res) => {
  res.json({ success: true, data: req.user });
});

export default router;

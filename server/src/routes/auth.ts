import { Router } from "express";
import { googleAuth, adminLogin, createAdmin, changePassword, authenticate } from "../middleware/auth";
import { adminGuard } from "../middleware/adminGuard";

const router = Router();

// Mobile apps — Google sign-in
router.post("/google", googleAuth);

// Admin panel — email + password login
router.post("/admin/login", adminLogin);

// Create new admin account (super_admin only)
router.post("/admin/register", authenticate, adminGuard, createAdmin);

// Change password (authenticated admin)
router.patch("/admin/password", authenticate, adminGuard, changePassword);

export default router;

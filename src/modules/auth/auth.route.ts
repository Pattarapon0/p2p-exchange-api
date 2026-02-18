import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { loginController, loginSchema, registerController, registerSchema } from "./auth.controller.js";

export const authRoute = new Hono();

authRoute.post("/register", zValidator("json", registerSchema), registerController);
authRoute.post("/login", zValidator("json", loginSchema), loginController);

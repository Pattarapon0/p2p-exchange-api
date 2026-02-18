import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { assets, users, wallets } from "../../db/schema.js";
import { AppError } from "../../lib/errors.js";
import { signToken } from "../../lib/jwt.js";
import { comparePassword, hashPassword } from "../../lib/password.js";

type RegisterInput = {
  email: string;
  password: string;
};

type LoginInput = {
  email: string;
  password: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function register(input: RegisterInput) {
  const email = normalizeEmail(input.email);
  if (input.password.length < 8) {
    throw new AppError(400, "Password must be at least 8 characters");
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (existing) {
    throw new AppError(409, "Email already exists");
  }

  const passwordHash = await hashPassword(input.password);

  const createdUser = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(users)
      .values({
        email,
        passwordHash,
      })
      .returning();

    if (!created) {
      throw new AppError(500, "Failed to create user");
    }

    const activeAssets = await tx.query.assets.findMany({
      where: eq(assets.isActive, true),
    });

    if (activeAssets.length === 0) {
      throw new AppError(500, "No assets configured in system");
    }

    await tx.insert(wallets).values(
      activeAssets.map((asset) => ({
        userId: created.id,
        assetId: asset.id,
        availableBalance: 0,
        lockedBalance: 0,
      })),
    );

    return created;
  });

  const token = signToken({
    userId: createdUser.id,
    email: createdUser.email,
  });

  return {
    user: {
      id: createdUser.id,
      email: createdUser.email,
      status: createdUser.status,
    },
    token,
  };
}

export async function login(input: LoginInput) {
  const email = normalizeEmail(input.email);
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (!user) {
    throw new AppError(401, "Invalid email or password");
  }

  const ok = await comparePassword(input.password, user.passwordHash);
  if (!ok) {
    throw new AppError(401, "Invalid email or password");
  }

  const token = signToken({
    userId: user.id,
    email: user.email,
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      status: user.status,
    },
    token,
  };
}

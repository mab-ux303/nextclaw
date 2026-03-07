import { Hono } from "hono";
import { cors } from "hono/cors";

type Env = {
  DASHSCOPE_API_KEY?: string;
  DASHSCOPE_API_BASE?: string;
  AUTH_TOKEN_SECRET?: string;
  GLOBAL_FREE_USD_LIMIT?: string;
  DEFAULT_USER_FREE_USD_LIMIT?: string;
  REQUEST_FLAT_USD_PER_REQUEST?: string;
  ALLOW_SELF_SIGNUP?: string;
  NEXTCLAW_PLATFORM_DB: D1Database;
};

type SupportedModelSpec = {
  id: string;
  upstreamModel: string;
  displayName: string;
  inputUsdPer1M: number;
  outputUsdPer1M: number;
};

type ChatCompletionRequest = {
  model: string;
  messages: Array<Record<string, unknown>>;
  stream?: boolean;
  max_tokens?: number;
  max_completion_tokens?: number;
  [key: string]: unknown;
};

type UsageCounters = {
  promptTokens: number;
  completionTokens: number;
};

type UserRole = "admin" | "user";

type SessionTokenPayload = {
  sub: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
};

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  password_salt: string;
  role: UserRole;
  free_limit_usd: number;
  free_used_usd: number;
  paid_balance_usd: number;
  created_at: string;
  updated_at: string;
};

type UserPublicView = {
  id: string;
  email: string;
  role: UserRole;
  freeLimitUsd: number;
  freeUsedUsd: number;
  freeRemainingUsd: number;
  paidBalanceUsd: number;
  createdAt: string;
  updatedAt: string;
};

type RechargeIntentRow = {
  id: string;
  user_id: string;
  amount_usd: number;
  status: "pending" | "confirmed" | "rejected";
  note: string | null;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
  confirmed_by_user_id: string | null;
  rejected_at: string | null;
  rejected_by_user_id: string | null;
};

type LedgerRow = {
  id: string;
  user_id: string;
  kind: string;
  amount_usd: number;
  free_amount_usd: number;
  paid_amount_usd: number;
  model: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  request_id: string | null;
  note: string | null;
  created_at: string;
};

type BillingSnapshot = {
  user: UserRow;
  globalFreeLimitUsd: number;
  globalFreeUsedUsd: number;
};

type ChargeSplit = {
  totalCostUsd: number;
  freePartUsd: number;
  paidPartUsd: number;
};

type ChargeResult =
  | {
    ok: true;
    split: ChargeSplit;
    snapshot: BillingSnapshot;
  }
  | {
    ok: false;
    reason: "insufficient_quota";
    snapshot: BillingSnapshot;
  };

const DEFAULT_DASHSCOPE_API_BASE = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const DEFAULT_GLOBAL_FREE_USD_LIMIT = 20;
const DEFAULT_USER_FREE_USD_LIMIT = 2;
const DEFAULT_REQUEST_FLAT_USD_PER_REQUEST = 0.0002;
const DEFAULT_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
const PASSWORD_HASH_ITERATIONS = 120_000;

const SUPPORTED_MODELS: SupportedModelSpec[] = [
  {
    id: "dashscope/qwen3.5-plus",
    upstreamModel: "qwen3.5-plus",
    displayName: "Qwen3.5 Plus",
    inputUsdPer1M: 0.8,
    outputUsdPer1M: 2.4
  },
  {
    id: "dashscope/qwen3.5-flash",
    upstreamModel: "qwen3.5-flash",
    displayName: "Qwen3.5 Flash",
    inputUsdPer1M: 0.2,
    outputUsdPer1M: 0.6
  },
  {
    id: "dashscope/qwen3.5-397b-a17b",
    upstreamModel: "qwen3.5-397b-a17b",
    displayName: "Qwen3.5 397B A17B",
    inputUsdPer1M: 1.2,
    outputUsdPer1M: 3.6
  },
  {
    id: "dashscope/qwen3.5-122b-a10b",
    upstreamModel: "qwen3.5-122b-a10b",
    displayName: "Qwen3.5 122B A10B",
    inputUsdPer1M: 0.6,
    outputUsdPer1M: 1.8
  },
  {
    id: "dashscope/qwen3.5-35b-a3b",
    upstreamModel: "qwen3.5-35b-a3b",
    displayName: "Qwen3.5 35B A3B",
    inputUsdPer1M: 0.35,
    outputUsdPer1M: 1.05
  },
  {
    id: "dashscope/qwen3.5-27b",
    upstreamModel: "qwen3.5-27b",
    displayName: "Qwen3.5 27B",
    inputUsdPer1M: 0.28,
    outputUsdPer1M: 0.84
  }
];

const MODEL_MAP = new Map<string, SupportedModelSpec>(SUPPORTED_MODELS.map((model) => [model.id, model]));
const bootstrapReady = new WeakMap<D1Database, Promise<void>>();

const app = new Hono<{ Bindings: Env }>();

app.use("/platform/*", cors({
  origin: "*",
  allowHeaders: ["Authorization", "Content-Type"],
  allowMethods: ["GET", "POST", "PATCH", "OPTIONS"]
}));

app.use("/v1/*", cors({
  origin: "*",
  allowHeaders: ["Authorization", "Content-Type"],
  allowMethods: ["GET", "POST", "OPTIONS"]
}));

app.get("/health", async (c) => {
  await ensurePlatformBootstrap(c.env);
  return c.json({
    ok: true,
    data: {
      status: "ok",
      service: "nextclaw-provider-gateway-api",
      authRequired: true,
      billingMode: "usd-only"
    }
  });
});

app.get("/v1/models", (c) => {
  return c.json({
    object: "list",
    data: SUPPORTED_MODELS.map((model) => ({
      id: model.id,
      object: "model",
      created: 0,
      owned_by: "nextclaw",
      display_name: model.displayName
    }))
  });
});

app.post("/platform/auth/register", async (c) => {
  await ensurePlatformBootstrap(c.env);
  if (!allowSelfSignup(c.env)) {
    return apiError(c, 403, "SELF_SIGNUP_DISABLED", "Self signup is disabled.");
  }

  const body = await readJson(c);
  const email = normalizeEmail(readString(body, "email"));
  const password = readString(body, "password");

  if (!email || !isValidEmail(email)) {
    return apiError(c, 400, "INVALID_EMAIL", "A valid email is required.");
  }
  if (!isStrongPassword(password)) {
    return apiError(c, 400, "WEAK_PASSWORD", "Password must be at least 8 characters.");
  }

  const existing = await getUserByEmail(c.env.NEXTCLAW_PLATFORM_DB, email);
  if (existing) {
    return apiError(c, 409, "EMAIL_EXISTS", "This email is already registered.");
  }

  const now = new Date().toISOString();
  const usersCount = await countUsers(c.env.NEXTCLAW_PLATFORM_DB);
  const role: UserRole = usersCount === 0 ? "admin" : "user";
  const passwordDigest = await hashPassword(password);
  const id = crypto.randomUUID();

  const inserted = await c.env.NEXTCLAW_PLATFORM_DB.prepare(
    `INSERT INTO users (
      id, email, password_hash, password_salt, role,
      free_limit_usd, free_used_usd, paid_balance_usd,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`
  )
    .bind(
      id,
      email,
      passwordDigest.hash,
      passwordDigest.salt,
      role,
      getDefaultUserFreeLimit(c.env),
      now,
      now
    )
    .run();

  if (!inserted.success) {
    return apiError(c, 500, "REGISTER_FAILED", "Failed to create user.");
  }

  const user = await getUserById(c.env.NEXTCLAW_PLATFORM_DB, id);
  if (!user) {
    return apiError(c, 500, "REGISTER_FAILED", "User created but cannot be loaded.");
  }

  const token = await issueSessionToken(c.env, user);
  return c.json({
    ok: true,
    data: {
      token,
      user: toUserPublicView(user)
    }
  }, 201);
});

app.post("/platform/auth/login", async (c) => {
  await ensurePlatformBootstrap(c.env);

  const body = await readJson(c);
  const email = normalizeEmail(readString(body, "email"));
  const password = readString(body, "password");

  if (!email || !password) {
    return apiError(c, 400, "INVALID_CREDENTIALS", "Email and password are required.");
  }

  const user = await getUserByEmail(c.env.NEXTCLAW_PLATFORM_DB, email);
  if (!user) {
    return apiError(c, 401, "INVALID_CREDENTIALS", "Invalid email or password.");
  }

  const valid = await verifyPassword(password, user.password_salt, user.password_hash);
  if (!valid) {
    return apiError(c, 401, "INVALID_CREDENTIALS", "Invalid email or password.");
  }

  const token = await issueSessionToken(c.env, user);
  return c.json({
    ok: true,
    data: {
      token,
      user: toUserPublicView(user)
    }
  });
});

app.get("/platform/auth/me", async (c) => {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }

  return c.json({
    ok: true,
    data: {
      user: toUserPublicView(auth.user)
    }
  });
});

app.get("/platform/billing/overview", async (c) => {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }

  const snapshot = await readBillingSnapshot(c.env.NEXTCLAW_PLATFORM_DB, auth.user.id);
  if (!snapshot) {
    return apiError(c, 404, "USER_NOT_FOUND", "User not found.");
  }

  return c.json({
    ok: true,
    data: toBillingOverview(snapshot)
  });
});

app.get("/platform/billing/ledger", async (c) => {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }

  const limit = parseBoundedInt(c.req.query("limit"), 20, 1, 200);
  const rows = await c.env.NEXTCLAW_PLATFORM_DB.prepare(
    `SELECT id, user_id, kind, amount_usd, free_amount_usd, paid_amount_usd,
            model, prompt_tokens, completion_tokens, request_id, note, created_at
       FROM usage_ledger
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?`
  )
    .bind(auth.user.id, limit)
    .all<LedgerRow>();

  return c.json({
    ok: true,
    data: {
      items: (rows.results ?? []).map(toLedgerView)
    }
  });
});

app.get("/platform/billing/recharge-intents", async (c) => {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }

  const limit = parseBoundedInt(c.req.query("limit"), 20, 1, 100);
  const rows = await c.env.NEXTCLAW_PLATFORM_DB.prepare(
    `SELECT id, user_id, amount_usd, status, note, created_at, updated_at,
            confirmed_at, confirmed_by_user_id, rejected_at, rejected_by_user_id
       FROM recharge_intents
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?`
  )
    .bind(auth.user.id, limit)
    .all<RechargeIntentRow>();

  return c.json({
    ok: true,
    data: {
      items: (rows.results ?? []).map(toRechargeIntentView)
    }
  });
});

app.post("/platform/billing/recharge-intents", async (c) => {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }

  const body = await readJson(c);
  const amountUsd = parsePositiveUsd(readNumber(body, "amountUsd"));
  const note = optionalTrimmedString(readString(body, "note"));

  if (amountUsd <= 0) {
    return apiError(c, 400, "INVALID_AMOUNT", "amountUsd must be a positive number.");
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const inserted = await c.env.NEXTCLAW_PLATFORM_DB.prepare(
    `INSERT INTO recharge_intents (
      id, user_id, amount_usd, status, note,
      created_at, updated_at,
      confirmed_at, confirmed_by_user_id,
      rejected_at, rejected_by_user_id
    ) VALUES (?, ?, ?, 'pending', ?, ?, ?, NULL, NULL, NULL, NULL)`
  )
    .bind(id, auth.user.id, amountUsd, note ?? null, now, now)
    .run();

  if (!inserted.success) {
    return apiError(c, 500, "RECHARGE_INTENT_CREATE_FAILED", "Failed to create recharge intent.");
  }

  return c.json({
    ok: true,
    data: {
      id,
      amountUsd,
      status: "pending",
      note: note ?? null,
      createdAt: now
    }
  }, 201);
});

app.get("/platform/admin/overview", async (c) => {
  await ensurePlatformBootstrap(c.env);
  const admin = await requireAdminUser(c);
  if (!admin.ok) {
    return admin.response;
  }

  const globalFreeLimitUsd = await readPlatformNumberSetting(c.env.NEXTCLAW_PLATFORM_DB, "global_free_limit_usd", getGlobalFreeLimit(c.env));
  const globalFreeUsedUsd = await readPlatformNumberSetting(c.env.NEXTCLAW_PLATFORM_DB, "global_free_used_usd", 0);
  const userCount = await countUsers(c.env.NEXTCLAW_PLATFORM_DB);
  const pendingRechargeIntents = await countRechargeIntentsByStatus(c.env.NEXTCLAW_PLATFORM_DB, "pending");

  return c.json({
    ok: true,
    data: {
      globalFreeLimitUsd: roundUsd(globalFreeLimitUsd),
      globalFreeUsedUsd: roundUsd(globalFreeUsedUsd),
      globalFreeRemainingUsd: roundUsd(Math.max(0, globalFreeLimitUsd - globalFreeUsedUsd)),
      userCount,
      pendingRechargeIntents
    }
  });
});

app.get("/platform/admin/users", async (c) => {
  await ensurePlatformBootstrap(c.env);
  const admin = await requireAdminUser(c);
  if (!admin.ok) {
    return admin.response;
  }

  const limit = parseBoundedInt(c.req.query("limit"), 50, 1, 500);
  const query = optionalTrimmedString(c.req.query("q") ?? "");

  const sql = query
    ? `SELECT id, email, password_hash, password_salt, role,
              free_limit_usd, free_used_usd, paid_balance_usd,
              created_at, updated_at
         FROM users
        WHERE email LIKE ?
        ORDER BY created_at DESC
        LIMIT ?`
    : `SELECT id, email, password_hash, password_salt, role,
              free_limit_usd, free_used_usd, paid_balance_usd,
              created_at, updated_at
         FROM users
        ORDER BY created_at DESC
        LIMIT ?`;

  const statement = c.env.NEXTCLAW_PLATFORM_DB.prepare(sql);
  const result = query
    ? await statement.bind(`%${query}%`, limit).all<UserRow>()
    : await statement.bind(limit).all<UserRow>();

  return c.json({
    ok: true,
    data: {
      items: (result.results ?? []).map(toUserPublicView)
    }
  });
});

app.patch("/platform/admin/users/:userId", async (c) => {
  await ensurePlatformBootstrap(c.env);
  const admin = await requireAdminUser(c);
  if (!admin.ok) {
    return admin.response;
  }

  const userId = c.req.param("userId");
  const body = await readJson(c);
  const freeLimitUsdRaw = readUnknown(body, "freeLimitUsd");
  const paidBalanceDeltaUsdRaw = readUnknown(body, "paidBalanceDeltaUsd");

  let changed = false;
  const now = new Date().toISOString();

  if (typeof freeLimitUsdRaw === "number" && Number.isFinite(freeLimitUsdRaw) && freeLimitUsdRaw >= 0) {
    const nextFreeLimitUsd = roundUsd(freeLimitUsdRaw);
    const changedFree = await c.env.NEXTCLAW_PLATFORM_DB.prepare(
      "UPDATE users SET free_limit_usd = ?, updated_at = ? WHERE id = ?"
    )
      .bind(nextFreeLimitUsd, now, userId)
      .run();
    if (changedFree.success && (changedFree.meta.changes ?? 0) > 0) {
      changed = true;
    }
  }

  if (typeof paidBalanceDeltaUsdRaw === "number" && Number.isFinite(paidBalanceDeltaUsdRaw) && paidBalanceDeltaUsdRaw !== 0) {
    const delta = roundUsd(paidBalanceDeltaUsdRaw);
    if (delta > 0) {
      const changedBalance = await c.env.NEXTCLAW_PLATFORM_DB.prepare(
        "UPDATE users SET paid_balance_usd = paid_balance_usd + ?, updated_at = ? WHERE id = ?"
      )
        .bind(delta, now, userId)
        .run();
      if (changedBalance.success && (changedBalance.meta.changes ?? 0) > 0) {
        changed = true;
        await appendLedger(c.env.NEXTCLAW_PLATFORM_DB, {
          id: crypto.randomUUID(),
          userId,
          kind: "admin_adjust",
          amountUsd: roundUsd(delta),
          freeAmountUsd: 0,
          paidAmountUsd: roundUsd(delta),
          model: null,
          promptTokens: 0,
          completionTokens: 0,
          requestId: null,
          note: `Admin recharge +${delta.toFixed(6)} USD`
        });
      }
    }

    if (delta < 0) {
      const abs = Math.abs(delta);
      const changedBalance = await c.env.NEXTCLAW_PLATFORM_DB.prepare(
        "UPDATE users SET paid_balance_usd = paid_balance_usd - ?, updated_at = ? WHERE id = ? AND paid_balance_usd >= ?"
      )
        .bind(abs, now, userId, abs)
        .run();
      if (changedBalance.success && (changedBalance.meta.changes ?? 0) > 0) {
        changed = true;
        await appendLedger(c.env.NEXTCLAW_PLATFORM_DB, {
          id: crypto.randomUUID(),
          userId,
          kind: "admin_adjust",
          amountUsd: -roundUsd(abs),
          freeAmountUsd: 0,
          paidAmountUsd: -roundUsd(abs),
          model: null,
          promptTokens: 0,
          completionTokens: 0,
          requestId: null,
          note: `Admin deduction -${abs.toFixed(6)} USD`
        });
      }
    }
  }

  const user = await getUserById(c.env.NEXTCLAW_PLATFORM_DB, userId);
  if (!user) {
    return apiError(c, 404, "USER_NOT_FOUND", "User not found.");
  }

  return c.json({
    ok: true,
    data: {
      changed,
      user: toUserPublicView(user)
    }
  });
});

app.get("/platform/admin/recharge-intents", async (c) => {
  await ensurePlatformBootstrap(c.env);
  const admin = await requireAdminUser(c);
  if (!admin.ok) {
    return admin.response;
  }

  const status = optionalTrimmedString(c.req.query("status") ?? "");
  const limit = parseBoundedInt(c.req.query("limit"), 100, 1, 500);

  const sql = status && (status === "pending" || status === "confirmed" || status === "rejected")
    ? `SELECT id, user_id, amount_usd, status, note, created_at, updated_at,
              confirmed_at, confirmed_by_user_id, rejected_at, rejected_by_user_id
         FROM recharge_intents
        WHERE status = ?
        ORDER BY created_at DESC
        LIMIT ?`
    : `SELECT id, user_id, amount_usd, status, note, created_at, updated_at,
              confirmed_at, confirmed_by_user_id, rejected_at, rejected_by_user_id
         FROM recharge_intents
        ORDER BY created_at DESC
        LIMIT ?`;

  const rows = status && (status === "pending" || status === "confirmed" || status === "rejected")
    ? await c.env.NEXTCLAW_PLATFORM_DB.prepare(sql).bind(status, limit).all<RechargeIntentRow>()
    : await c.env.NEXTCLAW_PLATFORM_DB.prepare(sql).bind(limit).all<RechargeIntentRow>();

  return c.json({
    ok: true,
    data: {
      items: (rows.results ?? []).map(toRechargeIntentView)
    }
  });
});

app.post("/platform/admin/recharge-intents/:intentId/confirm", async (c) => {
  await ensurePlatformBootstrap(c.env);
  const admin = await requireAdminUser(c);
  if (!admin.ok) {
    return admin.response;
  }

  const intentId = c.req.param("intentId");
  const intent = await getRechargeIntentById(c.env.NEXTCLAW_PLATFORM_DB, intentId);
  if (!intent) {
    return apiError(c, 404, "RECHARGE_INTENT_NOT_FOUND", "Recharge intent not found.");
  }
  if (intent.status !== "pending") {
    return apiError(c, 409, "RECHARGE_INTENT_NOT_PENDING", "Recharge intent is not pending.");
  }

  const now = new Date().toISOString();
  const markConfirmed = await c.env.NEXTCLAW_PLATFORM_DB.prepare(
    `UPDATE recharge_intents
        SET status = 'confirmed',
            confirmed_at = ?,
            confirmed_by_user_id = ?,
            updated_at = ?
      WHERE id = ? AND status = 'pending'`
  )
    .bind(now, admin.user.id, now, intentId)
    .run();

  if (!markConfirmed.success || (markConfirmed.meta.changes ?? 0) !== 1) {
    return apiError(c, 409, "RECHARGE_INTENT_STATE_CHANGED", "Recharge intent state changed, please retry.");
  }

  const addBalance = await c.env.NEXTCLAW_PLATFORM_DB.prepare(
    "UPDATE users SET paid_balance_usd = paid_balance_usd + ?, updated_at = ? WHERE id = ?"
  )
    .bind(intent.amount_usd, now, intent.user_id)
    .run();

  if (!addBalance.success || (addBalance.meta.changes ?? 0) !== 1) {
    await c.env.NEXTCLAW_PLATFORM_DB.prepare(
      `UPDATE recharge_intents
          SET status = 'pending',
              confirmed_at = NULL,
              confirmed_by_user_id = NULL,
              updated_at = ?
        WHERE id = ?`
    )
      .bind(now, intentId)
      .run();
    return apiError(c, 500, "RECHARGE_CONFIRM_FAILED", "Failed to update user balance.");
  }

  await appendLedger(c.env.NEXTCLAW_PLATFORM_DB, {
    id: crypto.randomUUID(),
    userId: intent.user_id,
    kind: "recharge",
    amountUsd: roundUsd(intent.amount_usd),
    freeAmountUsd: 0,
    paidAmountUsd: roundUsd(intent.amount_usd),
    model: null,
    promptTokens: 0,
    completionTokens: 0,
    requestId: null,
    note: `Recharge confirmed by ${admin.user.email}`
  });

  const user = await getUserById(c.env.NEXTCLAW_PLATFORM_DB, intent.user_id);
  return c.json({
    ok: true,
    data: {
      intentId,
      user: user ? toUserPublicView(user) : null
    }
  });
});

app.post("/platform/admin/recharge-intents/:intentId/reject", async (c) => {
  await ensurePlatformBootstrap(c.env);
  const admin = await requireAdminUser(c);
  if (!admin.ok) {
    return admin.response;
  }

  const intentId = c.req.param("intentId");
  const intent = await getRechargeIntentById(c.env.NEXTCLAW_PLATFORM_DB, intentId);
  if (!intent) {
    return apiError(c, 404, "RECHARGE_INTENT_NOT_FOUND", "Recharge intent not found.");
  }
  if (intent.status !== "pending") {
    return apiError(c, 409, "RECHARGE_INTENT_NOT_PENDING", "Recharge intent is not pending.");
  }

  const now = new Date().toISOString();
  const rejected = await c.env.NEXTCLAW_PLATFORM_DB.prepare(
    `UPDATE recharge_intents
        SET status = 'rejected',
            rejected_at = ?,
            rejected_by_user_id = ?,
            updated_at = ?
      WHERE id = ? AND status = 'pending'`
  )
    .bind(now, admin.user.id, now, intentId)
    .run();

  if (!rejected.success || (rejected.meta.changes ?? 0) !== 1) {
    return apiError(c, 409, "RECHARGE_INTENT_STATE_CHANGED", "Recharge intent state changed, please retry.");
  }

  return c.json({
    ok: true,
    data: {
      intentId,
      status: "rejected"
    }
  });
});

app.patch("/platform/admin/settings", async (c) => {
  await ensurePlatformBootstrap(c.env);
  const admin = await requireAdminUser(c);
  if (!admin.ok) {
    return admin.response;
  }

  const body = await readJson(c);
  const globalFreeLimitUsd = readNumber(body, "globalFreeLimitUsd");

  if (!Number.isFinite(globalFreeLimitUsd) || globalFreeLimitUsd < 0) {
    return apiError(c, 400, "INVALID_GLOBAL_FREE_LIMIT", "globalFreeLimitUsd must be a non-negative number.");
  }

  await writePlatformNumberSetting(c.env.NEXTCLAW_PLATFORM_DB, "global_free_limit_usd", roundUsd(globalFreeLimitUsd));

  const currentUsed = await readPlatformNumberSetting(c.env.NEXTCLAW_PLATFORM_DB, "global_free_used_usd", 0);
  return c.json({
    ok: true,
    data: {
      globalFreeLimitUsd: roundUsd(globalFreeLimitUsd),
      globalFreeUsedUsd: roundUsd(currentUsed),
      globalFreeRemainingUsd: roundUsd(Math.max(0, globalFreeLimitUsd - currentUsed))
    }
  });
});

app.get("/v1/usage", async (c) => {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }

  const snapshot = await readBillingSnapshot(c.env.NEXTCLAW_PLATFORM_DB, auth.user.id);
  if (!snapshot) {
    return openaiError(c, 404, "User not found.", "user_not_found");
  }

  return c.json({
    object: "nextclaw.usage",
    data: {
      totalCostUsd: roundUsd(snapshot.user.free_used_usd + Math.max(0, snapshot.user.paid_balance_usd)),
      freeQuotaUsdLimit: roundUsd(snapshot.user.free_limit_usd),
      freeQuotaUsdUsed: roundUsd(snapshot.user.free_used_usd),
      freeQuotaUsdRemaining: roundUsd(Math.max(0, snapshot.user.free_limit_usd - snapshot.user.free_used_usd)),
      paidBalanceUsd: roundUsd(snapshot.user.paid_balance_usd),
      globalFreeUsdLimit: roundUsd(snapshot.globalFreeLimitUsd),
      globalFreeUsdUsed: roundUsd(snapshot.globalFreeUsedUsd),
      globalFreeUsdRemaining: roundUsd(Math.max(0, snapshot.globalFreeLimitUsd - snapshot.globalFreeUsedUsd)),
      updatedAt: snapshot.user.updated_at
    }
  });
});

app.post("/v1/chat/completions", async (c) => {
  await ensurePlatformBootstrap(c.env);

  if (!c.env.DASHSCOPE_API_KEY || c.env.DASHSCOPE_API_KEY.trim().length === 0) {
    return openaiError(c, 503, "Upstream provider is not configured.", "service_unavailable");
  }

  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }

  let body: ChatCompletionRequest;
  try {
    body = await c.req.json<ChatCompletionRequest>();
  } catch {
    return openaiError(c, 400, "Invalid JSON payload.", "invalid_request_error");
  }

  if (typeof body.model !== "string" || body.model.trim().length === 0) {
    return openaiError(c, 400, "model is required.", "invalid_request_error");
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return openaiError(c, 400, "messages must be a non-empty array.", "invalid_request_error");
  }

  const requestedModel = body.model.trim();
  const modelSpec = MODEL_MAP.get(requestedModel);
  if (!modelSpec) {
    return openaiError(
      c,
      400,
      `Model '${requestedModel}' is not available in NextClaw catalog.`,
      "model_not_found"
    );
  }

  const usageEstimate = estimateUsage(body.messages, resolveMaxCompletionTokens(body));
  const estimatedCost =
    calculateCost(modelSpec, usageEstimate) + getRequestFlatUsdPerRequest(c.env);

  const precheckSnapshot = await readBillingSnapshot(c.env.NEXTCLAW_PLATFORM_DB, auth.user.id);
  if (!precheckSnapshot) {
    return openaiError(c, 404, "User not found.", "user_not_found");
  }

  const precheckSplit = computeChargeSplit(precheckSnapshot, estimatedCost);
  if (!precheckSplit) {
    return c.json(
      {
        error: {
          message: "Quota exceeded. Free quota and paid balance are both insufficient.",
          type: "insufficient_quota",
          param: null,
          code: "insufficient_quota"
        },
        usage: {
          freeQuotaUsdLimit: roundUsd(precheckSnapshot.user.free_limit_usd),
          freeQuotaUsdUsed: roundUsd(precheckSnapshot.user.free_used_usd),
          freeQuotaUsdRemaining: roundUsd(Math.max(0, precheckSnapshot.user.free_limit_usd - precheckSnapshot.user.free_used_usd)),
          paidBalanceUsd: roundUsd(precheckSnapshot.user.paid_balance_usd),
          globalFreeUsdRemaining: roundUsd(Math.max(0, precheckSnapshot.globalFreeLimitUsd - precheckSnapshot.globalFreeUsedUsd))
        }
      },
      429
    );
  }

  const upstreamUrl = new URL("chat/completions", withTrailingSlash(getDashscopeApiBase(c.env))).toString();
  const upstreamPayload: Record<string, unknown> = {
    ...body,
    model: modelSpec.upstreamModel
  };

  const upstreamResponse = await fetch(upstreamUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${c.env.DASHSCOPE_API_KEY.trim()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(upstreamPayload)
  });

  const requestId = crypto.randomUUID();

  if (body.stream === true && upstreamResponse.body) {
    const [clientStream, billingStream] = upstreamResponse.body.tee();
    if (upstreamResponse.ok) {
      c.executionCtx.waitUntil(
        chargeFromStream({
          env: c.env,
          userId: auth.user.id,
          modelSpec,
          stream: billingStream,
          fallback: usageEstimate,
          requestId
        })
      );
    }
    return new Response(clientStream, {
      status: upstreamResponse.status,
      headers: sanitizeResponseHeaders(upstreamResponse.headers)
    });
  }

  const rawText = await upstreamResponse.text();
  if (!upstreamResponse.ok) {
    return new Response(rawText, {
      status: upstreamResponse.status,
      headers: sanitizeResponseHeaders(upstreamResponse.headers)
    });
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    return openaiError(c, 502, "Upstream returned invalid JSON.", "upstream_invalid_response");
  }

  const usage = extractUsageCounters(parsed, usageEstimate);
  const charged = await chargeUsage(c.env, auth.user.id, modelSpec, usage, requestId);
  if (!charged.ok) {
    return c.json(
      {
        error: {
          message: "Quota exceeded before final settlement.",
          type: "insufficient_quota",
          param: null,
          code: "insufficient_quota"
        }
      },
      429
    );
  }

  parsed.model = requestedModel;
  return c.json(parsed);
});

app.notFound((c) => openaiError(c, 404, "endpoint not found", "not_found"));

app.onError((error, c) => {
  return openaiError(c, 500, error.message || "internal error", "internal_error");
});

async function ensurePlatformBootstrap(env: Env): Promise<void> {
  const existing = bootstrapReady.get(env.NEXTCLAW_PLATFORM_DB);
  if (existing) {
    await existing;
    return;
  }

  const task = (async () => {
    const now = new Date().toISOString();
    await env.NEXTCLAW_PLATFORM_DB.batch([
      env.NEXTCLAW_PLATFORM_DB.prepare(
        "INSERT OR IGNORE INTO platform_settings (key, value, updated_at) VALUES ('global_free_limit_usd', ?, ?)"
      ).bind(String(getGlobalFreeLimit(env)), now),
      env.NEXTCLAW_PLATFORM_DB.prepare(
        "INSERT OR IGNORE INTO platform_settings (key, value, updated_at) VALUES ('global_free_used_usd', '0', ?)"
      ).bind(now)
    ]);
  })();

  bootstrapReady.set(env.NEXTCLAW_PLATFORM_DB, task);
  await task;
}

async function requireAuthUser(c: { env: Env; req: { header: (name: string) => string | undefined } }): Promise<
  | { ok: true; user: UserRow }
  | { ok: false; response: Response }
> {
  const token = parseBearerToken(c.req.header("authorization"));
  if (!token) {
    return {
      ok: false,
      response: openaiLikeUnauthorized("Missing bearer token.")
    };
  }

  const secret = readAuthSecret(c.env);
  if (!secret) {
    return {
      ok: false,
      response: openaiLikeUnavailable("Auth secret is not configured.")
    };
  }

  const payload = await verifySessionToken(token, secret);
  if (!payload) {
    return {
      ok: false,
      response: openaiLikeUnauthorized("Invalid or expired token.")
    };
  }

  const user = await getUserById(c.env.NEXTCLAW_PLATFORM_DB, payload.sub);
  if (!user) {
    return {
      ok: false,
      response: openaiLikeUnauthorized("Token subject no longer exists.")
    };
  }

  return { ok: true, user };
}

async function requireAdminUser(c: { env: Env; req: { header: (name: string) => string | undefined } }): Promise<
  | { ok: true; user: UserRow }
  | { ok: false; response: Response }
> {
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth;
  }
  if (auth.user.role !== "admin") {
    return {
      ok: false,
      response: jsonErrorResponse(403, "FORBIDDEN", "Admin permission required.")
    };
  }
  return auth;
}

async function chargeFromStream(params: {
  env: Env;
  userId: string;
  modelSpec: SupportedModelSpec;
  stream: ReadableStream;
  fallback: UsageCounters;
  requestId: string;
}): Promise<void> {
  const decoder = new TextDecoder();
  const reader = params.stream.getReader();
  let buffer = "";
  let usage: UsageCounters | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    if (!value) {
      continue;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith("data:")) {
        continue;
      }
      const data = line.slice("data:".length).trim();
      if (data.length === 0 || data === "[DONE]") {
        continue;
      }

      try {
        const chunk = JSON.parse(data) as Record<string, unknown>;
        if (isRecord(chunk.usage)) {
          usage = extractUsageCounters(chunk, usage ?? params.fallback);
        }
      } catch {
        // ignore malformed chunk
      }
    }
  }

  await chargeUsage(params.env, params.userId, params.modelSpec, usage ?? params.fallback, params.requestId);
}

async function chargeUsage(
  env: Env,
  userId: string,
  modelSpec: SupportedModelSpec,
  usage: UsageCounters,
  requestId: string
): Promise<ChargeResult> {
  const totalCostUsd = roundUsd(calculateCost(modelSpec, usage) + getRequestFlatUsdPerRequest(env));

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const snapshot = await readBillingSnapshot(env.NEXTCLAW_PLATFORM_DB, userId);
    if (!snapshot) {
      return {
        ok: false,
        reason: "insufficient_quota",
        snapshot: {
          user: {
            id: userId,
            email: "",
            password_hash: "",
            password_salt: "",
            role: "user",
            free_limit_usd: 0,
            free_used_usd: 0,
            paid_balance_usd: 0,
            created_at: new Date(0).toISOString(),
            updated_at: new Date(0).toISOString()
          },
          globalFreeLimitUsd: 0,
          globalFreeUsedUsd: 0
        }
      };
    }

    const split = computeChargeSplit(snapshot, totalCostUsd);
    if (!split) {
      return {
        ok: false,
        reason: "insufficient_quota",
        snapshot
      };
    }

    const now = new Date().toISOString();
    const updateUser = await env.NEXTCLAW_PLATFORM_DB.prepare(
      `UPDATE users
          SET free_used_usd = free_used_usd + ?,
              paid_balance_usd = paid_balance_usd - ?,
              updated_at = ?
        WHERE id = ?
          AND free_used_usd + ? <= free_limit_usd
          AND paid_balance_usd >= ?`
    )
      .bind(
        split.freePartUsd,
        split.paidPartUsd,
        now,
        userId,
        split.freePartUsd,
        split.paidPartUsd
      )
      .run();

    if (!updateUser.success || (updateUser.meta.changes ?? 0) !== 1) {
      continue;
    }

    if (split.freePartUsd > 0) {
      const updateGlobal = await env.NEXTCLAW_PLATFORM_DB.prepare(
        `UPDATE platform_settings
            SET value = CAST(value AS REAL) + ?,
                updated_at = ?
          WHERE key = 'global_free_used_usd'
            AND CAST(value AS REAL) + ? <= ?`
      )
        .bind(split.freePartUsd, now, split.freePartUsd, snapshot.globalFreeLimitUsd)
        .run();

      if (!updateGlobal.success || (updateGlobal.meta.changes ?? 0) !== 1) {
        await env.NEXTCLAW_PLATFORM_DB.prepare(
          `UPDATE users
              SET free_used_usd = MAX(0, free_used_usd - ?),
                  paid_balance_usd = paid_balance_usd + ?,
                  updated_at = ?
            WHERE id = ?`
        )
          .bind(split.freePartUsd, split.paidPartUsd, now, userId)
          .run();
        continue;
      }
    }

    await appendLedger(env.NEXTCLAW_PLATFORM_DB, {
      id: crypto.randomUUID(),
      userId,
      kind: resolveUsageLedgerKind(split),
      amountUsd: -roundUsd(split.totalCostUsd),
      freeAmountUsd: roundUsd(split.freePartUsd),
      paidAmountUsd: roundUsd(split.paidPartUsd),
      model: modelSpec.id,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      requestId,
      note: null
    });

    return {
      ok: true,
      split,
      snapshot
    };
  }

  const snapshot = await readBillingSnapshot(env.NEXTCLAW_PLATFORM_DB, userId);
  if (!snapshot) {
    return {
      ok: false,
      reason: "insufficient_quota",
      snapshot: {
        user: {
          id: userId,
          email: "",
          password_hash: "",
          password_salt: "",
          role: "user",
          free_limit_usd: 0,
          free_used_usd: 0,
          paid_balance_usd: 0,
          created_at: new Date(0).toISOString(),
          updated_at: new Date(0).toISOString()
        },
        globalFreeLimitUsd: 0,
        globalFreeUsedUsd: 0
      }
    };
  }

  return {
    ok: false,
    reason: "insufficient_quota",
    snapshot
  };
}

function resolveUsageLedgerKind(split: ChargeSplit): string {
  if (split.freePartUsd > 0 && split.paidPartUsd > 0) {
    return "usage_mixed";
  }
  if (split.freePartUsd > 0) {
    return "usage_free";
  }
  return "usage_paid";
}

async function readBillingSnapshot(db: D1Database, userId: string): Promise<BillingSnapshot | null> {
  const user = await getUserById(db, userId);
  if (!user) {
    return null;
  }
  const globalFreeLimitUsd = await readPlatformNumberSetting(db, "global_free_limit_usd", DEFAULT_GLOBAL_FREE_USD_LIMIT);
  const globalFreeUsedUsd = await readPlatformNumberSetting(db, "global_free_used_usd", 0);
  return {
    user,
    globalFreeLimitUsd,
    globalFreeUsedUsd
  };
}

function computeChargeSplit(snapshot: BillingSnapshot, totalCostUsd: number): ChargeSplit | null {
  const freeRemainingUser = Math.max(0, snapshot.user.free_limit_usd - snapshot.user.free_used_usd);
  const freeRemainingGlobal = Math.max(0, snapshot.globalFreeLimitUsd - snapshot.globalFreeUsedUsd);
  const freeAvailable = Math.min(freeRemainingUser, freeRemainingGlobal);

  const freePartUsd = Math.min(totalCostUsd, freeAvailable);
  const paidPartUsd = roundUsd(totalCostUsd - freePartUsd);

  if (paidPartUsd > snapshot.user.paid_balance_usd + 1e-9) {
    return null;
  }

  return {
    totalCostUsd: roundUsd(totalCostUsd),
    freePartUsd: roundUsd(freePartUsd),
    paidPartUsd: roundUsd(Math.max(0, paidPartUsd))
  };
}

async function appendLedger(
  db: D1Database,
  payload: {
    id: string;
    userId: string;
    kind: string;
    amountUsd: number;
    freeAmountUsd: number;
    paidAmountUsd: number;
    model: string | null;
    promptTokens: number;
    completionTokens: number;
    requestId: string | null;
    note: string | null;
  }
): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO usage_ledger (
      id, user_id, kind, amount_usd, free_amount_usd, paid_amount_usd,
      model, prompt_tokens, completion_tokens, request_id, note, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      payload.id,
      payload.userId,
      payload.kind,
      payload.amountUsd,
      payload.freeAmountUsd,
      payload.paidAmountUsd,
      payload.model,
      payload.promptTokens,
      payload.completionTokens,
      payload.requestId,
      payload.note,
      now
    )
    .run();
}

async function getUserById(db: D1Database, id: string): Promise<UserRow | null> {
  const row = await db.prepare(
    `SELECT id, email, password_hash, password_salt, role,
            free_limit_usd, free_used_usd, paid_balance_usd,
            created_at, updated_at
       FROM users
      WHERE id = ?`
  )
    .bind(id)
    .first<UserRow>();
  return row ?? null;
}

async function getUserByEmail(db: D1Database, email: string): Promise<UserRow | null> {
  const row = await db.prepare(
    `SELECT id, email, password_hash, password_salt, role,
            free_limit_usd, free_used_usd, paid_balance_usd,
            created_at, updated_at
       FROM users
      WHERE email = ?`
  )
    .bind(email)
    .first<UserRow>();
  return row ?? null;
}

async function countUsers(db: D1Database): Promise<number> {
  const row = await db.prepare("SELECT COUNT(1) AS count FROM users").first<{ count: number }>();
  return normalizeNonNegativeInteger(row?.count ?? 0);
}

async function countRechargeIntentsByStatus(
  db: D1Database,
  status: "pending" | "confirmed" | "rejected"
): Promise<number> {
  const row = await db.prepare("SELECT COUNT(1) AS count FROM recharge_intents WHERE status = ?")
    .bind(status)
    .first<{ count: number }>();
  return normalizeNonNegativeInteger(row?.count ?? 0);
}

async function getRechargeIntentById(db: D1Database, id: string): Promise<RechargeIntentRow | null> {
  const row = await db.prepare(
    `SELECT id, user_id, amount_usd, status, note, created_at, updated_at,
            confirmed_at, confirmed_by_user_id, rejected_at, rejected_by_user_id
       FROM recharge_intents
      WHERE id = ?`
  )
    .bind(id)
    .first<RechargeIntentRow>();
  return row ?? null;
}

async function writePlatformNumberSetting(db: D1Database, key: string, value: number): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO platform_settings (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  )
    .bind(key, String(roundUsd(value)), now)
    .run();
}

async function readPlatformNumberSetting(db: D1Database, key: string, fallback: number): Promise<number> {
  const row = await db.prepare("SELECT value FROM platform_settings WHERE key = ?")
    .bind(key)
    .first<{ value: string }>();
  if (!row) {
    return fallback;
  }
  const parsed = Number(row.value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toUserPublicView(user: UserRow): UserPublicView {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    freeLimitUsd: roundUsd(user.free_limit_usd),
    freeUsedUsd: roundUsd(user.free_used_usd),
    freeRemainingUsd: roundUsd(Math.max(0, user.free_limit_usd - user.free_used_usd)),
    paidBalanceUsd: roundUsd(user.paid_balance_usd),
    createdAt: user.created_at,
    updatedAt: user.updated_at
  };
}

function toBillingOverview(snapshot: BillingSnapshot): {
  user: UserPublicView;
  globalFreeLimitUsd: number;
  globalFreeUsedUsd: number;
  globalFreeRemainingUsd: number;
} {
  return {
    user: toUserPublicView(snapshot.user),
    globalFreeLimitUsd: roundUsd(snapshot.globalFreeLimitUsd),
    globalFreeUsedUsd: roundUsd(snapshot.globalFreeUsedUsd),
    globalFreeRemainingUsd: roundUsd(Math.max(0, snapshot.globalFreeLimitUsd - snapshot.globalFreeUsedUsd))
  };
}

function toLedgerView(row: LedgerRow): {
  id: string;
  userId: string;
  kind: string;
  amountUsd: number;
  freeAmountUsd: number;
  paidAmountUsd: number;
  model: string | null;
  promptTokens: number;
  completionTokens: number;
  requestId: string | null;
  note: string | null;
  createdAt: string;
} {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    amountUsd: roundUsd(row.amount_usd),
    freeAmountUsd: roundUsd(row.free_amount_usd),
    paidAmountUsd: roundUsd(row.paid_amount_usd),
    model: row.model,
    promptTokens: normalizeNonNegativeInteger(row.prompt_tokens),
    completionTokens: normalizeNonNegativeInteger(row.completion_tokens),
    requestId: row.request_id,
    note: row.note,
    createdAt: row.created_at
  };
}

function toRechargeIntentView(row: RechargeIntentRow): {
  id: string;
  userId: string;
  amountUsd: number;
  status: "pending" | "confirmed" | "rejected";
  note: string | null;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  confirmedByUserId: string | null;
  rejectedAt: string | null;
  rejectedByUserId: string | null;
} {
  return {
    id: row.id,
    userId: row.user_id,
    amountUsd: roundUsd(row.amount_usd),
    status: row.status,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    confirmedAt: row.confirmed_at,
    confirmedByUserId: row.confirmed_by_user_id,
    rejectedAt: row.rejected_at,
    rejectedByUserId: row.rejected_by_user_id
  };
}

async function readJson(c: { req: { json: <T>() => Promise<T> } }): Promise<Record<string, unknown>> {
  try {
    const parsed = await c.req.json<Record<string, unknown>>();
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function readUnknown(payload: Record<string, unknown>, key: string): unknown {
  return payload[key];
}

function readString(payload: Record<string, unknown>, key: string): string {
  const raw = payload[key];
  return typeof raw === "string" ? raw : "";
}

function readNumber(payload: Record<string, unknown>, key: string): number {
  const raw = payload[key];
  return typeof raw === "number" ? raw : Number.NaN;
}

function isStrongPassword(value: string): boolean {
  return value.trim().length >= 8;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function optionalTrimmedString(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parsePositiveUsd(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return roundUsd(value);
}

function parseBoundedInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

async function issueSessionToken(env: Env, user: UserRow): Promise<string> {
  const secret = readAuthSecret(env);
  if (!secret) {
    throw new Error("AUTH_TOKEN_SECRET is required");
  }
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionTokenPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    iat: now,
    exp: now + DEFAULT_TOKEN_TTL_SECONDS
  };
  return await signSessionToken(payload, secret);
}

function readAuthSecret(env: Env): string | null {
  const secret = env.AUTH_TOKEN_SECRET?.trim();
  if (!secret) {
    return null;
  }
  return secret;
}

async function signSessionToken(payload: SessionTokenPayload, secret: string): Promise<string> {
  const payloadEncoded = encodeBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await signHmacSha256(payloadEncoded, secret);
  return `nca.${payloadEncoded}.${signature}`;
}

async function verifySessionToken(token: string, secret: string): Promise<SessionTokenPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "nca" || !parts[1] || !parts[2]) {
    return null;
  }

  const payloadEncoded = parts[1];
  const signature = parts[2];

  const expectedSignature = await signHmacSha256(payloadEncoded, secret);
  if (!timingSafeEqual(signature, expectedSignature)) {
    return null;
  }

  let payload: SessionTokenPayload;
  try {
    const decoded = decodeBase64Url(payloadEncoded);
    payload = JSON.parse(new TextDecoder().decode(decoded)) as SessionTokenPayload;
  } catch {
    return null;
  }

  if (!payload.sub || !payload.email || !payload.role || !payload.exp) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) {
    return null;
  }

  return payload;
}

async function signHmacSha256(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return encodeBase64Url(new Uint8Array(signature));
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(raw: string): Uint8Array {
  const base64 = raw.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
  const binary = atob(base64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) {
    return false;
  }
  let diff = 0;
  for (let index = 0; index < aBytes.length; index += 1) {
    diff |= (aBytes[index] ?? 0) ^ (bBytes[index] ?? 0);
  }
  return diff === 0;
}

async function hashPassword(password: string): Promise<{ salt: string; hash: string }> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const derived = await derivePasswordHash(password, saltBytes);
  return {
    salt: encodeBase64Url(saltBytes),
    hash: encodeBase64Url(derived)
  };
}

async function verifyPassword(password: string, saltEncoded: string, expectedHashEncoded: string): Promise<boolean> {
  const salt = decodeBase64Url(saltEncoded);
  const derived = await derivePasswordHash(password, salt);
  const actualHashEncoded = encodeBase64Url(derived);
  return timingSafeEqual(actualHashEncoded, expectedHashEncoded);
}

async function derivePasswordHash(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations: PASSWORD_HASH_ITERATIONS
    },
    keyMaterial,
    256
  );
  return new Uint8Array(bits);
}

function allowSelfSignup(env: Env): boolean {
  const raw = env.ALLOW_SELF_SIGNUP?.trim().toLowerCase();
  if (!raw) {
    return true;
  }
  return raw === "1" || raw === "true" || raw === "yes";
}

function getDashscopeApiBase(env: Env): string {
  return normalizeNonEmptyString(env.DASHSCOPE_API_BASE) ?? DEFAULT_DASHSCOPE_API_BASE;
}

function getGlobalFreeLimit(env: Env): number {
  return parseNonNegativeNumber(env.GLOBAL_FREE_USD_LIMIT, DEFAULT_GLOBAL_FREE_USD_LIMIT);
}

function getDefaultUserFreeLimit(env: Env): number {
  return parseNonNegativeNumber(env.DEFAULT_USER_FREE_USD_LIMIT, DEFAULT_USER_FREE_USD_LIMIT);
}

function getRequestFlatUsdPerRequest(env: Env): number {
  return parseNonNegativeNumber(env.REQUEST_FLAT_USD_PER_REQUEST, DEFAULT_REQUEST_FLAT_USD_PER_REQUEST);
}

function parseNonNegativeNumber(raw: string | undefined, fallback: number): number {
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

function extractUsageCounters(payload: Record<string, unknown>, fallback: UsageCounters): UsageCounters {
  if (!isRecord(payload.usage)) {
    return fallback;
  }

  return {
    promptTokens: normalizeNonNegativeInteger(payload.usage.prompt_tokens),
    completionTokens: normalizeNonNegativeInteger(payload.usage.completion_tokens)
  };
}

function estimateUsage(messages: Array<Record<string, unknown>>, completionTokens: number): UsageCounters {
  const serialized = JSON.stringify(messages);
  const promptTokens = Math.max(1, Math.ceil(serialized.length / 4));
  return {
    promptTokens,
    completionTokens
  };
}

function resolveMaxCompletionTokens(body: ChatCompletionRequest): number {
  const direct = normalizeNonNegativeInteger(body.max_tokens);
  if (direct > 0) {
    return Math.min(8192, direct);
  }
  const modern = normalizeNonNegativeInteger(body.max_completion_tokens);
  if (modern > 0) {
    return Math.min(8192, modern);
  }
  return 1024;
}

function calculateCost(modelSpec: SupportedModelSpec, usage: UsageCounters): number {
  return (usage.promptTokens / 1_000_000) * modelSpec.inputUsdPer1M +
    (usage.completionTokens / 1_000_000) * modelSpec.outputUsdPer1M;
}

function parseBearerToken(header: string | undefined): string | null {
  if (!header) {
    return null;
  }
  const parts = header.trim().split(/\s+/);
  const scheme = parts[0];
  const rawToken = parts[1];
  if (parts.length !== 2 || !scheme || !rawToken || scheme.toLowerCase() !== "bearer") {
    return null;
  }
  const token = rawToken.trim();
  return token.length > 0 ? token : null;
}

function normalizeNonNegativeInteger(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
    return 0;
  }
  return Math.floor(raw);
}

function normalizeNonEmptyString(raw: string | undefined): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function withTrailingSlash(base: string): string {
  return base.endsWith("/") ? base : `${base}/`;
}

function sanitizeResponseHeaders(headers: Headers): Headers {
  const next = new Headers(headers);
  next.delete("content-length");
  return next;
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function openaiError(c: { json: (body: unknown, status?: number) => Response }, status: number, message: string, code: string): Response {
  const type = code === "insufficient_quota"
    ? "insufficient_quota"
    : status >= 500
      ? "server_error"
      : "invalid_request_error";
  return c.json(
    {
      error: {
        message,
        type,
        param: null,
        code
      }
    },
    status
  );
}

function apiError(
  c: { json: (body: unknown, status?: number) => Response },
  status: number,
  code: string,
  message: string
): Response {
  return c.json(
    {
      ok: false,
      error: {
        code,
        message
      }
    },
    status
  );
}

function jsonErrorResponse(status: number, code: string, message: string): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      error: {
        code,
        message
      }
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
}

function openaiLikeUnauthorized(message: string): Response {
  return jsonErrorResponse(401, "UNAUTHORIZED", message);
}

function openaiLikeUnavailable(message: string): Response {
  return jsonErrorResponse(503, "SERVICE_UNAVAILABLE", message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export default app;

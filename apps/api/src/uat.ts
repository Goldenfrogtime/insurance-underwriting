import crypto from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from './db.js';

export interface UatUser {
  email: string;
  name: string;
  organization: string | null;
  role: 'ADMIN' | 'BROKER_TESTER' | 'CLIENT_USER';
}

declare module 'fastify' {
  interface FastifyRequest {
    uatUser?: UatUser;
  }
}

const COOKIE_NAME = 'cf_uat_session';
const SESSION_TTL_HOURS = 24 * 7; // 7 days

function parseCookies(cookieHeader?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      out[k] = decodeURIComponent(v);
    }
  }
  return out;
}

function getSessionToken(request: FastifyRequest): string | null {
  const auth = request.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  const cookies = parseCookies(request.headers.cookie);
  return cookies[COOKIE_NAME] ?? null;
}

function setSessionCookie(reply: FastifyReply, token: string, maxAgeSec: number) {
  const isProd = process.env.NODE_ENV === 'production';
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSec}`,
  ];
  if (isProd) parts.push('Secure');
  reply.header('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(reply: FastifyReply) {
  reply.header('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

async function resolveUatUser(request: FastifyRequest): Promise<{
  user?: UatUser;
  error?: { status: number; message: string };
}> {
  const token = getSessionToken(request);
  if (!token) {
    return { error: { status: 401, message: 'Sign in with an approved Gmail account to access CoverFlow UAT.' } };
  }

  const session = await prisma.uatSession.findUnique({ where: { token } });
  if (!session || session.expiresAt < new Date()) {
    return { error: { status: 401, message: 'Your UAT session expired. Please sign in again.' } };
  }

  const tester = await prisma.allowedTester.findUnique({ where: { email: session.email } });
  if (!tester || !tester.active) {
    return { error: { status: 403, message: 'Access for this email has been revoked by the CoverFlow team.' } };
  }
  if (tester.expiresAt && tester.expiresAt < new Date()) {
    return { error: { status: 403, message: 'Your UAT access window has expired.' } };
  }

  const settings = await prisma.uatSettings.findUnique({ where: { id: 'singleton' } });
  if (settings && !settings.testingOpen && tester.role !== 'ADMIN') {
    return {
      error: {
        status: 403,
        message: 'CoverFlow UAT testing is currently paused by the administrator.',
      },
    };
  }

  return {
    user: {
      email: tester.email,
      name: tester.name,
      organization: tester.organization,
      role: tester.role as 'ADMIN' | 'BROKER_TESTER' | 'CLIENT_USER',
    },
  };
}

function csvEscape(v: unknown): string {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const PUBLIC_API_PATHS = new Set([
  '/api/v1/health',
  '/api/v1/uat/status',
  '/api/v1/uat/login',
  '/api/v1/uat/logout',
  '/api/v1/uat/me',
]);

export async function registerUatModule(app: FastifyInstance) {
  // Enforce server-side Gmail allowlist on all /api/v1/* endpoints
  app.addHook('onRequest', async (request, reply) => {
    const pathname = request.url.split('?')[0];
    if (!pathname.startsWith('/api/v1/')) return;
    if (PUBLIC_API_PATHS.has(pathname)) return;

    const resolved = await resolveUatUser(request);
    if (resolved.error || !resolved.user) {
      return reply
        .code(resolved.error?.status ?? 401)
        .send({ error: resolved.error?.message ?? 'Unauthorized', code: 'UAT_AUTH_REQUIRED' });
    }

    request.uatUser = resolved.user;
  });

  // Public UAT status (never exposes secrets)
  app.get('/api/v1/uat/status', async () => {
    const settings = await prisma.uatSettings.findUnique({ where: { id: 'singleton' } });
    return {
      testingOpen: settings?.testingOpen ?? true,
      sandboxBannerText:
        settings?.sandboxBannerText ??
        'SANDBOX TEST ONLY — Mock TRA/TIRA data. Cover notes generated here are NOT valid for road use.',
      googleClientId: process.env.GOOGLE_CLIENT_ID || null,
    };
  });

  // Check current session
  app.get('/api/v1/uat/me', async (request) => {
    const resolved = await resolveUatUser(request);
    if (!resolved.user) {
      return { authenticated: false, reason: resolved.error?.message };
    }
    return { authenticated: true, user: resolved.user };
  });

  // Login via Approved Gmail + Access Passcode (or optional Google ID token)
  app.post('/api/v1/uat/login', async (request, reply) => {
    const schema = z.object({
      email: z.string().email().optional(),
      passcode: z.string().optional(),
      googleIdToken: z.string().optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Enter a valid email address and access passcode.' });
    }

    let email = parsed.data.email?.trim().toLowerCase() ?? '';
    let verifiedViaGoogle = false;

    // Optional real Google Sign-In verification if GOOGLE_CLIENT_ID is configured
    if (parsed.data.googleIdToken && process.env.GOOGLE_CLIENT_ID) {
      try {
        const res = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(parsed.data.googleIdToken)}`,
        );
        const info = (await res.json()) as { aud?: string; email?: string; email_verified?: string };
        if (
          res.ok &&
          info.aud === process.env.GOOGLE_CLIENT_ID &&
          info.email &&
          info.email_verified === 'true'
        ) {
          email = info.email.toLowerCase();
          verifiedViaGoogle = true;
        } else {
          return reply.code(401).send({ error: 'Google Sign-In token could not be verified.' });
        }
      } catch {
        return reply.code(502).send({ error: 'Could not reach Google token verification service.' });
      }
    }

    if (!email) {
      return reply.code(400).send({ error: 'Approved Gmail address is required.' });
    }

    const tester = await prisma.allowedTester.findUnique({ where: { email } });
    if (!tester) {
      return reply.code(403).send({
        error: `"${email}" is not on the approved tester list. Ask the CoverFlow admin to add your Gmail.`,
      });
    }
    if (!tester.active) {
      return reply.code(403).send({
        error: 'Access for this email has been paused or revoked by the CoverFlow admin.',
      });
    }
    if (tester.expiresAt && tester.expiresAt < new Date()) {
      return reply.code(403).send({ error: 'Your UAT testing window has expired.' });
    }

    const settings = await prisma.uatSettings.findUnique({ where: { id: 'singleton' } });
    if (settings && !settings.testingOpen && tester.role !== 'ADMIN') {
      return reply.code(403).send({
        error: 'CoverFlow broker testing is currently paused by the administrator.',
      });
    }

    if (!verifiedViaGoogle) {
      const code = parsed.data.passcode?.trim() ?? '';
      const expectedCode =
        tester.role === 'ADMIN'
          ? (settings?.adminPasscode ?? 'ADMIN-2026')
          : (settings?.brokerAccessCode ?? 'COVERFLOW-UAT');
      if (code !== expectedCode) {
        return reply.code(401).send({
          error:
            tester.role === 'ADMIN'
              ? 'Invalid admin passcode.'
              : 'Invalid UAT invite passcode. Check your invitation message.',
        });
      }
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);

    await prisma.uatSession.create({
      data: {
        token,
        email: tester.email,
        name: tester.name,
        role: tester.role,
        expiresAt,
      },
    });

    await prisma.allowedTester.update({
      where: { id: tester.id },
      data: { lastSeenAt: new Date() },
    });

    setSessionCookie(reply, token, SESSION_TTL_HOURS * 3600);

    return {
      authenticated: true,
      token,
      user: {
        email: tester.email,
        name: tester.name,
        organization: tester.organization,
        role: tester.role,
      },
    };
  });

  app.post('/api/v1/uat/logout', async (request, reply) => {
    const token = getSessionToken(request);
    if (token) {
      await prisma.uatSession.deleteMany({ where: { token } });
    }
    clearSessionCookie(reply);
    return { loggedOut: true };
  });

  // -------------------------------------------------------------------------
  // Broker Remarks (Any Authenticated Tester)
  // -------------------------------------------------------------------------
  app.post('/api/v1/uat/remarks', async (request, reply) => {
    const user = request.uatUser!;
    const schema = z.object({
      category: z.enum(['PRICING', 'MISSING_FIELD', 'CONFUSING_STEP', 'BUG', 'GREAT']),
      rating: z.number().int().min(1).max(5).optional(),
      mode: z.enum(['BROKER', 'CLIENT_APP']),
      screen: z.string().min(1),
      quoteNumber: z.string().optional().nullable(),
      plate: z.string().optional().nullable(),
      comment: z.string().min(3, 'Please write a short remark (at least 3 characters).'),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid remark' });
    }

    const remark = await prisma.brokerRemark.create({
      data: {
        testerEmail: user.email,
        testerName: user.name,
        organization: user.organization,
        category: parsed.data.category,
        rating: parsed.data.rating ?? null,
        mode: parsed.data.mode,
        screen: parsed.data.screen,
        quoteNumber: parsed.data.quoteNumber ?? null,
        plate: parsed.data.plate ?? null,
        comment: parsed.data.comment.trim(),
      },
    });

    return reply.code(201).send({ remark });
  });

  app.get('/api/v1/uat/remarks/mine', async (request) => {
    const user = request.uatUser!;
    const remarks = await prisma.brokerRemark.findMany({
      where: { testerEmail: user.email },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return { remarks };
  });

  // -------------------------------------------------------------------------
  // Admin-Only Control Panel Routes
  // -------------------------------------------------------------------------
  function requireAdmin(request: FastifyRequest, reply: FastifyReply): boolean {
    if (request.uatUser?.role !== 'ADMIN') {
      reply.code(403).send({ error: 'Admin access required.' });
      return false;
    }
    return true;
  }

  app.get('/api/v1/uat/admin/overview', async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const [settings, testers, remarks] = await Promise.all([
      prisma.uatSettings.findUnique({ where: { id: 'singleton' } }),
      prisma.allowedTester.findMany({ orderBy: [{ role: 'asc' }, { createdAt: 'desc' }] }),
      prisma.brokerRemark.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),
    ]);
    return {
      settings: {
        testingOpen: settings?.testingOpen ?? true,
        brokerAccessCode: settings?.brokerAccessCode ?? 'COVERFLOW-UAT',
        sandboxBannerText: settings?.sandboxBannerText ?? '',
      },
      testers,
      remarks,
    };
  });

  app.patch('/api/v1/uat/admin/settings', async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const parsed = z
      .object({
        testingOpen: z.boolean().optional(),
        brokerAccessCode: z.string().min(4).optional(),
        sandboxBannerText: z.string().min(5).optional(),
      })
      .safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid settings update' });

    const updated = await prisma.uatSettings.update({
      where: { id: 'singleton' },
      data: {
        ...(parsed.data.testingOpen !== undefined ? { testingOpen: parsed.data.testingOpen } : {}),
        ...(parsed.data.brokerAccessCode ? { brokerAccessCode: parsed.data.brokerAccessCode.trim() } : {}),
        ...(parsed.data.sandboxBannerText
          ? { sandboxBannerText: parsed.data.sandboxBannerText.trim() }
          : {}),
      },
    });
    return {
      settings: {
        testingOpen: updated.testingOpen,
        brokerAccessCode: updated.brokerAccessCode,
        sandboxBannerText: updated.sandboxBannerText,
      },
    };
  });

  app.post('/api/v1/uat/admin/testers', async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const parsed = z
      .object({
        email: z.string().email(),
        name: z.string().min(2),
        organization: z.string().optional(),
        role: z.enum(['ADMIN', 'BROKER_TESTER', 'CLIENT_USER']).default('BROKER_TESTER'),
        expiresAt: z.string().optional().nullable(),
      })
      .safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Provide a valid Gmail address and tester name.' });
    }

    const email = parsed.data.email.trim().toLowerCase();
    const tester = await prisma.allowedTester.upsert({
      where: { email },
      create: {
        email,
        name: parsed.data.name.trim(),
        organization: parsed.data.organization?.trim() || null,
        role: parsed.data.role,
        active: true,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      },
      update: {
        name: parsed.data.name.trim(),
        organization: parsed.data.organization?.trim() || null,
        role: parsed.data.role,
        active: true,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      },
    });

    return reply.code(201).send({ tester });
  });

  app.patch('/api/v1/uat/admin/testers/:id', async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { id } = request.params as { id: string };
    const parsed = z
      .object({
        active: z.boolean().optional(),
        expiresAt: z.string().nullable().optional(),
      })
      .safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid update' });

    const existing = await prisma.allowedTester.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'Tester not found' });
    if (existing.email === request.uatUser?.email && parsed.data.active === false) {
      return reply.code(400).send({ error: 'You cannot revoke your own active admin account.' });
    }

    const tester = await prisma.allowedTester.update({
      where: { id },
      data: {
        ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
        ...(parsed.data.expiresAt !== undefined
          ? { expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null }
          : {}),
      },
    });

    // Immediately terminate active sessions if revoked
    if (parsed.data.active === false) {
      await prisma.uatSession.deleteMany({ where: { email: existing.email } });
    }

    return { tester };
  });

  app.delete('/api/v1/uat/admin/testers/:id', async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { id } = request.params as { id: string };
    const existing = await prisma.allowedTester.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'Tester not found' });
    if (existing.email === request.uatUser?.email) {
      return reply.code(400).send({ error: 'Cannot delete your own admin account.' });
    }
    await prisma.uatSession.deleteMany({ where: { email: existing.email } });
    await prisma.allowedTester.delete({ where: { id } });
    return { deleted: true };
  });

  app.patch('/api/v1/uat/admin/remarks/:id', async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { id } = request.params as { id: string };
    const parsed = z.object({ status: z.enum(['NEW', 'REVIEWED', 'RESOLVED']) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid status' });

    const remark = await prisma.brokerRemark.update({
      where: { id },
      data: { status: parsed.data.status },
    });
    return { remark };
  });

  app.get('/api/v1/uat/admin/remarks.csv', async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const remarks = await prisma.brokerRemark.findMany({ orderBy: { createdAt: 'desc' } });
    const headers = [
      'Timestamp',
      'Tester Name',
      'Tester Email',
      'Organization',
      'Category',
      'Rating',
      'Mode',
      'Screen',
      'Quote #',
      'Plate',
      'Status',
      'Comment',
    ];
    const rows = remarks.map((r) =>
      [
        r.createdAt.toISOString(),
        r.testerName,
        r.testerEmail,
        r.organization ?? '',
        r.category,
        r.rating ?? '',
        r.mode,
        r.screen,
        r.quoteNumber ?? '',
        r.plate ?? '',
        r.status,
        r.comment,
      ]
        .map(csvEscape)
        .join(','),
    );
    const csv = [headers.join(','), ...rows].join('\n');
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="coverflow-broker-remarks.csv"')
      .send(csv);
  });
}

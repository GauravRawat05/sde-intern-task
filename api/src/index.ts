// ==============================================================================
// HONO BACKEND APPLICATION SERVER ENTRY POINT (index.ts)
// ==============================================================================
// This file serves as the main controller for the Cloudflare Workers API.
// It implements:
// 1. Security & Cryptography: PBKDF2 hashing, rate limiting, and JWT sessions.
// 2. Stateless CAPTCHA: Prevent automated spam.
// 3. User Authentication: Registration, login, and password reset endpoints.
// 4. Survey Management: CRUD endpoints for custom branded surveys.
// 5. Response Operations: Anonymous submissions and analytical reporting.
// ==============================================================================

import { type Context, Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { sign, verify } from 'hono/jwt'

// Instantiate Hono app and bind Wrangler environment types
const app = new Hono<{ Bindings: Env }>()

// ==============================================================================
// SECURITY & CRYPTOGRAPHY HELPERS
// ==============================================================================

/**
 * Retrieves the client's public IP address from Cloudflare header variables.
 * Falls back to x-real-ip or localhost if headers are missing.
 * Used for rate-limiting and security logging.
 */
function getClientIP(c: Context): string {
  return c.req.header('CF-Connecting-IP') || c.req.header('x-real-ip') || '127.0.0.1'
}

/**
 * Resolves the JWT secret token from Wrangler environment variables.
 * Throws a detailed configuration error if the secret key is undefined.
 */
function getJwtSecret(c: Context): string {
  const secret = c.env?.JWT_SECRET
  if (!secret) {
    throw new Error(
      'CRITICAL CONFIGURATION ERROR: JWT_SECRET environment variable is missing. If running locally, please restart your dev server (pnpm dev) so Wrangler can load the newly created .dev.vars file.',
    )
  }
  return secret
}

/**
 * Structured logger to output security events to console.error in JSON format.
 * Enables logs collection and monitoring for events like rate limit triggers and auth failures.
 */
function logSecurityEvent(event: string, email: string, c: Context, details?: unknown) {
  const logObj = {
    timestamp: new Date().toISOString(),
    event,
    email,
    ip: getClientIP(c),
    userAgent: c.req.header('User-Agent') || 'unknown',
    method: c.req.method,
    path: c.req.path,
    details,
  }
  console.error(JSON.stringify(logObj))
}

// In-Memory cache interface tracking request timestamps for IP-based rate limiting.
interface RateLimitRecord {
  timestamps: number[]
}

// Map cache storing rate limit history per IP address.
const rateLimitCache = new Map<string, RateLimitRecord>()

/**
 * Checks if a specific client IP address has exceeded request thresholds.
 * Filters out expired timestamps outside the validation window.
 */
function isRateLimited(ip: string, limit: number, windowMs: number, keyPrefix: string): boolean {
  const now = Date.now()
  const key = `${keyPrefix}:${ip}`
  let record = rateLimitCache.get(key)
  if (!record) {
    record = { timestamps: [] }
    rateLimitCache.set(key, record)
  }

  // Filter out request timestamps older than the sliding window limit.
  record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs)

  // Block requests if count exceeds limit.
  if (record.timestamps.length >= limit) {
    return true
  }

  // Log active request timestamp.
  record.timestamps.push(now)
  return false
}

/**
 * Hono Middleware generating IP-based rate limiting on sensitive routes.
 * Blocks requests with HTTP 429 Too Many Requests if criteria are violated.
 */
function ipRateLimiter(limit: number, windowMs: number, prefix: string) {
  return async (c: Context, next: () => Promise<void>) => {
    const ip = getClientIP(c)
    if (isRateLimited(ip, limit, windowMs, prefix)) {
      logSecurityEvent('API_RATE_LIMIT_BLOCKED', 'anonymous', c, { limit, windowMs, prefix })
      return c.json({ error: 'Too many requests. Please try again later.' }, 429)
    }
    await next()
  }
}

/**
 * Generates a random 16-byte hex string.
 * Used as a unique salt for PBKDF2 password derivation.
 */
function generateSalt(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Hashes passwords asynchronously using PBKDF2 from Web Crypto API.
 * Uses 100,000 iterations and SHA-256 to hash passwords natively inside Workers.
 */
async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder()
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey'],
  )
  const pbkdf2Params = {
    name: 'PBKDF2',
    salt: encoder.encode(salt),
    iterations: 100000,
    hash: 'SHA-256',
  }
  const derivedBits = await crypto.subtle.deriveBits(
    pbkdf2Params,
    passwordKey,
    256, // 32 bytes
  )
  const hashArray = Array.from(new Uint8Array(derivedBits))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ==============================================================================
// PUBLIC ENDPOINTS
// ==============================================================================

/**
 * Health check endpoint. Used to verify server status.
 */
app.get('/api/health', (c) => c.json({ status: 'ok' }))

/**
 * CAPTCHA Generator - Formulates a random math equation and returns it
 * alongside a cryptographically signed token enclosing the correct answer.
 * Prevents automated bot registrations statelessly.
 */
app.get('/api/auth/captcha', async (c) => {
  const num1 = Math.floor(Math.random() * 19) + 2 // 2 to 20
  const num2 = Math.floor(Math.random() * (num1 - 1)) + 1 // 1 to num1-1 (ensures positive subtraction)
  const isAdd = Math.random() > 0.5
  const operator = isAdd ? '+' : '-'
  const answer = isAdd ? num1 + num2 : num1 - num2

  // Seal the answer inside a signed JWT payload valid for 3 minutes.
  const captchaPayload = {
    answer: answer.toString(),
    exp: Math.floor(Date.now() / 1000) + 180, // 3 minutes validity
  }
  const captchaToken = await sign(captchaPayload, getJwtSecret(c), 'HS256')

  return c.json({
    equation: `What is ${num1} ${operator} ${num2}?`,
    captchaToken,
  })
})

// ==============================================================================
// AUTHENTICATION CONTROLLERS
// ==============================================================================

/**
 * Signup Endpoint - Validates the stateless math CAPTCHA, validates email/password criteria,
 * hashes the password with PBKDF2, stores user records in D1, and issues a stateless session cookie.
 */
app.post('/api/auth/signup', ipRateLimiter(10, 10 * 60 * 1000, 'auth'), async (c) => {
  try {
    const { email, password, captchaAnswer, captchaToken } = await c.req.json<{
      email?: string
      password?: string
      captchaAnswer?: string
      captchaToken?: string
    }>()

    // 1. Verify math CAPTCHA response
    if (!captchaAnswer || !captchaToken) {
      logSecurityEvent('AUTH_SIGNUP_FAILED', email || 'unknown', c, { reason: 'CAPTCHA missing' })
      return c.json({ error: 'CAPTCHA verification is required.' }, 400)
    }
    try {
      const captchaPayload = (await verify(captchaToken, getJwtSecret(c), 'HS256')) as {
        answer: string
      }
      if (captchaPayload.answer !== captchaAnswer.trim()) {
        logSecurityEvent('AUTH_SIGNUP_FAILED', email || 'unknown', c, {
          reason: 'Incorrect CAPTCHA answer',
        })
        return c.json({ error: 'Incorrect CAPTCHA answer.' }, 400)
      }
    } catch {
      logSecurityEvent('AUTH_SIGNUP_FAILED', email || 'unknown', c, {
        reason: 'CAPTCHA expired or invalid',
      })
      return c.json(
        {
          error: 'CAPTCHA verification expired. Please try again.',
        },
        400,
      )
    }

    // 2. Validate password parameters and email structures
    if (!email?.includes('@') || !password || password.length < 6) {
      logSecurityEvent('AUTH_SIGNUP_FAILED', email || 'unknown', c, { reason: 'Validation failed' })
      return c.json(
        {
          error: 'A valid email and a password of at least 6 characters are required.',
        },
        400,
      )
    }

    const normalizedEmail = email.trim().toLowerCase()

    // 3. Confirm email is not already registered
    const existingUser = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
      .bind(normalizedEmail)
      .first<{ id: string }>()

    if (existingUser) {
      logSecurityEvent('AUTH_SIGNUP_FAILED', normalizedEmail, c, {
        reason: 'Account already exists',
      })
      return c.json(
        {
          error: 'An account with this email already exists.',
          code: 'EXISTING_USER',
        },
        400,
      )
    }

    // 4. Create new user account with secure PBKDF2 hash
    const salt = generateSalt()
    const passwordHash = await hashPassword(password, salt)
    const newUserId = crypto.randomUUID()

    await c.env.DB.prepare(
      'INSERT INTO users (id, email, password_hash, password_salt) VALUES (?, ?, ?, ?)',
    )
      .bind(newUserId, normalizedEmail, passwordHash, salt)
      .run()

    // 5. Issue signed session token as an HTTP-only secure cookie
    const payload = {
      id: newUserId,
      email: normalizedEmail,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days validity
    }
    const token = await sign(payload, getJwtSecret(c), 'HS256')

    setCookie(c, 'session', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    })

    logSecurityEvent('AUTH_SIGNUP_SUCCESS', normalizedEmail, c, { userId: newUserId })
    return c.json({ user: { id: newUserId, email: normalizedEmail } })
  } catch (error) {
    console.error('Sign up error:', error)
    logSecurityEvent('AUTH_SIGNUP_FAILED', 'unknown', c, {
      reason: 'Internal error',
      error: String(error),
    })
    return c.json({ error: 'Internal server error during registration.' }, 500)
  }
})

/**
 * Sign In Endpoint - Validates credentials, updates older plain mock accounts,
 * and sets the session cookie upon successful authentication.
 */
app.post('/api/auth/login', ipRateLimiter(10, 10 * 60 * 1000, 'auth'), async (c) => {
  let email: string | undefined
  try {
    const body = await c.req.json<{
      email?: string
      password?: string
    }>()
    email = body.email
    const password = body.password

    if (!email?.includes('@') || !password) {
      logSecurityEvent('AUTH_LOGIN_FAILED', email || 'unknown', c, {
        reason: 'Missing credentials',
      })
      return c.json({ error: 'Email and password are required.' }, 400)
    }

    const normalizedEmail = email.trim().toLowerCase()

    // 1. Fetch user data from D1 Database
    const user = await c.env.DB.prepare(
      'SELECT id, email, password_hash, password_salt FROM users WHERE email = ?',
    )
      .bind(normalizedEmail)
      .first<{
        id: string
        email: string
        password_hash?: string
        password_salt?: string
      }>()

    // 2. Return code to request signup if email does not exist
    if (!user) {
      logSecurityEvent('AUTH_LOGIN_FAILED', normalizedEmail, c, { reason: 'User not found' })
      return c.json(
        {
          error: 'No account found with this email. Please sign up first.',
          code: 'NEW_USER',
        },
        400,
      )
    }

    // 3. Progressive User Migration: Hashing plain passwords for mock/legacy accounts on first login
    if (!user.password_hash || !user.password_salt) {
      const salt = generateSalt()
      const hash = await hashPassword(password, salt)
      await c.env.DB.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?')
        .bind(hash, salt, user.id)
        .run()

      user.password_hash = hash
      user.password_salt = salt
    }

    // 4. Validate computed PBKDF2 hash matches database records
    const inputHash = await hashPassword(password, user.password_salt)
    if (inputHash !== user.password_hash) {
      logSecurityEvent('AUTH_LOGIN_FAILED', normalizedEmail, c, { reason: 'Password mismatch' })
      return c.json({ error: 'Incorrect email or password.' }, 400)
    }

    // 5. Issue secure session cookies enclosing signed user JWT
    const payload = {
      id: user.id,
      email: user.email,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
    }

    const token = await sign(payload, getJwtSecret(c), 'HS256')

    setCookie(c, 'session', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    })

    logSecurityEvent('AUTH_LOGIN_SUCCESS', normalizedEmail, c, { userId: user.id })
    return c.json({ user: { id: user.id, email: user.email } })
  } catch (error) {
    console.error('Login error:', error)
    logSecurityEvent('AUTH_LOGIN_FAILED', email || 'unknown', c, {
      reason: 'Internal error',
      error: String(error),
    })
    return c.json({ error: 'Internal server error during sign in.' }, 500)
  }
})

/**
 * Reset Password Endpoint - Overwrites password hashes securely.
 * Checks stateless math CAPTCHA validity before committing the database change.
 */
app.post('/api/auth/reset-password', ipRateLimiter(10, 10 * 60 * 1000, 'auth'), async (c) => {
  let email: string | undefined
  try {
    const body = await c.req.json<{
      email?: string
      captchaAnswer?: string
      captchaToken?: string
      newPassword?: string
    }>()
    email = body.email
    const { captchaAnswer, captchaToken, newPassword } = body

    // 1. Verify CAPTCHA validation
    if (!captchaAnswer || !captchaToken) {
      logSecurityEvent('AUTH_PASSWORD_RESET_FAILED', email || 'unknown', c, {
        reason: 'CAPTCHA missing',
      })
      return c.json({ error: 'CAPTCHA verification is required.' }, 400)
    }
    try {
      const captchaPayload = (await verify(captchaToken, getJwtSecret(c), 'HS256')) as {
        answer: string
      }
      if (captchaPayload.answer !== captchaAnswer.trim()) {
        logSecurityEvent('AUTH_PASSWORD_RESET_FAILED', email || 'unknown', c, {
          reason: 'Incorrect CAPTCHA answer',
        })
        return c.json({ error: 'Incorrect CAPTCHA answer.' }, 400)
      }
    } catch {
      logSecurityEvent('AUTH_PASSWORD_RESET_FAILED', email || 'unknown', c, {
        reason: 'CAPTCHA expired or invalid',
      })
      return c.json(
        {
          error: 'CAPTCHA verification expired. Please try again.',
        },
        400,
      )
    }

    // 2. Validate input constraints
    if (!email || !newPassword || newPassword.length < 6) {
      logSecurityEvent('AUTH_PASSWORD_RESET_FAILED', email || 'unknown', c, {
        reason: 'Validation failed',
      })
      return c.json(
        {
          error: 'A valid email and a new password of at least 6 characters are required.',
        },
        400,
      )
    }

    const normalizedEmail = email.trim().toLowerCase()

    // 3. Retrieve user ID
    const user = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
      .bind(normalizedEmail)
      .first<{ id: string }>()

    if (!user) {
      logSecurityEvent('AUTH_PASSWORD_RESET_FAILED', normalizedEmail, c, {
        reason: 'User not found',
      })
      return c.json({ error: 'No account found with this email.' }, 400)
    }

    // 4. Generate new password salt and PBKDF2 hash, then update the record
    const salt = generateSalt()
    const passwordHash = await hashPassword(newPassword, salt)

    await c.env.DB.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?')
      .bind(passwordHash, salt, user.id)
      .run()

    logSecurityEvent('AUTH_PASSWORD_RESET_SUCCESS', normalizedEmail, c)
    return c.json({ success: true })
  } catch (error) {
    console.error('Password reset error:', error)
    logSecurityEvent('AUTH_PASSWORD_RESET_FAILED', email || 'unknown', c, {
      reason: 'Internal error',
      error: String(error),
    })
    return c.json({ error: 'Internal server error during password reset.' }, 500)
  }
})

/**
 * GET '/api/auth/me' - Verifies active session token cookie.
 * Decodes the JWT, checks database presence, and returns active user details.
 */
app.get('/api/auth/me', async (c) => {
  try {
    const token = getCookie(c, 'session')

    if (!token) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    // Decode and verify JWT session token
    const payload = (await verify(token, getJwtSecret(c), 'HS256')) as {
      id: string
      email: string
    }

    if (!payload?.id) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    return c.json({
      user: {
        id: payload.id,
        email: payload.email,
      },
    })
  } catch (error) {
    console.error('Session verification error:', error)
    return c.json({ error: 'Unauthorized' }, 401)
  }
})

/**
 * POST '/api/auth/logout' - Clears local session cookie configuration.
 * Triggers client-side state cleanup.
 */
app.post('/api/auth/logout', (c) => {
  deleteCookie(c, 'session', {
    path: '/',
    secure: true,
    sameSite: 'Lax',
  })
  return c.json({ success: true })
})

// ==============================================================================
// AUTHENTICATION MIDDLEWARE HELPERS
// ==============================================================================

/**
 * Extracts and decodes user parameters from the session JWT cookie.
 * Returns decoded properties (ID, Email) or null if invalid/unauthenticated.
 */
async function getAuthenticatedUser(c: Context): Promise<{ id: string; email: string } | null> {
  const token = getCookie(c, 'session')
  if (!token) return null
  try {
    const payload = (await verify(token, getJwtSecret(c), 'HS256')) as {
      id: string
      email: string
    }
    return payload?.id ? payload : null
  } catch {
    return null
  }
}

// Database schema interface representation for Surveys.
interface DBSurvey {
  id: string
  title: string
  primary_color: string
  logo_url: string
  font_family: string
  is_published: number
  created_at: string
  response_count: number
}

// ==============================================================================
// SURVEY MANAGEMENT ROUTES (PRIVATE CRUD)
// ==============================================================================

/**
 * GET '/api/surveys' - Lists all surveys created by the logged-in owner.
 * Joins with response counters to display completion volume in the dashboard.
 */
app.get('/api/surveys', async (c) => {
  const user = await getAuthenticatedUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  try {
    const { results } = await c.env.DB.prepare(`
      SELECT s.id, s.title, s.primary_color, s.logo_url, s.font_family, s.is_published, s.created_at, COUNT(r.id) AS response_count
      FROM surveys s
      LEFT JOIN responses r ON s.id = r.survey_id
      WHERE s.owner_id = ?
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `)
      .bind(user.id)
      .all<DBSurvey>()

    return c.json({ surveys: results })
  } catch (error) {
    console.error('List surveys error:', error)
    return c.json({ error: 'Failed to fetch surveys' }, 500)
  }
})

/**
 * POST '/api/surveys' - Creates a new blank survey record for the authenticated owner.
 * Initializes default branding (blue theme, Manrope font).
 */
app.post('/api/surveys', async (c) => {
  const user = await getAuthenticatedUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  try {
    const { title, primary_color, logo_url } = await c.req.json<{
      title?: string
      primary_color?: string
      logo_url?: string
    }>()

    const surveyId = crypto.randomUUID()
    const finalTitle = title?.trim() || 'Untitled Survey'
    const finalColor = primary_color?.trim() || '#3b82f6'
    const finalLogo = logo_url?.trim() || ''

    await c.env.DB.prepare(`
      INSERT INTO surveys (id, title, primary_color, logo_url, font_family, owner_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
      .bind(surveyId, finalTitle, finalColor, finalLogo, 'Manrope', user.id)
      .run()

    const survey = {
      id: surveyId,
      title: finalTitle,
      primary_color: finalColor,
      logo_url: finalLogo,
      font_family: 'Manrope',
      owner_id: user.id,
      created_at: new Date().toISOString(),
      response_count: 0,
    }

    return c.json({ survey })
  } catch (error) {
    console.error('Create survey error:', error)
    return c.json({ error: 'Failed to create survey' }, 500)
  }
})

/**
 * GET '/api/surveys/:id' - Fetches metadata and question list for a specific survey.
 * Strictly checks owner credentials to prevent unauthorized edits.
 */
app.get('/api/surveys/:id', async (c) => {
  const user = await getAuthenticatedUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const surveyId = c.req.param('id')

  try {
    // Confirm ownership
    const survey = await c.env.DB.prepare('SELECT * FROM surveys WHERE id = ? AND owner_id = ?')
      .bind(surveyId, user.id)
      .first<{
        id: string
        title: string
        primary_color: string
        logo_url: string
        font_family: string
        owner_id: string
        created_at: string
        is_published: number
      }>()

    if (!survey) {
      return c.json({ error: 'Survey not found or access denied' }, 404)
    }

    // Fetch related questions ordered sequentially
    const { results: questions } = await c.env.DB.prepare(
      'SELECT * FROM questions WHERE survey_id = ? ORDER BY order_index ASC',
    )
      .bind(surveyId)
      .all<{
        id: string
        survey_id: string
        type: string
        label: string
        options: string
        required: number
        order_index: number
      }>()

    // Parse options lists stored as JSON arrays
    const parsedQuestions = questions.map((q) => {
      let options: string[] = []
      try {
        options = JSON.parse(q.options || '[]')
      } catch {
        options = []
      }
      return {
        ...q,
        required: q.required === 1,
        options,
      }
    })

    return c.json({ survey, questions: parsedQuestions })
  } catch (error) {
    console.error('Fetch survey error:', error)
    return c.json({ error: 'Failed to fetch survey details' }, 500)
  }
})

/**
 * PUT '/api/surveys/:id' - Updates survey metadata (title, colors, font, status)
 * and uses SQL batching to synchronize question lists (delete, update, insert).
 * Ensures modifications are atomic.
 */
app.put('/api/surveys/:id', async (c) => {
  const user = await getAuthenticatedUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const surveyId = c.req.param('id')

  try {
    // Confirm ownership
    const survey = await c.env.DB.prepare(
      'SELECT id, is_published FROM surveys WHERE id = ? AND owner_id = ?',
    )
      .bind(surveyId, user.id)
      .first<{ id: string; is_published: number }>()

    if (!survey) {
      return c.json({ error: 'Survey not found or access denied' }, 404)
    }

    const { title, primary_color, logo_url, font_family, is_published, questions } =
      await c.req.json<{
        title?: string
        primary_color?: string
        logo_url?: string
        font_family?: string
        is_published?: number
        questions?: Array<{
          id?: string
          type: string
          label: string
          options?: string[]
          required: boolean
          order_index: number
        }>
      }>()

    const finalTitle = title?.trim() || 'Untitled Survey'
    const finalColor = primary_color?.trim() || '#3b82f6'
    const finalLogo = logo_url?.trim() || ''
    const finalFont = font_family?.trim() || 'Manrope'
    const finalPublished = is_published !== undefined ? is_published : survey.is_published

    // Update main survey settings
    await c.env.DB.prepare(`
      UPDATE surveys 
      SET title = ?, primary_color = ?, logo_url = ?, font_family = ?, is_published = ?
      WHERE id = ? AND owner_id = ?
    `)
      .bind(finalTitle, finalColor, finalLogo, finalFont, finalPublished, surveyId, user.id)
      .run()

    // Synchronize questions using batch queries
    if (questions) {
      const { results: existing } = await c.env.DB.prepare(
        'SELECT id FROM questions WHERE survey_id = ?',
      )
        .bind(surveyId)
        .all<{ id: string }>()

      const existingIds = existing.map((e) => e.id)
      const incomingIds = questions.map((q) => q.id).filter((id): id is string => !!id)
      const idsToDelete = existingIds.filter((id) => !incomingIds.includes(id))

      const batchStatements = []

      // Delete questions removed in builder UI
      for (const id of idsToDelete) {
        batchStatements.push(c.env.DB.prepare('DELETE FROM questions WHERE id = ?').bind(id))
      }

      // Update existing questions or insert newly added ones
      for (const q of questions) {
        const qId = q.id || crypto.randomUUID()
        const qRequired = q.required ? 1 : 0
        const qOptions = JSON.stringify(q.options || [])

        if (q.id && existingIds.includes(q.id)) {
          batchStatements.push(
            c.env.DB.prepare(`
              UPDATE questions 
              SET type = ?, label = ?, options = ?, required = ?, order_index = ?
              WHERE id = ? AND survey_id = ?
            `).bind(q.type, q.label, qOptions, qRequired, q.order_index, q.id, surveyId),
          )
        } else {
          batchStatements.push(
            c.env.DB.prepare(`
              INSERT INTO questions (id, survey_id, type, label, options, required, order_index)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `).bind(qId, surveyId, q.type, q.label, qOptions, qRequired, q.order_index),
          )
        }
      }

      // Execute all operations in a single HTTP batch transaction
      if (batchStatements.length > 0) {
        await c.env.DB.batch(batchStatements)
      }
    }

    return c.json({ success: true })
  } catch (error) {
    console.error('Update survey error:', error)
    return c.json({ error: 'Failed to update survey' }, 500)
  }
})

/**
 * DELETE '/api/surveys/:id' - Deletes survey records and cascading elements
 * (questions, responses, answers) from the SQLite database.
 */
app.delete('/api/surveys/:id', async (c) => {
  const user = await getAuthenticatedUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const surveyId = c.req.param('id')

  try {
    const survey = await c.env.DB.prepare('SELECT id FROM surveys WHERE id = ? AND owner_id = ?')
      .bind(surveyId, user.id)
      .first()

    if (!survey) {
      return c.json({ error: 'Survey not found or access denied' }, 404)
    }

    await c.env.DB.prepare('DELETE FROM surveys WHERE id = ?').bind(surveyId).run()

    return c.json({ success: true })
  } catch (error) {
    console.error('Delete survey error:', error)
    return c.json({ error: 'Failed to delete survey' }, 500)
  }
})

// ==============================================================================
// PUBLIC SURVEY RESPONDENT ENDPOINTS (NO AUTH REQUIRED)
// ==============================================================================

/**
 * GET '/api/public/surveys/:id' - Fetches public branding and question list.
 * Blocks rendering with HTTP 403 if the owner toggled publication off.
 */
app.get('/api/public/surveys/:id', async (c) => {
  const surveyId = c.req.param('id')

  try {
    const survey = await c.env.DB.prepare(
      'SELECT id, title, primary_color, logo_url, font_family, is_published FROM surveys WHERE id = ?',
    )
      .bind(surveyId)
      .first<{
        id: string
        title: string
        primary_color: string
        logo_url: string
        font_family: string
        is_published: number
      }>()

    if (!survey) {
      return c.json({ error: 'Survey not found' }, 404)
    }

    // Return closed status if unpublished
    if (survey.is_published === 0) {
      return c.json(
        {
          error: 'Survey is closed',
          isClosed: true,
          survey: {
            id: survey.id,
            title: survey.title,
            primary_color: survey.primary_color,
            logo_url: survey.logo_url,
            font_family: survey.font_family,
          },
        },
        403,
      )
    }

    const { results: questions } = await c.env.DB.prepare(
      'SELECT id, type, label, options, required, order_index FROM questions WHERE survey_id = ? ORDER BY order_index ASC',
    )
      .bind(surveyId)
      .all<{
        id: string
        type: string
        label: string
        options: string
        required: number
        order_index: number
      }>()

    const parsedQuestions = questions.map((q) => {
      let options: string[] = []
      try {
        options = JSON.parse(q.options || '[]')
      } catch {
        options = []
      }
      return {
        ...q,
        required: q.required === 1,
        options,
      }
    })

    return c.json({ survey, questions: parsedQuestions })
  } catch (error) {
    console.error('Fetch public survey error:', error)
    return c.json({ error: 'Failed to fetch public survey details' }, 500)
  }
})

/**
 * POST '/api/public/surveys/:id/responses' - Saves anonymous respondent inputs.
 * Validates required questions, and batches answer insertions inside a single transaction.
 */
app.post(
  '/api/public/surveys/:id/responses',
  ipRateLimiter(15, 10 * 60 * 1000, 'responses'),
  async (c) => {
    const surveyId = c.req.param('id')

    try {
      const survey = await c.env.DB.prepare('SELECT is_published FROM surveys WHERE id = ?')
        .bind(surveyId)
        .first<{ is_published: number }>()

      if (!survey) {
        return c.json({ error: 'Survey not found' }, 404)
      }

      if (survey.is_published === 0) {
        return c.json({ error: 'Survey is closed' }, 403)
      }

      const { answers } = await c.req.json<{
        answers?: Array<{
          questionId: string
          value: string
        }>
      }>()

      if (!answers || !Array.isArray(answers)) {
        return c.json({ error: 'Answers are required' }, 400)
      }

      // Fetch questions to check validations
      const { results: questions } = await c.env.DB.prepare(
        'SELECT id, label, required, type FROM questions WHERE survey_id = ?',
      )
        .bind(surveyId)
        .all<{ id: string; label: string; required: number; type: string }>()

      if (questions.length === 0) {
        return c.json({ error: 'Survey has no questions or does not exist' }, 404)
      }

      const answerMap = new Map<string, string>()
      for (const ans of answers) {
        answerMap.set(ans.questionId, ans.value)
      }

      // Enforce validation for required questions
      for (const q of questions) {
        const value = answerMap.get(q.id)
        if (q.required === 1 && (!value || value.trim() === '')) {
          return c.json({ error: `Question "${q.label}" is required` }, 400)
        }
      }

      // Write response logs transactionally using batched operations
      const responseId = crypto.randomUUID()
      const batchStatements = [
        c.env.DB.prepare('INSERT INTO responses (id, survey_id) VALUES (?, ?)').bind(
          responseId,
          surveyId,
        ),
      ]

      for (const ans of answers) {
        const cleanValue = ans.value?.toString() || ''
        const answerId = crypto.randomUUID()
        batchStatements.push(
          c.env.DB.prepare(
            'INSERT INTO answers (id, response_id, question_id, value) VALUES (?, ?, ?, ?)',
          ).bind(answerId, responseId, ans.questionId, cleanValue),
        )
      }

      // Commit transaction
      await c.env.DB.batch(batchStatements)

      return c.json({ success: true, responseId })
    } catch (error) {
      console.error('Submit response error:', error)
      return c.json({ error: 'Failed to submit response' }, 500)
    }
  },
)

// ==============================================================================
// ANALYTICS & REPORTING ENDPOINTS (PRIVATE OWNER ACCESS)
// ==============================================================================

/**
 * GET '/api/surveys/:id/responses' - Calculates metrics (completion rate, ratings averages)
 * and maps answer logs to respondent logs. Authenticates ownership to restrict access.
 */
app.get('/api/surveys/:id/responses', async (c) => {
  const user = await getAuthenticatedUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const surveyId = c.req.param('id')

  try {
    // Authenticate ownership
    const survey = await c.env.DB.prepare(
      'SELECT id, title, primary_color, logo_url, font_family, is_published FROM surveys WHERE id = ? AND owner_id = ?',
    )
      .bind(surveyId, user.id)
      .first<{
        id: string
        title: string
        primary_color: string
        logo_url: string
        font_family: string
        is_published: number
      }>()

    if (!survey) {
      return c.json({ error: 'Survey not found or access denied' }, 404)
    }

    // Fetch related items: questions, responses, and answers
    const { results: questions } = await c.env.DB.prepare(
      'SELECT id, label, type, options FROM questions WHERE survey_id = ? ORDER BY order_index ASC',
    )
      .bind(surveyId)
      .all<{ id: string; label: string; type: string; options: string }>()

    const { results: responses } = await c.env.DB.prepare(
      'SELECT id, created_at FROM responses WHERE survey_id = ? ORDER BY created_at DESC',
    )
      .bind(surveyId)
      .all<{ id: string; created_at: string }>()

    const { results: answers } = await c.env.DB.prepare(`
      SELECT a.response_id, a.question_id, a.value
      FROM answers a
      JOIN responses r ON a.response_id = r.id
      WHERE r.survey_id = ?
    `)
      .bind(surveyId)
      .all<{ response_id: string; question_id: string; value: string }>()

    // Index answers by their parent response log
    const answersByResponse = new Map<string, Array<{ question_id: string; value: string }>>()
    for (const ans of answers) {
      if (!answersByResponse.has(ans.response_id)) {
        answersByResponse.set(ans.response_id, [])
      }
      answersByResponse.get(ans.response_id)?.push(ans)
    }

    const totalResponses = responses.length
    const ratingQuestions = questions.filter((q) => q.type === 'rating')
    let totalRatingSum = 0
    let ratingCount = 0

    // Compute metrics
    const totalPossibleAnswers = totalResponses * questions.length
    const totalActualAnswers = answers.length
    const completionRate =
      totalPossibleAnswers > 0 ? Math.round((totalActualAnswers / totalPossibleAnswers) * 100) : 100

    const responseList = responses.map((r) => {
      const rAnswers = answersByResponse.get(r.id) || []
      const answerMap: Record<string, string> = {}
      for (const ans of rAnswers) {
        answerMap[ans.question_id] = ans.value

        // Aggregate 1-5 rating questions to compute average rating scores
        const qInfo = ratingQuestions.find((q) => q.id === ans.question_id)
        if (qInfo) {
          const ratingVal = Number.parseInt(ans.value, 10)
          if (!Number.isNaN(ratingVal)) {
            totalRatingSum += ratingVal
            ratingCount++
          }
        }
      }

      return {
        id: r.id,
        created_at: r.created_at,
        answers: answerMap,
      }
    })

    const averageRating = ratingCount > 0 ? Number((totalRatingSum / ratingCount).toFixed(1)) : 0

    return c.json({
      survey,
      questions: questions.map((q) => {
        let options: string[] = []
        try {
          options = JSON.parse(q.options || '[]')
        } catch {
          options = []
        }
        return { ...q, options }
      }),
      stats: {
        totalResponses,
        completionRate,
        averageRating,
      },
      responses: responseList,
    })
  } catch (error) {
    console.error('Fetch survey responses error:', error)
    return c.json({ error: 'Failed to fetch responses and analytics' }, 500)
  }
})

export default app

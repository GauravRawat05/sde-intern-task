import { type Context, Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { sign, verify } from 'hono/jwt'

const app = new Hono<{ Bindings: Env }>()

// Fallback JWT secret for local development
const JWT_SECRET = 'sde-intern-task-survey-builder-jwt-secret'

// Health check endpoint
app.get('/api/health', (c) => c.json({ status: 'ok' }))

// Authenticate / login user (Stateless JWT Session creation)
app.post('/api/auth/login', async (c) => {
  try {
    const { email } = await c.req.json<{ email?: string }>()

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return c.json({ error: 'A valid email address is required' }, 400)
    }

    const normalizedEmail = email.trim().toLowerCase()

    // 1. Check if user exists in D1 database
    let user = await c.env.DB.prepare('SELECT id, email FROM users WHERE email = ?')
      .bind(normalizedEmail)
      .first<{ id: string; email: string }>()

    // 2. If user does not exist, create a new record
    if (!user) {
      const newUserId = crypto.randomUUID()
      await c.env.DB.prepare('INSERT INTO users (id, email) VALUES (?, ?)')
        .bind(newUserId, normalizedEmail)
        .run()

      user = { id: newUserId, email: normalizedEmail }
    }

    // 3. Issue signed JWT session token (valid for 7 days)
    const payload = {
      id: user.id,
      email: user.email,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
    }

    const token = await sign(payload, JWT_SECRET)

    // 4. Set secure HttpOnly session cookie
    setCookie(c, 'session', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
    })

    return c.json({ user })
  } catch (error) {
    console.error('Login error:', error)
    return c.json({ error: 'Internal server error during authentication' }, 500)
  }
})

// Fetch current user details (Verify stateless session)
app.get('/api/auth/me', async (c) => {
  try {
    const token = getCookie(c, 'session')

    if (!token) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    // Verify and decode JWT token
    const payload = (await verify(token, JWT_SECRET, 'HS256')) as { id: string; email: string }

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

// Logout user (Delete session cookie)
app.post('/api/auth/logout', (c) => {
  deleteCookie(c, 'session', {
    path: '/',
    secure: true,
    sameSite: 'Lax',
  })
  return c.json({ success: true })
})

// Helper middleware/function to verify user session
async function getAuthenticatedUser(c: Context): Promise<{ id: string; email: string } | null> {
  const token = getCookie(c, 'session')
  if (!token) return null
  try {
    const payload = (await verify(token, JWT_SECRET, 'HS256')) as { id: string; email: string }
    return payload?.id ? payload : null
  } catch {
    return null
  }
}

interface DBSurvey {
  id: string
  title: string
  primary_color: string
  logo_url: string
  created_at: string
  response_count: number
}

// List surveys belonging to current user
app.get('/api/surveys', async (c) => {
  const user = await getAuthenticatedUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  try {
    const { results } = await c.env.DB.prepare(`
      SELECT s.id, s.title, s.primary_color, s.logo_url, s.created_at, COUNT(r.id) AS response_count
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

// Create a new survey
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
      INSERT INTO surveys (id, title, primary_color, logo_url, owner_id)
      VALUES (?, ?, ?, ?, ?)
    `)
      .bind(surveyId, finalTitle, finalColor, finalLogo, user.id)
      .run()

    const survey = {
      id: surveyId,
      title: finalTitle,
      primary_color: finalColor,
      logo_url: finalLogo,
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

// Fetch single survey details & questions (Owner only)
app.get('/api/surveys/:id', async (c) => {
  const user = await getAuthenticatedUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const surveyId = c.req.param('id')

  try {
    const survey = await c.env.DB.prepare('SELECT * FROM surveys WHERE id = ? AND owner_id = ?')
      .bind(surveyId, user.id)
      .first<{
        id: string
        title: string
        primary_color: string
        logo_url: string
        owner_id: string
        created_at: string
      }>()

    if (!survey) {
      return c.json({ error: 'Survey not found or access denied' }, 404)
    }

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

// Update survey title, brand color, logo, and questions (Owner only)
app.put('/api/surveys/:id', async (c) => {
  const user = await getAuthenticatedUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const surveyId = c.req.param('id')

  try {
    const { title, primary_color, logo_url, questions } = await c.req.json<{
      title?: string
      primary_color?: string
      logo_url?: string
      questions?: Array<{
        id?: string
        type: string
        label: string
        options?: string[]
        required: boolean
        order_index: number
      }>
    }>()

    const survey = await c.env.DB.prepare('SELECT id FROM surveys WHERE id = ? AND owner_id = ?')
      .bind(surveyId, user.id)
      .first()

    if (!survey) {
      return c.json({ error: 'Survey not found or access denied' }, 404)
    }

    const finalTitle = title?.trim() || 'Untitled Survey'
    const finalColor = primary_color?.trim() || '#3b82f6'
    const finalLogo = logo_url?.trim() || ''

    await c.env.DB.prepare(`
      UPDATE surveys 
      SET title = ?, primary_color = ?, logo_url = ?
      WHERE id = ? AND owner_id = ?
    `)
      .bind(finalTitle, finalColor, finalLogo, surveyId, user.id)
      .run()

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

      // Delete removed questions
      for (const id of idsToDelete) {
        batchStatements.push(c.env.DB.prepare('DELETE FROM questions WHERE id = ?').bind(id))
      }

      // Insert or update remaining questions
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

// Delete a survey (Owner only)
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

// Fetch public survey details (Unauthenticated)
app.get('/api/public/surveys/:id', async (c) => {
  const surveyId = c.req.param('id')

  try {
    const survey = await c.env.DB.prepare(
      'SELECT id, title, primary_color, logo_url FROM surveys WHERE id = ?',
    )
      .bind(surveyId)
      .first<{
        id: string
        title: string
        primary_color: string
        logo_url: string
      }>()

    if (!survey) {
      return c.json({ error: 'Survey not found' }, 404)
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

// Submit public survey response anonymously (Unauthenticated)
app.post('/api/public/surveys/:id/responses', async (c) => {
  const surveyId = c.req.param('id')

  try {
    const { answers } = await c.req.json<{
      answers?: Array<{
        questionId: string
        value: string
      }>
    }>()

    if (!answers || !Array.isArray(answers)) {
      return c.json({ error: 'Answers are required' }, 400)
    }

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

    for (const q of questions) {
      const value = answerMap.get(q.id)
      if (q.required === 1 && (!value || value.trim() === '')) {
        return c.json({ error: `Question "${q.label}" is required` }, 400)
      }
    }

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

    await c.env.DB.batch(batchStatements)

    return c.json({ success: true, responseId })
  } catch (error) {
    console.error('Submit response error:', error)
    return c.json({ error: 'Failed to submit response' }, 500)
  }
})

// Fetch survey responses and analytics (Owner only)
app.get('/api/surveys/:id/responses', async (c) => {
  const user = await getAuthenticatedUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const surveyId = c.req.param('id')

  try {
    const survey = await c.env.DB.prepare(
      'SELECT id, title, primary_color, logo_url FROM surveys WHERE id = ? AND owner_id = ?',
    )
      .bind(surveyId, user.id)
      .first<{
        id: string
        title: string
        primary_color: string
        logo_url: string
      }>()

    if (!survey) {
      return c.json({ error: 'Survey not found or access denied' }, 404)
    }

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

    const totalPossibleAnswers = totalResponses * questions.length
    const totalActualAnswers = answers.length
    const completionRate =
      totalPossibleAnswers > 0 ? Math.round((totalActualAnswers / totalPossibleAnswers) * 100) : 100

    const responseList = responses.map((r) => {
      const rAnswers = answersByResponse.get(r.id) || []
      const answerMap: Record<string, string> = {}
      for (const ans of rAnswers) {
        answerMap[ans.question_id] = ans.value

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

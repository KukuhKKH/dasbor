const AUTH_RATE_LIMIT = 10
const AUTH_WINDOW_MS = 60_000

export default defineEventHandler(async (event) => {
  const ip = getClientIp(event)

  if (!checkRateLimit(ip, AUTH_RATE_LIMIT, AUTH_WINDOW_MS)) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many login attempts, please try again later',
    })
  }

  const body = await readBody(event)
  const correctPassword = getDockerPassword(event)

  if (body?.password === correctPassword) {
    const token = createDockerAuthToken(correctPassword)

    setCookie(event, 'docker_auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'strict',
      path: '/',
    })

    setCookie(event, 'docker_is_authenticated', 'true', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'strict',
      path: '/',
    })

    return { success: true }
  }

  throw createError({
    statusCode: 401,
    statusMessage: 'Invalid password',
  })
})

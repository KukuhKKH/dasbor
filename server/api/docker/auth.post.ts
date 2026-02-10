import { createError } from 'h3'

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const config = useRuntimeConfig()

    const correctPassword = process.env.DOCKER_CONTROL_PASSWORD

    if (!correctPassword) {
        throw createError({
            statusCode: 500,
            statusMessage: 'Docker control password not configured on server'
        })
    }

    if (body.password === correctPassword) {
        setCookie(event, 'docker_auth_token', 'valid', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60 * 24 * 7,
            path: '/'
        })

        setCookie(event, 'docker_is_authenticated', 'true', {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60 * 24 * 7,
            path: '/'
        })

        return {
            success: true
        }
    }

    throw createError({
        statusCode: 401,
        statusMessage: 'Invalid password'
    })
})

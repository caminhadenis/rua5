package com.streetfootball.game.shared.health

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter

@Component
class ResponseCacheFilter : OncePerRequestFilter() {
    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        when {
            request.requestURI.startsWith("/api/") -> response.setHeader("Cache-Control", "no-store")
            request.requestURI in setOf("/", "/index.html") -> response.setHeader("Cache-Control", "no-cache")
        }
        filterChain.doFilter(request, response)
    }
}

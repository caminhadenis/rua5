package com.streetfootball.game.account

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.session.config.SessionRepositoryCustomizer
import org.springframework.session.jdbc.JdbcIndexedSessionRepository
import org.springframework.session.jdbc.PostgreSqlJdbcIndexedSessionRepositoryCustomizer

@Configuration
class SessionConfiguration {
    // Spring's PostgreSQL queries handle attributes first written by concurrent requests.
    @Bean
    fun postgresSessionQueries(): SessionRepositoryCustomizer<JdbcIndexedSessionRepository> =
        PostgreSqlJdbcIndexedSessionRepositoryCustomizer()
}

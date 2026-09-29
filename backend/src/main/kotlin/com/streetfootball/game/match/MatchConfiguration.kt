package com.streetfootball.game.match

import com.streetfootball.game.match.domain.MatchEngine
import com.streetfootball.game.match.domain.VersionedMatchEngine
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class MatchConfiguration {
    @Bean
    fun matchEngine(): MatchEngine = VersionedMatchEngine()
}

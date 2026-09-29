package com.streetfootball.game.shared.health

import org.junit.jupiter.api.Test
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.setup.MockMvcBuilders

class HealthControllerTest {
    private val mockMvc = MockMvcBuilders.standaloneSetup(HealthController()).build()

    @Test
    fun `returns a healthy status`() {
        mockMvc
            .get("/health")
            .andExpect {
                status { isOk() }
                content { contentTypeCompatibleWith(MediaType.APPLICATION_JSON) }
                jsonPath("$.status") { value("UP") }
            }
    }
}

package com.streetfootball.game.shared.error

import com.streetfootball.game.challenge.ChallengerNotAvailableException
import com.streetfootball.game.challenge.IdempotencyConflictException
import com.streetfootball.game.challenge.OwnedPlayerNotFoundException
import com.streetfootball.game.challenge.PlayerNotOwnedException
import com.streetfootball.game.profile.ProfileAlreadyExistsException
import com.streetfootball.game.profile.ProfileNotFoundException
import com.streetfootball.game.progression.TrainingCooldownException
import com.streetfootball.game.progression.TrainingIdempotencyConflictException
import com.streetfootball.game.progression.TrainingStatMaxException
import com.streetfootball.game.recruitment.RecruitmentNotAvailableException
import com.streetfootball.game.roster.InconsistentStarterStateException
import com.streetfootball.game.roster.InvalidLineupException
import com.streetfootball.game.roster.StarterAlreadySelectedException
import com.streetfootball.game.roster.StarterNotFoundException
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.web.ErrorResponse
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.MissingRequestHeaderException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException
import java.util.UUID

@RestControllerAdvice
class ApiExceptionHandler {
    @ExceptionHandler(TrainingCooldownException::class)
    fun trainingCooldown(exception: TrainingCooldownException): ResponseEntity<ApiError> =
        error(HttpStatus.CONFLICT, "TRAINING_COOLDOWN", "Aguarde um minuto antes de iniciar outro treino.",
            mapOf("nextAvailableAt" to exception.nextAvailableAt.toString()))

    @ExceptionHandler(TrainingStatMaxException::class)
    fun trainingStatMax(): ResponseEntity<ApiError> =
        error(HttpStatus.CONFLICT, "TRAINING_STAT_MAX", "Este fundamento já atingiu o valor máximo.")

    @ExceptionHandler(TrainingIdempotencyConflictException::class)
    fun trainingIdempotencyConflict(): ResponseEntity<ApiError> =
        error(HttpStatus.CONFLICT, "IDEMPOTENCY_CONFLICT", "Esta chave de idempotência já foi usada em outro treino.")

    @ExceptionHandler(com.streetfootball.game.stadium.StadiumRuleException::class)
    fun stadiumRule(exception: com.streetfootball.game.stadium.StadiumRuleException): ResponseEntity<ApiError> {
        val message =
            when (exception.code) {
                "LINEUP_INCOMPLETE" -> "Escale cinco jogadores diferentes para entrar no estádio."
                "STADIUM_ALREADY_COMPLETED" -> "Este estádio já foi conquistado."
                "STADIUM_REQUIREMENT_NOT_MET" -> "Conquiste os troféus necessários para entrar."
                else -> "Estádio não encontrado ou indisponível."
            }
        return error(if (exception.code == "STADIUM_NOT_FOUND") HttpStatus.NOT_FOUND else HttpStatus.CONFLICT, exception.code, message)
    }

    @ExceptionHandler(RecruitmentNotAvailableException::class)
    fun recruitmentNotAvailable(): ResponseEntity<ApiError> =
        error(HttpStatus.CONFLICT, "RECRUITMENT_NOT_AVAILABLE", "Vença este desafiante para convidá-lo para o time.")

    @ExceptionHandler(InvalidLineupException::class)
    fun invalidLineup(): ResponseEntity<ApiError> =
        error(HttpStatus.BAD_REQUEST, "INVALID_LINEUP", "Use cinco slots, sem repetir jogadores. Slots vazios são permitidos.")

    @ExceptionHandler(ChallengerNotAvailableException::class)
    fun challengerNotAvailable(): ResponseEntity<ApiError> =
        error(HttpStatus.NOT_FOUND, "CHALLENGER_NOT_AVAILABLE", "Desafiante não encontrado ou indisponível.")

    @ExceptionHandler(OwnedPlayerNotFoundException::class)
    fun ownedPlayerNotFound(): ResponseEntity<ApiError> =
        error(HttpStatus.NOT_FOUND, "OWNED_PLAYER_NOT_FOUND", "Jogador não encontrado ou indisponível.")

    @ExceptionHandler(PlayerNotOwnedException::class)
    fun playerNotOwned(): ResponseEntity<ApiError> =
        error(HttpStatus.FORBIDDEN, "PLAYER_NOT_OWNED", "Este jogador não pertence ao seu perfil.")

    @ExceptionHandler(IdempotencyConflictException::class)
    fun idempotencyConflict(): ResponseEntity<ApiError> =
        error(HttpStatus.CONFLICT, "IDEMPOTENCY_CONFLICT", "Esta chave de idempotência já foi usada em outro comando.")

    @ExceptionHandler(MissingRequestHeaderException::class, MethodArgumentTypeMismatchException::class)
    fun invalidRequestParameter(): ResponseEntity<ApiError> =
        error(HttpStatus.BAD_REQUEST, "MALFORMED_REQUEST", "Cabeçalho ou identificador inválido.")

    @ExceptionHandler(ProfileNotFoundException::class)
    fun profileNotFound(): ResponseEntity<ApiError> = error(HttpStatus.NOT_FOUND, "PROFILE_NOT_FOUND", "Perfil não encontrado.")

    @ExceptionHandler(ProfileAlreadyExistsException::class)
    fun profileAlreadyExists(): ResponseEntity<ApiError> =
        error(HttpStatus.CONFLICT, "PROFILE_ALREADY_EXISTS", "Esta sessão já possui um perfil.")

    @ExceptionHandler(StarterNotFoundException::class)
    fun starterNotFound(): ResponseEntity<ApiError> =
        error(HttpStatus.NOT_FOUND, "STARTER_NOT_FOUND", "Starter não encontrado ou indisponível.")

    @ExceptionHandler(StarterAlreadySelectedException::class)
    fun starterAlreadySelected(): ResponseEntity<ApiError> =
        error(HttpStatus.CONFLICT, "STARTER_ALREADY_SELECTED", "Um starter diferente já foi escolhido.")

    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun invalidArgument(exception: MethodArgumentNotValidException): ResponseEntity<ApiError> =
        error(
            HttpStatus.BAD_REQUEST,
            "VALIDATION_ERROR",
            "A requisição possui campos inválidos.",
            exception.bindingResult.fieldErrors.associate { it.field to (it.defaultMessage ?: "invalid") },
        )

    @ExceptionHandler(HttpMessageNotReadableException::class)
    fun unreadableMessage(): ResponseEntity<ApiError> =
        error(HttpStatus.BAD_REQUEST, "MALFORMED_REQUEST", "O corpo da requisição é inválido.")

    @ExceptionHandler(InconsistentStarterStateException::class)
    fun inconsistentStarterState(exception: InconsistentStarterStateException): ResponseEntity<ApiError> {
        logger.error("Inconsistent starter state", exception)
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "Não foi possível concluir a operação.")
    }

    @ExceptionHandler(Exception::class)
    fun unexpectedFailure(exception: Exception): ResponseEntity<ApiError> {
        if (exception is ErrorResponse) {
            return error(
                HttpStatus.valueOf(exception.statusCode.value()),
                "REQUEST_REJECTED",
                "A requisição não pôde ser atendida.",
            )
        }
        val response = error(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "Não foi possível concluir a operação.")
        logger.error("Request failed traceId={}", response.body?.traceId, exception)
        return response
    }

    private fun error(
        status: HttpStatus,
        code: String,
        message: String,
        details: Map<String, String> = emptyMap(),
    ): ResponseEntity<ApiError> =
        ResponseEntity
            .status(status)
            .body(ApiError(code = code, message = message, details = details, traceId = UUID.randomUUID().toString()))

    private companion object {
        val logger = LoggerFactory.getLogger(ApiExceptionHandler::class.java)
    }
}

data class ApiError(
    val code: String,
    val message: String,
    val details: Map<String, String>,
    val traceId: String,
)

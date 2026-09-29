FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app
COPY . .
RUN chmod +x gradlew
RUN --mount=type=cache,target=/root/.gradle ./gradlew --no-daemon bootJar

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S game && adduser -S game -G game
COPY --from=build /app/build/libs/*-SNAPSHOT.jar app.jar
USER game
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]

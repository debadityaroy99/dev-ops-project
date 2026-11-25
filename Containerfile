# ==============================================================================
# Multi-stage Containerfile for Game Foundation (.NET 8 ASP.NET Core)
# Compatible with Podman and Docker
# ==============================================================================

# Stage 1: Build & Publish the application
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy project specification and restore dependencies separately
# This maximizes container layer caching efficiency
COPY app/Foundation.csproj app/
RUN dotnet restore app/Foundation.csproj

# Copy application source code and static web assets
COPY app/ app/
WORKDIR /src/app

# Publish the compiled application to /out directory
RUN dotnet publish Foundation.csproj -c Release -o /out --no-restore

# Stage 2: Lean runtime container
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# Copy published binaries and wwwroot assets from build stage
COPY --from=build /out .

# Set container environment variables
ENV ASPNETCORE_HTTP_PORTS=8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    LAB_ENV=blue \
    LAB_SESSION=local-session \
    RELEASE_NAME=foundation-a

# Expose application port
EXPOSE 8080

# Execute the application
ENTRYPOINT ["dotnet", "Foundation.dll"]

using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

// Ensure the application listens on port 8080 by default (configurable via ASPNETCORE_HTTP_PORTS or PORT)
var port = Environment.GetEnvironmentVariable("PORT") 
           ?? Environment.GetEnvironmentVariable("ASPNETCORE_HTTP_PORTS") 
           ?? "8080";
builder.WebHost.UseUrls($"http://*:{port}");

var app = builder.Build();

// Enable serving default files (index.html) and static files from wwwroot
app.UseDefaultFiles();
app.UseStaticFiles();

// Health Check Endpoint (Used by Kubernetes liveness and readiness probes)
app.MapGet("/healthz", () => Results.Text("Healthy", "text/plain"));

// Reference Board Endpoint
app.MapGet("/api/boards/reference", (HttpContext httpContext) =>
{
    // Read environment variables with sensible defaults for local development
    var labEnv = Environment.GetEnvironmentVariable("LAB_ENV") ?? "blue";
    var labSession = Environment.GetEnvironmentVariable("LAB_SESSION") ?? "local-session";
    var releaseName = Environment.GetEnvironmentVariable("RELEASE_NAME") ?? "foundation-a";

    // Generate a unique request ID for distributed tracing
    var requestId = Guid.NewGuid().ToString();

    // Set required response headers
    httpContext.Response.Headers["X-Request-ID"] = requestId;
    httpContext.Response.Headers["X-Environment"] = labEnv;
    httpContext.Response.Headers["X-Release"] = releaseName;

    // Structured JSON log entry written directly to standard output (stdout)
    // This allows log collectors (kubectl logs, Loki, Fluentd) to ingest and parse fields cleanly.
    var logEntry = new
    {
        timestamp = DateTimeOffset.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
        request_id = requestId,
        path = "/api/boards/reference",
        environment = labEnv,
        release = releaseName,
        session = labSession,
        status_code = StatusCodes.Status200OK
    };

    Console.WriteLine(JsonSerializer.Serialize(logEntry));

    // Simple 3x3 reference board for Game Foundation
    var referenceBoard = new string[][]
    {
        new string[] { "X", "O", "X" },
        new string[] { " ", "X", " " },
        new string[] { "O", " ", "X" }
    };

    var response = new
    {
        board = referenceBoard,
        environment = labEnv,
        release = releaseName,
        requestId = requestId
    };

    return Results.Ok(response);
});

app.Run();

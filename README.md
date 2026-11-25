# Game Foundation - DevOps Learning Project

A beginner-friendly, DevOps project built from scratch to demonstrate containerization

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Project Structure](#2-project-structure)
3. [Running Locally (Without Containers)](#3-running-locally-without-containers)
4. [Building and Running with Podman](#4-building-and-running-with-podman)
   - [Build the Container Image](#step-1-build-the-image)
   - [Inspect and Record Image ID](#step-2-record-the-image-id)
   - [Run the Container](#step-3-run-the-container)
   - [Test the Running Container](#step-4-verify-container-endpoints)
5. [GitOps Workflow with Git & Argo CD](#5-gitops-workflow-with-git--argo-cd)
   - [Git Commit & Revision](#step-1-git-commit)
   - [Argo CD Synchronization](#step-2-argo-cd-synchronization)
6. [Kubernetes Resources & Verification](#6-kubernetes-resources--verification)
   - [Deploy Resources Directly or via Argo CD](#step-1-verify-cluster-resources)
   - [Port-Forwarding the Service](#step-2-port-forwarding)
   - [Testing the Deployed Application](#step-3-curl-and-browser-tests)
7. [Distributed Request Tracing & Structured Logging](#7-distributed-request-tracing--structured-logging)
8. [Controlled Failure Exercise: Broken Service Selector](#8-controlled-failure-exercise-broken-service-selector)
   - [The Setup](#the-setup)
   - [Inject the Failure](#inject-the-failure)
   - [Diagnose the Failure](#diagnose-the-failure)
   - [Recover the Service](#recover-the-service)
9. [Configuration Change Exercise: BLUE to GREEN](#9-configuration-change-exercise-blue-to-green)
10. [Submission Helper (`submit.sh`)](#10-submission-helper-submitsh)
11. [DevOps Evidence Checklist](#11-devops-evidence-checklist)
12. [Conceptual Mental Model (How Everything Connects)](#12-conceptual-mental-model-how-everything-connects)

---

## 1. Architecture Overview

```
                      +---------------------------------------+
                      |               Browser                 |
                      |        http://127.0.0.1:18081         |
                      +-------------------+-------------------+
                                          |
                                          | (Port-Forward / Ingress)
                                          v
                      +---------------------------------------+
                      |          Kubernetes Service           |
                      |            name: foundation           |
                      |        selector: app=foundation       |
                      |               port: 8080              |
                      +-------------------+-------------------+
                                          |
                                          | Matches Label: app=foundation
                                          v
+-----------------------------------------------------------------------------------+
| Kubernetes Deployment / Pod                                                       |
|   Metadata: labels: { app: foundation }                                           |
|                                                                                   |
|   +-----------------------------------------------------------------------------+ |
|   | Container: foundation (Port 8080)                                           | |
|   |                                                                             | |
|   |   +--------------------------+       +----------------------------------+   | |
|   |   | Frontend (Static HTML/JS)|       | ASP.NET Core API Endpoints       |   | |
|   |   | - 3x3 Board Grid         | ----> | - GET /healthz (Health Probe)    |   | |
|   |   | - Dynamic BLUE/GREEN Pill|       | - GET /api/boards/reference      |   | |
|   |   | - Tracing Inspector      |       |   (X-Request-ID, JSON, stdout)   |   | |
|   |   +--------------------------+       +-----------------+----------------+   | |
|   +--------------------------------------------------------|--------------------+ |
+------------------------------------------------------------|----------------------+
                                                             v
                                             +-------------------------------+
                                             |     Standard Output (stdout)   |
                                             |  Structured JSON Log Stream   |
                                             |  {"timestamp":"...",          |
                                             |   "request_id":"...",         |
                                             |   "environment":"blue", ...}  |
                                             +-------------------------------+
```

---

## 2. Project Structure

```text
game-foundation/
├── app/
│   ├── Foundation.csproj         # .NET 8 Web SDK project configuration
│   ├── Program.cs                # ASP.NET Core Minimal API, healthz, & JSON logger
│   └── wwwroot/                  # Static web assets served on port 8080
│       ├── index.html            # Game Foundation 3x3 board and UI
│       ├── styles.css            # Responsive layout and BLUE/GREEN styling
│       └── app.js                # Vanilla JavaScript for API calls & tracing
├── configuration/
│   └── app/
│       └── resources.yaml        # ConfigMap, Deployment, and Service definitions
├── Containerfile                 # Multi-stage Podman/Docker build recipe
├── .gitignore                    # Build artifacts and editor exclusions
├── README.md                     # Complete project documentation
└── submit.sh                     # Pre-submission verification script
```

---

## 3. Running Locally (Without Containers)

To run and test the application directly on your workstation:

```bash
cd app

# Optional: set environment variables in your terminal
export LAB_ENV=blue
export LAB_SESSION=local-dev
export RELEASE_NAME=foundation-a

# Run using the .NET SDK
dotnet run
```

*(On Windows PowerShell, use `$env:LAB_ENV="blue"; dotnet run`)*

Test the endpoints in another terminal window:

```bash
curl http://127.0.0.1:8080/healthz
curl http://127.0.0.1:8080/api/boards/reference
```

Open `http://127.0.0.1:8080` in your web browser.

---

## 4. Building and Running with Podman

### Step 1: Build the Image

From the `game-foundation` root directory:

```bash
podman build -t localhost/game-foundation:foundation-a .
```

### Step 2: Record the Image ID

List the images and save the Image ID (required for your lab evidence):

```bash
podman images | grep game-foundation
```

Example output:
```text
localhost/game-foundation   foundation-a   a1b2c3d4e5f6   About a minute ago   215 MB
```
*Note down the Image ID (e.g., `a1b2c3d4e5f6`).*

### Step 3: Run the Container

Launch the container in detached mode mapping host port `18080` to container port `8080`:

```bash
podman run -d --name game-foundation -p 18080:8080 localhost/game-foundation:foundation-a
```

### Step 4: Verify Container Endpoints

1. Check health endpoint:
   ```bash
   curl http://127.0.0.1:18080/healthz
   ```
   **Expected output:** `Healthy`

2. Check API endpoint and headers:
   ```bash
   curl -i http://127.0.0.1:18080/api/boards/reference
   ```
   **Expected output:**
   - Status: `HTTP/1.1 200 OK`
   - Headers: `X-Request-ID`, `X-Environment: blue`, `X-Release: foundation-a`
   - Body: JSON containing the 3x3 board and matching `requestId`.

3. Open in browser:
   Navigate to `http://127.0.0.1:18080` and click **"Load Reference Board"**.

4. Inspect container stdout logs:
   ```bash
   podman logs game-foundation
   ```
   Notice the structured JSON log entry matching the request ID.

5. Stop the local container before moving to Kubernetes:
   ```bash
   podman stop game-foundation && podman rm game-foundation
   ```

---

## 5. GitOps Workflow with Git & Argo CD

In a GitOps workflow, Git is the single source of truth. Argo CD watches your Git repository and synchronizes your Kubernetes cluster to match the committed configuration.

### Step 1: Git Commit

Initialize or stage your changes, review them, and record your commit revision:

```bash
# Initialize git repository if not already initialized
git init --initial-branch=main

# Stage all files
git add .

# Review staged changes
git diff --cached

# Commit reviewed configuration
git commit -m "Deploy reviewed foundation image"

# Record the exact commit hash (Git Revision)
git rev-parse HEAD
```

*Note down your commit hash (e.g., `3f8a9e7c...`). This is your `$P1_REVISION`.*

### Step 2: Argo CD Synchronization

> **Note on Placeholders:**
> - `$P1_NAMESPACE`: Your assigned classroom namespace / application name (e.g. `student1-app`).
> - `$P1_REVISION`: The Git commit hash from `git rev-parse HEAD`.

Set your environment variables:
```bash
export P1_NAMESPACE="<YOUR_CLASSROOM_NAMESPACE>"
export P1_REVISION="$(git rev-parse HEAD)"
```

Sync and monitor the deployment through Argo CD:

```bash
# 1. Trigger the sync to your specific git revision
argocd --core app sync "$P1_NAMESPACE" --revision "$P1_REVISION"

# 2. Wait for the application to be synchronized and healthy
argocd --core app wait "$P1_NAMESPACE" --sync --health --timeout 90

# 3. Inspect application status
argocd --core app get "$P1_NAMESPACE"
```

---

## 6. Kubernetes Resources & Verification

### Step 1: Verify Cluster Resources

Check that the Deployment, Pod, Service, and Endpoints are running:

```bash
# Check Pods
kubectl -n "$P1_NAMESPACE" get pods

# Check Deployment
kubectl -n "$P1_NAMESPACE" get deployment foundation

# Check Service
kubectl -n "$P1_NAMESPACE" get service foundation

# Check Service Endpoints (must show the Pod IP and port 8080)
kubectl -n "$P1_NAMESPACE" get endpoints foundation

# Describe the Service to inspect the selector
kubectl -n "$P1_NAMESPACE" describe service foundation
```

### Step 2: Port-Forwarding

Forward port `18081` on your workstation to port `8080` on the Kubernetes Service:

```bash
kubectl -n "$P1_NAMESPACE" port-forward service/foundation 18081:8080
```

*Leave this running in its own terminal or background it.*

### Step 3: Curl and Browser Tests

Test the endpoints through the Kubernetes Service:

```bash
# 1. Health check probe
curl http://127.0.0.1:18081/healthz

# 2. Reference board API
curl -i http://127.0.0.1:18081/api/boards/reference

# 3. Open in browser
# Open: http://127.0.0.1:18081
```

---

## 7. Distributed Request Tracing & Structured Logging

Distributed tracing allows developers and SREs to follow a single user request across distributed networks, load balancers, and container pods.

1. Issue a request using `curl`:
   ```bash
   curl -i http://127.0.0.1:18081/api/boards/reference
   ```

2. Note the `X-Request-ID` header from the response:
   ```text
   HTTP/1.1 200 OK
   X-Request-ID: c542e88a-3e41-477f-a67b-1cb81c009d1e
   X-Environment: blue
   X-Release: foundation-a
   ```

3. Query the Pod's stdout logs:
   ```bash
   # Retrieve the pod name
   POD_NAME=$(kubectl -n "$P1_NAMESPACE" get pods -l app=foundation -o jsonpath="{.items[0].metadata.name}")

   # View logs
   kubectl -n "$P1_NAMESPACE" logs "$POD_NAME" | grep "request_id"
   ```

4. Verify the matching structured JSON entry:
   ```json
   {"timestamp":"2026-11-19T12:53:35.524Z","request_id":"c542e88a-3e41-477f-a67b-1cb81c009d1e","path":"/api/boards/reference","environment":"blue","release":"foundation-a","session":"session-01","status_code":200}
   ```
   Notice that the `request_id` in the log matches the `X-Request-ID` header exactly!

---

## 8. Controlled Failure Exercise: Broken Service Selector

This exercise demonstrates the critical link between Kubernetes **Service Selectors** and **Pod Labels**.

### The Setup

In a normal Kubernetes deployment:
- Pod template label: `app: foundation`
- Service selector: `app: foundation`
- The Kubernetes Endpoints controller matches them and adds the Pod IP into the `foundation` Service endpoints.

### Inject the Failure

Edit `configuration/app/resources.yaml` and change **ONLY** the Service selector:

```yaml
# In Service spec:
spec:
  selector:
    app: foundation-missing   # <--- Change from 'foundation' to 'foundation-missing'
```

Apply or commit and sync the change:
```bash
kubectl -n "$P1_NAMESPACE" apply -f configuration/app/resources.yaml
# (Or commit to Git and run: argocd --core app sync "$P1_NAMESPACE")
```

### Diagnose the Failure

Run the following diagnostic commands:

```bash
# 1. Pod status: Notice the Pod is still RUNNING and 1/1 Healthy!
kubectl -n "$P1_NAMESPACE" get pods

# 2. Service status: Notice the Service still exists!
kubectl -n "$P1_NAMESPACE" get service foundation

# 3. Check endpoints: Notice the Endpoints list is EMPTY (<none>)!
kubectl -n "$P1_NAMESPACE" get endpoints foundation

# 4. Describe Service:
kubectl -n "$P1_NAMESPACE" describe service foundation
```

Try accessing the application through the Service:
```bash
curl --max-time 3 http://127.0.0.1:18081/healthz
```
**Result:** The connection hangs or fails with a timeout / connection refused!

#### Why did this happen?
The Pod itself is completely healthy and running. However, the Kubernetes Service looks for pods with the label `app: foundation-missing`. Because no Pod has that label, the Service has **0 endpoints**. The Service cannot route any network packets to the Pod.

### Recover the Service

1. Change the Service selector in `configuration/app/resources.yaml` back to:
   ```yaml
   spec:
     selector:
       app: foundation
   ```

2. Apply or sync the configuration:
   ```bash
   kubectl -n "$P1_NAMESPACE" apply -f configuration/app/resources.yaml
   ```

3. Verify recovery:
   ```bash
   kubectl -n "$P1_NAMESPACE" get endpoints foundation
   ```
   **Result:** The Pod IP immediately reappears in the endpoints list, and `curl http://127.0.0.1:18081/healthz` returns `Healthy`!

---

## 9. Configuration Change Exercise: BLUE to GREEN

This exercise demonstrates rolling out an environment configuration update through ConfigMaps without rebuilding the container image.

### Step 1: Update the ConfigMap

In `configuration/app/resources.yaml`, update `LAB_ENV`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: foundation-config
data:
  LAB_ENV: "green"    # <--- Changed from 'blue' to 'green'
  LAB_SESSION: "session-01"
  RELEASE_NAME: "foundation-a"
```

### Step 2: Apply and Rollout

Commit and sync via Argo CD, or apply directly and restart the Deployment to pick up the new ConfigMap values:

```bash
# Apply changes
kubectl -n "$P1_NAMESPACE" apply -f configuration/app/resources.yaml

# Restart the pod so it reads updated ConfigMap environment variables
kubectl -n "$P1_NAMESPACE" rollout restart deployment foundation

# Wait for rollout completion
kubectl -n "$P1_NAMESPACE" rollout status deployment foundation
```

### Step 3: Verify the GREEN Environment

Test the API:

```bash
curl -i http://127.0.0.1:18081/api/boards/reference
```

**Expected Response Headers & JSON:**
```text
HTTP/1.1 200 OK
X-Environment: green
X-Release: foundation-a
...
{"board":[...],"environment":"green","release":"foundation-a","requestId":"..."}
```

Open `http://127.0.0.1:18081` in your browser.
Notice that the Environment indicator now displays **`ENVIRONMENT: GREEN`** with green styling!

---

## 10. Submission Helper (`submit.sh`)

A safe verification script is provided at `./submit.sh`.

```bash
chmod +x submit.sh
./submit.sh
```

> **Important:**
> If your learning platform / academy provides an official automated grading script (e.g., `/usr/local/bin/submit.sh`), always execute that official script to register your score.

---

## 11. DevOps Evidence Checklist

Collect the following evidence items required for project evaluation:

| # | Evidence Item | Command to Capture | Expected Result |
|---|---|---|---|
| 1 | **Container Image ID** | `podman images \| grep game-foundation` | Valid hex Image ID (e.g. `a1b2c3d4e5f6`) |
| 2 | **Git Revision** | `git rev-parse HEAD` | 40-character Git commit SHA |
| 3 | **Argo Revision** | `argocd --core app get "$P1_NAMESPACE"` | Shows Sync Status: Synced to `$P1_REVISION` |
| 4 | **Pod Status** | `kubectl -n "$P1_NAMESPACE" get pods` | `1/1 Running` |
| 5 | **Container Image** | `kubectl -n "$P1_NAMESPACE" get pods -o jsonpath="{.items[*].spec.containers[*].image}"` | Image name & tag matching deployed image |
| 6 | **Service Selector** | `kubectl -n "$P1_NAMESPACE" get svc foundation -o jsonpath="{.spec.selector}"` | `map[app:foundation]` |
| 7 | **Service Endpoints** | `kubectl -n "$P1_NAMESPACE" get endpoints foundation` | Shows `<POD_IP>:8080` |
| 8 | **Health Response** | `curl -i http://127.0.0.1:18081/healthz` | `HTTP 200 OK` with body `Healthy` |
| 9 | **API Response** | `curl -i http://127.0.0.1:18081/api/boards/reference` | `HTTP 200 OK` with JSON & headers |
| 10 | **Request ID** | Header `X-Request-ID` from API response | Valid GUID/UUID |
| 11 | **Matching Log** | `kubectl -n "$P1_NAMESPACE" logs <pod>` | JSON log with identical `request_id` |
| 12 | **Failure Evidence** | `kubectl -n "$P1_NAMESPACE" get endpoints foundation` (during failure) | `<none>` (0 endpoints) |
| 13 | **Recovery Evidence** | `kubectl -n "$P1_NAMESPACE" get endpoints foundation` (after fix) | Restored `<POD_IP>:8080` |
| 14 | **BLUE -> GREEN Evidence** | `curl http://127.0.0.1:18081/api/boards/reference` | `X-Environment: green` & `"environment":"green"` |

---

## 12. Conceptual Mental Model (How Everything Connects)

To succeed in modern DevOps and cloud native engineering, understand how each layer feeds into the next:

```
[1. Code] 
    └── Developers write C# ASP.NET Core & HTML/JS frontend assets in `app/`.
         │
         ▼
[2. Container Image]
    └── `Containerfile` packages the code, runtime, dependencies, and port configuration into an immutable image artifact.
         │
         ▼
[3. Kubernetes YAML]
    └── `resources.yaml` declaratively describes how the container should be executed, configured (ConfigMap), and exposed (Service).
         │
         ▼
[4. Git Revision]
    └── `git commit` freezes the exact version of code and Kubernetes manifests into an audited Git commit hash (`HEAD`).
         │
         ▼
[5. Argo CD (GitOps)]
    └── Argo CD monitors the Git repository. When told to sync, it reconciles cluster state with the Git revision.
         │
         ▼
[6. Deployment & Pod]
    └── The Kubernetes controller schedules the Pod onto a worker node, pulls the container image, injects ConfigMap environment variables, and checks readiness probes.
         │
         ▼
[7. Service & Endpoints]
    └── The Service uses label selectors (`app: foundation`) to discover running Pods and dynamically populate routing Endpoints.
         │
         ▼
[8. API & UI]
    └── Users make requests to `/api/boards/reference`. The API processes the request, sets tracing headers, and renders the board.
         │
         ▼
[9. Logs (stdout)]
    └── Each API request writes structured JSON to standard output. Container runtimes and collectors ingest stdout so engineers can trace any request from browser to pod.
```

package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"gopkg.in/yaml.v3"

	"github.com/selfyurt/selfyurt/packages/agent/internal/auth"
	"github.com/selfyurt/selfyurt/packages/agent/internal/caddy"
	"github.com/selfyurt/selfyurt/packages/agent/internal/compose"
	"github.com/selfyurt/selfyurt/packages/agent/internal/docker"
	"github.com/selfyurt/selfyurt/packages/agent/internal/runtime"
	"github.com/selfyurt/selfyurt/packages/agent/internal/types"
)

var hostnameRegex = regexp.MustCompile(`^(?=.{1,253}$)(?!-)[a-z0-9-]+(?:\.[a-z0-9-]+)+$`)
var supportedDeployApps = map[string]bool{
	"nginx-hello": true,
	"redis":       true,
	"postgres":    true,
}

type application struct {
	cfg         types.Config
	compose     *compose.Runner
	caddy       *caddy.Manager
	httpServer  *http.Server
}

func main() {
	cfg, err := loadConfig()
	if err != nil {
		log.Fatalf("config error: %v", err)
	}

	if err := os.MkdirAll(cfg.RuntimeDir, 0o755); err != nil {
		log.Fatalf("failed to create runtime dir: %v", err)
	}
	if err := os.MkdirAll(cfg.CaddySnippetsDir, 0o755); err != nil {
		log.Fatalf("failed to create caddy snippets dir: %v", err)
	}

	app := &application{
		cfg:     cfg,
		compose: compose.NewRunner(cfg.RuntimeDir),
		caddy:   caddy.NewManager(cfg.CaddySnippetsDir, cfg.CaddyContainer, cfg.CaddyReloadDisabled),
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", app.handleHealth)
	mux.HandleFunc("/metrics", app.handleMetrics)
	mux.HandleFunc("/deploy", app.handleDeploy)
	mux.HandleFunc("/stop", app.handleStop)
	mux.HandleFunc("/start", app.handleStart)
	mux.HandleFunc("/update", app.handleUpdate)
	mux.HandleFunc("/uninstall", app.handleUninstall)
	mux.HandleFunc("/logs", app.handleLogs)

	handler := auth.RequireToken(cfg.AgentToken, mux)

	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           handler,
		ReadHeaderTimeout: 15 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      2 * time.Minute,
		IdleTimeout:       2 * time.Minute,
	}

	app.httpServer = server

	log.Printf("SelfYurt agent listening on %s", server.Addr)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("server error: %v", err)
	}
}

func loadConfig() (types.Config, error) {
	token := strings.TrimSpace(os.Getenv("AGENT_TOKEN"))
	if token == "" {
		return types.Config{}, fmt.Errorf("AGENT_TOKEN is required")
	}

	cfg := types.Config{
		Port:             getEnv("PORT", "7070"),
		AgentToken:       token,
		CatalogDir:       getEnv("CATALOG_DIR", "/opt/selfyurt/catalog"),
		RuntimeDir:       getEnv("RUNTIME_DIR", "/opt/selfyurt/runtime"),
		CaddySnippetsDir: getEnv("CADDY_SNIPPETS_DIR", "/opt/selfyurt/caddy-generated"),
		CaddyContainer:   getEnv("CADDY_CONTAINER_NAME", "selfyurt_caddy"),
		CaddyReloadDisabled: getBoolEnv("CADDY_RELOAD_DISABLED", false),
		DockerNetwork:    getEnv("DOCKER_NETWORK_NAME", "selfyurt_net"),
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func getBoolEnv(key string, fallback bool) bool {
	value := strings.TrimSpace(strings.ToLower(os.Getenv(key)))
	if value == "" {
		return fallback
	}

	return value == "1" || value == "true" || value == "yes"
}

func (a *application) handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	writeJSON(w, http.StatusOK, types.HealthResponse{Ok: true})
}

func (a *application) handleMetrics(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	metrics, err := docker.CollectMetrics()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, metrics)
}

func (a *application) handleDeploy(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req types.DeployRequest
	if err := decodeJSON(r.Body, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	req.InstanceID = runtime.NormalizeInstanceID(req.InstanceID)
	req.Hostname = strings.ToLower(strings.TrimSpace(req.Hostname))

	if req.AppID == "" || req.InstanceID == "" {
		writeError(w, http.StatusBadRequest, "appId and instanceId are required")
		return
	}

	if err := runtime.ValidateInstanceID(req.InstanceID); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	if !supportedDeployApps[req.AppID] {
		writeError(w, http.StatusNotImplemented, "only nginx-hello, redis, postgres are implemented in MVP")
		return
	}

	manifest, err := a.loadManifest(req.AppID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if manifest.Compose.Template == "" {
		writeError(w, http.StatusInternalServerError, "manifest compose.template is empty")
		return
	}

	supportsPublic := true
	if manifest.Access.SupportsPublic != nil {
		supportsPublic = *manifest.Access.SupportsPublic
	}
	accessProtocol := strings.TrimSpace(strings.ToLower(manifest.Access.Protocol))
	if accessProtocol == "" {
		accessProtocol = "http"
	}

	if req.ExposePublic && !supportsPublic {
		writeError(w, http.StatusBadRequest, "this app does not support public exposure")
		return
	}

	if req.ExposePublic {
		if req.Hostname == "" {
			writeError(w, http.StatusBadRequest, "hostname is required when exposePublic=true")
			return
		}

		if !hostnameRegex.MatchString(req.Hostname) {
			writeError(w, http.StatusBadRequest, "invalid hostname")
			return
		}

		if accessProtocol != "http" {
			writeError(w, http.StatusBadRequest, "public exposure is only supported for http protocol apps")
			return
		}
	}

	vars := map[string]string{}
	for k, v := range req.Env {
		vars[k] = v
	}

	for _, field := range manifest.EnvSchema {
		existing := strings.TrimSpace(vars[field.Key])
		if existing == "" && strings.TrimSpace(field.Default) != "" {
			vars[field.Key] = field.Default
			existing = strings.TrimSpace(field.Default)
		}

		if field.Required && existing == "" {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("missing required env value: %s", field.Key))
			return
		}
	}

	vars["INSTANCE_ID"] = req.InstanceID
	vars["HOSTNAME"] = req.Hostname

	renderedCompose := compose.RenderTemplate(manifest.Compose.Template, vars)
	if err := runtime.WriteComposeFile(a.cfg.RuntimeDir, req.InstanceID, renderedCompose); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	ctx := r.Context()
	if err := a.compose.Up(ctx, req.InstanceID); err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}

	target := fmt.Sprintf("sy-%s-%s:%d", req.InstanceID, manifest.Ingress.TargetService, manifest.Ingress.TargetPort)
	if _, _, err := net.SplitHostPort(target); err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("invalid target generated: %s", target))
		return
	}

	meta := types.InstanceMeta{
		AppID:      req.AppID,
		InstanceID: req.InstanceID,
		Hostname:   req.Hostname,
		ExposePublic: req.ExposePublic,
		Target:     target,
	}
	if err := runtime.WriteMetadata(a.cfg.RuntimeDir, req.InstanceID, meta); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if req.ExposePublic {
		if err := a.caddy.WriteSnippet(req.Hostname, target); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}

		if err := a.caddy.Reload(ctx); err != nil {
			writeError(w, http.StatusBadGateway, err.Error())
			return
		}
	}

	response := types.DeployResponse{
		Target:      target,
		IngressPort: manifest.Ingress.TargetPort,
	}
	if !req.ExposePublic {
		response.InternalEndpoint = target
	}

	writeJSON(w, http.StatusOK, response)
}

func (a *application) handleStop(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	instanceID, err := decodeInstanceID(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := a.compose.Stop(r.Context(), instanceID); err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *application) handleStart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	instanceID, err := decodeInstanceID(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := a.compose.Start(r.Context(), instanceID); err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *application) handleUpdate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	instanceID, err := decodeInstanceID(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := a.compose.Update(r.Context(), instanceID); err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *application) handleUninstall(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req types.UninstallRequest
	if err := decodeJSON(r.Body, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	req.InstanceID = runtime.NormalizeInstanceID(req.InstanceID)
	if err := runtime.ValidateInstanceID(req.InstanceID); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := a.compose.Down(r.Context(), req.InstanceID, req.RemoveVolumes); err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}

	meta, err := runtime.ReadMetadata(a.cfg.RuntimeDir, req.InstanceID)
	if err == nil && meta.ExposePublic && meta.Hostname != "" {
		if removeErr := a.caddy.RemoveSnippet(meta.Hostname); removeErr != nil {
			writeError(w, http.StatusInternalServerError, removeErr.Error())
			return
		}

		if reloadErr := a.caddy.Reload(r.Context()); reloadErr != nil {
			writeError(w, http.StatusBadGateway, reloadErr.Error())
			return
		}
	}

	if err := runtime.RemoveInstanceDir(a.cfg.RuntimeDir, req.InstanceID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *application) handleLogs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	instanceID := runtime.NormalizeInstanceID(r.URL.Query().Get("instanceId"))
	if err := runtime.ValidateInstanceID(instanceID); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	tail := 200
	if v := strings.TrimSpace(r.URL.Query().Get("tail")); v != "" {
		parsed, err := strconv.Atoi(v)
		if err == nil {
			tail = parsed
		}
	}

	logs, err := a.compose.Logs(r.Context(), instanceID, tail)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, types.LogsResponse{Logs: logs})
}

func (a *application) loadManifest(appID string) (*types.AppManifest, error) {
	manifestPath := filepath.Join(a.cfg.CatalogDir, appID+".yml")
	content, err := os.ReadFile(manifestPath)
	if err != nil {
		return nil, fmt.Errorf("read manifest: %w", err)
	}

	var manifest types.AppManifest
	if err := yaml.Unmarshal(content, &manifest); err != nil {
		return nil, fmt.Errorf("parse manifest: %w", err)
	}

	return &manifest, nil
}

func decodeInstanceID(body io.ReadCloser) (string, error) {
	var req types.InstanceRequest
	if err := decodeJSON(body, &req); err != nil {
		return "", err
	}

	instanceID := runtime.NormalizeInstanceID(req.InstanceID)
	if err := runtime.ValidateInstanceID(instanceID); err != nil {
		return "", err
	}

	return instanceID, nil
}

func decodeJSON(body io.ReadCloser, v any) error {
	defer body.Close()
	decoder := json.NewDecoder(body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(v); err != nil {
		return fmt.Errorf("invalid JSON payload")
	}
	return nil
}

func writeJSON(w http.ResponseWriter, code int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, code int, message string) {
	writeJSON(w, code, map[string]string{"error": message})
}

func shutdownWithTimeout(ctx context.Context, server *http.Server) {
	shutdownCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	_ = server.Shutdown(shutdownCtx)
}

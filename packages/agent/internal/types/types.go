package types

type Config struct {
	Port             string
	AgentToken       string
	CatalogDir       string
	RuntimeDir       string
	CaddySnippetsDir string
	CaddyContainer   string
	CaddyReloadDisabled bool
	DockerNetwork    string
}

type DeployRequest struct {
	AppID      string            `json:"appId"`
	InstanceID string            `json:"instanceId"`
	Hostname   string            `json:"hostname"`
	ExposePublic bool            `json:"exposePublic"`
	Env        map[string]string `json:"env"`
}

type DeployResponse struct {
	Target     string `json:"target"`
	IngressPort int    `json:"ingressPort"`
	InternalEndpoint string `json:"internalEndpoint,omitempty"`
}

type InstanceRequest struct {
	InstanceID string `json:"instanceId"`
}

type UninstallRequest struct {
	InstanceID     string `json:"instanceId"`
	RemoveVolumes bool   `json:"removeVolumes"`
}

type LogsResponse struct {
	Logs string `json:"logs"`
}

type HealthResponse struct {
	Ok bool `json:"ok"`
}

type MetricsResponse struct {
	CPUPercent    float64 `json:"cpuPercent"`
	MemoryPercent float64 `json:"memoryPercent"`
	DiskPercent   float64 `json:"diskPercent"`
}

type ComposeSpec struct {
	Template  string            `yaml:"template"`
	Variables []map[string]any `yaml:"variables"`
}

type IngressSpec struct {
	TargetService string `yaml:"targetService"`
	TargetPort    int    `yaml:"targetPort"`
}

type EnvSchemaField struct {
	Key      string `yaml:"key"`
	Label    string `yaml:"label"`
	Required bool   `yaml:"required"`
	Default  string `yaml:"default"`
	Secret   bool   `yaml:"secret"`
}

type AppManifest struct {
	ID          string           `yaml:"id"`
	Name        string           `yaml:"name"`
	Description string           `yaml:"description"`
	Category    string           `yaml:"category"`
	Icon        string           `yaml:"icon"`
	Compose     ComposeSpec      `yaml:"compose"`
	Ingress     IngressSpec      `yaml:"ingress"`
	Access      AccessSpec       `yaml:"access"`
	EnvSchema   []EnvSchemaField `yaml:"envSchema"`
}

type AccessSpec struct {
	DefaultExposePublic *bool  `yaml:"defaultExposePublic"`
	SupportsPublic      *bool  `yaml:"supportsPublic"`
	Protocol            string `yaml:"protocol"`
}

type InstanceMeta struct {
	AppID      string `json:"appId"`
	InstanceID string `json:"instanceId"`
	Hostname   string `json:"hostname"`
	ExposePublic bool `json:"exposePublic"`
	Target     string `json:"target"`
}

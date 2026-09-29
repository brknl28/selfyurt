package catalog

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"gopkg.in/yaml.v3"

	"github.com/selfyurt/selfyurt/packages/agent/internal/types"
)

var (
	ErrManifestNotFound = errors.New("manifest not found")
	ErrInvalidManifest  = errors.New("invalid manifest structure")
	idRegex             = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$`)
)

type IndexItem struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Category string `json:"category"`
	Manifest string `json:"manifest"`
}

type CatalogService struct {
	catalogDir string
}

func NewCatalogService(catalogDir string) *CatalogService {
	return &CatalogService{catalogDir: catalogDir}
}

func (s *CatalogService) LoadIndex() ([]IndexItem, error) {
	indexPath := filepath.Join(s.catalogDir, "index.json")
	data, err := os.ReadFile(indexPath)
	if err != nil {
		return nil, fmt.Errorf("read index: %w", err)
	}

	var items []IndexItem
	if err := json.Unmarshal(data, &items); err != nil {
		return nil, fmt.Errorf("parse index: %w", err)
	}

	return items, nil
}

func (s *CatalogService) LoadManifest(appID string) (*types.AppManifest, error) {
	appID = strings.TrimSpace(strings.ToLower(appID))
	if appID == "" {
		return nil, errors.New("appID cannot be empty")
	}

	manifestPath := filepath.Join(s.catalogDir, appID+".yml")
	data, err := os.ReadFile(manifestPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("%w: %s", ErrManifestNotFound, appID)
		}
		return nil, fmt.Errorf("read manifest %s: %w", appID, err)
	}

	var manifest types.AppManifest
	if err := yaml.Unmarshal(data, &manifest); err != nil {
		return nil, fmt.Errorf("%w: parse yaml %s: %v", ErrInvalidManifest, appID, err)
	}

	if err := s.ValidateManifest(&manifest); err != nil {
		return nil, fmt.Errorf("validate manifest %s: %w", appID, err)
	}

	return &manifest, nil
}

func (s *CatalogService) ValidateManifest(m *types.AppManifest) error {
	if m.ID == "" {
		return errors.New("manifest id is required")
	}
	if !idRegex.MatchString(m.ID) {
		return fmt.Errorf("invalid manifest id format: %s", m.ID)
	}
	if m.Name == "" {
		return errors.New("manifest name is required")
	}
	if m.Compose.Template == "" {
		return errors.New("compose.template is required")
	}
	if m.Ingress.TargetPort <= 0 || m.Ingress.TargetPort > 65535 {
		return fmt.Errorf("invalid ingress port: %d", m.Ingress.TargetPort)
	}
	if m.Ingress.TargetService == "" {
		return errors.New("ingress.targetService is required")
	}

	// Security checks: deny privileged flag and sensitive host mount overrides
	tmpl := m.Compose.Template
	if strings.Contains(tmpl, "privileged: true") {
		return errors.New("security check failed: privileged containers are forbidden")
	}
	if strings.Contains(tmpl, "/etc/shadow") || strings.Contains(tmpl, "/etc/passwd") {
		return errors.New("security check failed: mounting sensitive host files is forbidden")
	}

	for _, field := range m.EnvSchema {
		if field.Key == "" {
			return errors.New("envSchema key cannot be empty")
		}
	}

	return nil
}

func (s *CatalogService) ListAll() ([]types.AppManifest, error) {
	items, err := s.LoadIndex()
	if err != nil {
		return nil, err
	}

	results := make([]types.AppManifest, 0, len(items))
	for _, item := range items {
		m, err := s.LoadManifest(item.ID)
		if err != nil {
			continue
		}
		results = append(results, *m)
	}

	return results, nil
}

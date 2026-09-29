package catalog

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/selfyurt/selfyurt/packages/agent/internal/types"
)

func TestValidateManifest(t *testing.T) {
	service := NewCatalogService("")

	tests := []struct {
		name    string
		m       types.AppManifest
		wantErr bool
	}{
		{
			name: "valid manifest",
			m: types.AppManifest{
				ID:   "my-app",
				Name: "My App",
				Compose: types.ComposeSpec{
					Template: "services:\n  app:\n    image: test:latest\n",
				},
				Ingress: types.IngressSpec{
					TargetService: "app",
					TargetPort:    8080,
				},
			},
			wantErr: false,
		},
		{
			name: "invalid id format",
			m: types.AppManifest{
				ID:   "Invalid_ID!",
				Name: "My App",
				Compose: types.ComposeSpec{
					Template: "services:\n  app:\n    image: test:latest\n",
				},
				Ingress: types.IngressSpec{
					TargetService: "app",
					TargetPort:    8080,
				},
			},
			wantErr: true,
		},
		{
			name: "security violation - privileged",
			m: types.AppManifest{
				ID:   "priv-app",
				Name: "Privileged App",
				Compose: types.ComposeSpec{
					Template: "services:\n  app:\n    image: test\n    privileged: true\n",
				},
				Ingress: types.IngressSpec{
					TargetService: "app",
					TargetPort:    80,
				},
			},
			wantErr: true,
		},
		{
			name: "invalid port",
			m: types.AppManifest{
				ID:   "app-port",
				Name: "Bad Port App",
				Compose: types.ComposeSpec{
					Template: "services:\n  app:\n    image: test\n",
				},
				Ingress: types.IngressSpec{
					TargetService: "app",
					TargetPort:    70000,
				},
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := service.ValidateManifest(&tt.m)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateManifest() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestLoadManifest(t *testing.T) {
	tempDir := t.TempDir()
	manifestContent := `
id: nginx-test
name: Nginx Test
category: utility
compose:
  template: |
    services:
      web:
        image: nginx:alpine
ingress:
  targetService: web
  targetPort: 80
`
	if err := os.WriteFile(filepath.Join(tempDir, "nginx-test.yml"), []byte(manifestContent), 0o644); err != nil {
		t.Fatalf("failed to write test manifest: %v", err)
	}

	service := NewCatalogService(tempDir)
	m, err := service.LoadManifest("nginx-test")
	if err != nil {
		t.Fatalf("LoadManifest() unexpected error: %v", err)
	}

	if m.ID != "nginx-test" || m.Ingress.TargetPort != 80 {
		t.Errorf("unexpected manifest content: %+v", m)
	}
}

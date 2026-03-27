package auth

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"sort"
	"strings"
)

type ProviderToken struct {
	Capability string
	Provider   string
	Source     string
	BaseURL    string
	Token      string
}

type ProviderStatus struct {
	Capability string
	Provider   string
	Source     string
	Available  bool
	Detail     string
}

type InstalledProvider struct {
	Name         string
	Provides     []string
	CommandPath  string
	TokenEnv     string
	BaseURLEnv   string
	Capabilities []InstalledCapability
}

type InstalledCapability struct {
	Name       string
	TokenEnv   string
	BaseURLEnv string
}

var providerLister func() ([]InstalledProvider, error)
var configValueResolver func(string) (string, bool)

func SetInstalledProviderLister(fn func() ([]InstalledProvider, error)) {
	providerLister = fn
}

func SetConfigValueResolver(fn func(string) (string, bool)) {
	configValueResolver = fn
}

func ResolveCapability(capability string) (ProviderToken, error) {
	if capability = strings.TrimSpace(capability); capability == "" {
		return ProviderToken{}, fmt.Errorf("capability name is required")
	}
	if token, ok := resolveInstalledProviderToken(capability); ok {
		return token, nil
	}
	if token, ok := resolveSystemCapability(capability); ok {
		return token, nil
	}
	return ProviderToken{}, fmt.Errorf("no provider configured for %s", capability)
}

func ResolveGitLabToken() (ProviderToken, error) {
	return ResolveCapability("gitlab.api_token")
}

func ProviderStatuses() []ProviderStatus {
	seen := map[string]struct{}{}
	var statuses []ProviderStatus

	for _, status := range systemProviderStatuses() {
		seen[status.Capability] = struct{}{}
		statuses = append(statuses, status)
	}

	records, err := listedProviders()
	if err == nil {
		for _, record := range records {
			for _, capability := range declaredCapabilities(record) {
				if _, ok := seen[capability]; ok {
					continue
				}
				statuses = append(statuses, providerStatusForCapability(record, capability))
				seen[capability] = struct{}{}
			}
		}
	}
	sort.Slice(statuses, func(i, j int) bool { return statuses[i].Capability < statuses[j].Capability })
	return statuses
}

func gitLabBaseURL() string {
	host := strings.TrimSpace(os.Getenv("GITLAB_HOST"))
	if host == "" {
		host = "git.alteryx.com"
	}
	host = strings.TrimPrefix(host, "https://")
	host = strings.TrimPrefix(host, "http://")
	return "https://" + host + "/api/v4"
}

func glabAuthToken() (string, error) {
	cmd := exec.Command("glab", "auth", "token")
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = err.Error()
		}
		return "", fmt.Errorf("glab auth token: %s", msg)
	}
	return strings.TrimSpace(stdout.String()), nil
}

func resolveSystemCapability(capability string) (ProviderToken, bool) {
	switch capability {
	case "gitlab.api_token":
		if token, source := configuredValue("GITLAB_TOKEN"); token != "" {
			return ProviderToken{
				Capability: capability,
				Provider:   "system-gitlab-auth",
				Source:     source,
				BaseURL:    gitLabBaseURL(),
				Token:      token,
			}, true
		}
		if token, source := configuredValue("GITLAB_PRIVATE_TOKEN"); token != "" {
			return ProviderToken{
				Capability: capability,
				Provider:   "system-gitlab-auth",
				Source:     source,
				BaseURL:    gitLabBaseURL(),
				Token:      token,
			}, true
		}
		if token, err := glabAuthToken(); err == nil && token != "" {
			return ProviderToken{
				Capability: capability,
				Provider:   "system-gitlab-auth",
				Source:     "glab auth token",
				BaseURL:    gitLabBaseURL(),
				Token:      token,
			}, true
		}
	}
	return ProviderToken{}, false
}

func systemProviderStatuses() []ProviderStatus {
	token, ok := resolveSystemCapability("gitlab.api_token")
	if ok {
		return []ProviderStatus{{
			Capability: "gitlab.api_token",
			Provider:   token.Provider,
			Source:     token.Source,
			Available:  true,
			Detail:     token.BaseURL,
		}}
	}
	return []ProviderStatus{{
		Capability: "gitlab.api_token",
		Provider:   "system-gitlab-auth",
		Available:  false,
		Detail:     "set GITLAB_TOKEN or run glab auth login",
	}}
}

func resolveInstalledProviderToken(capability string) (ProviderToken, bool) {
	records, err := listedProviders()
	if err != nil {
		return ProviderToken{}, false
	}
	for _, record := range records {
		if !providesCapability(record, capability) {
			continue
		}
		tokenEnv := tokenEnvForCapability(record, capability)
		if tokenEnv == "" {
			continue
		}
		token, source := configuredValue(tokenEnv)
		if token == "" {
			continue
		}
		baseURL := gitLabBaseURL()
		if env := strings.TrimSpace(baseURLEnvForCapability(record, capability)); env != "" {
			if value, _ := configuredValue(env); value != "" {
				baseURL = strings.TrimRight(value, "/")
			}
		}
		return ProviderToken{
			Capability: capability,
			Provider:   record.Name,
			Source:     source,
			BaseURL:    baseURL,
			Token:      token,
		}, true
	}
	return ProviderToken{}, false
}

func listedProviders() ([]InstalledProvider, error) {
	if providerLister == nil {
		return nil, fmt.Errorf("no provider lister configured")
	}
	return providerLister()
}

func providesCapability(record InstalledProvider, capability string) bool {
	for _, provided := range declaredCapabilities(record) {
		if provided == capability {
			return true
		}
	}
	return false
}

func declaredCapabilities(record InstalledProvider) []string {
	if len(record.Capabilities) > 0 {
		out := make([]string, 0, len(record.Capabilities))
		for _, capability := range record.Capabilities {
			if strings.TrimSpace(capability.Name) == "" {
				continue
			}
			out = append(out, capability.Name)
		}
		if len(out) > 0 {
			return out
		}
	}
	return record.Provides
}

func tokenEnvForCapability(record InstalledProvider, capability string) string {
	for _, spec := range record.Capabilities {
		if spec.Name == capability {
			return spec.TokenEnv
		}
	}
	return record.TokenEnv
}

func baseURLEnvForCapability(record InstalledProvider, capability string) string {
	for _, spec := range record.Capabilities {
		if spec.Name == capability {
			return spec.BaseURLEnv
		}
	}
	return record.BaseURLEnv
}

func providerStatusForCapability(record InstalledProvider, capability string) ProviderStatus {
	status := ProviderStatus{
		Capability: capability,
		Provider:   record.Name,
		Source:     record.CommandPath,
		Available:  false,
		Detail:     "auth-provider",
	}
	if tokenEnv := tokenEnvForCapability(record, capability); tokenEnv != "" {
		status.Source = "env:" + tokenEnv
		if value, source := configuredValue(tokenEnv); value != "" {
			status.Available = true
			status.Source = source
			if baseEnv := baseURLEnvForCapability(record, capability); baseEnv != "" {
				if base, _ := configuredValue(baseEnv); base != "" {
					status.Detail = strings.TrimRight(base, "/")
				}
			}
		} else {
			status.Detail = "set " + tokenEnv
		}
	}
	return status
}

func configuredValue(key string) (string, string) {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value, "env:" + key
	}
	if configValueResolver != nil {
		if value, ok := configValueResolver(key); ok && strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value), "config:" + key
		}
	}
	return "", ""
}

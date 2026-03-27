package tools

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/scoady/codexctl/internal/auth"
)

const manifestFileName = "codex-tool.json"

type Record struct {
	Name         string       `json:"name"`
	Kind         string       `json:"kind,omitempty"`
	Tags         []string     `json:"tags,omitempty"`
	RepoURL      string       `json:"repo_url,omitempty"`
	SourcePath   string       `json:"source_path"`
	InstallDir   string       `json:"install_dir"`
	CommandPath  string       `json:"command_path"`
	ManifestPath string       `json:"manifest_path,omitempty"`
	SkillPaths   []string     `json:"skill_paths,omitempty"`
	Provides     []string     `json:"provides,omitempty"`
	Requires     []Capability `json:"requires,omitempty"`
	InstalledAt  string       `json:"installed_at"`
}

type Registry struct {
	Tools map[string]Record `json:"tools"`
}

type CatalogCache struct {
	Entries     []CatalogEntry `json:"entries"`
	RefreshedAt string         `json:"refreshed_at"`
}

type PluginConfigStore struct {
	Plugins map[string]map[string]string `json:"plugins"`
}

type InstallOptions struct {
	Source       string
	InstallSkill bool
}

type DoctorResult struct {
	Tool    string
	Record  *Record
	Issues  []string
	Checks  []string
	Tests   []PluginTestResult
	Healthy bool
}

type ToolInspection struct {
	Record       *Record
	Manifest     *Manifest
	SkillSpecs   []SkillSpec
	Previews     map[string][]string
	ConfigValues map[string]string
	SourceExists bool
}

type SkillSpec struct {
	Name       string
	SourcePath string
	DestPath   string
}

type ResolvedSource struct {
	Input      string
	Kind       string
	Resolved   string
	RepoURL    string
	Ref        string
	Manifest   Manifest
	PythonCmd  string
	PythonSpec string
}

type Manifest struct {
	Name        string           `json:"name"`
	Description string           `json:"description,omitempty"`
	Kind        string           `json:"kind,omitempty"`
	Tags        []string         `json:"tags,omitempty"`
	RepoURL     string           `json:"repo_url,omitempty"`
	SkillsDir   string           `json:"skills_dir,omitempty"`
	Provides    []string         `json:"provides,omitempty"`
	Requires    []Capability     `json:"requires,omitempty"`
	Configure   ConfigureSpec    `json:"configure,omitempty"`
	Tests       []PluginTestSpec `json:"tests,omitempty"`
	Install     InstallSpec      `json:"install"`
}

type Capability struct {
	Name     string `json:"name"`
	Required bool   `json:"required,omitempty"`
}

type InstallSpec struct {
	Type          string                  `json:"type"`
	Command       string                  `json:"command,omitempty"`
	Python        string                  `json:"python,omitempty"`
	SourceSubdir  string                  `json:"source_subdir,omitempty"`
	InstallTarget string                  `json:"install_target,omitempty"`
	TokenEnv      string                  `json:"token_env,omitempty"`
	BaseURLEnv    string                  `json:"base_url_env,omitempty"`
	Capabilities  []InstallCapabilitySpec `json:"capabilities,omitempty"`
}

type InstallCapabilitySpec struct {
	Name       string `json:"name"`
	TokenEnv   string `json:"token_env,omitempty"`
	BaseURLEnv string `json:"base_url_env,omitempty"`
}

type ConfigureSpec struct {
	Inputs []ConfigureInputSpec `json:"inputs,omitempty"`
}

type ConfigureInputSpec struct {
	Name        string `json:"name"`
	Label       string `json:"label,omitempty"`
	Type        string `json:"type,omitempty"`
	Env         string `json:"env,omitempty"`
	Required    bool   `json:"required,omitempty"`
	Description string `json:"description,omitempty"`
}

type PluginTestSpec struct {
	Name        string `json:"name"`
	Type        string `json:"type"`
	Capability  string `json:"capability,omitempty"`
	Env         string `json:"env,omitempty"`
	Required    bool   `json:"required,omitempty"`
	Description string `json:"description,omitempty"`
	URL         string `json:"url,omitempty"`
	Method      string `json:"method,omitempty"`
	RepoURL     string `json:"repo_url,omitempty"`
	Host        string `json:"host,omitempty"`
	TimeoutSec  int    `json:"timeout_sec,omitempty"`
}

type PluginTestResult struct {
	Name    string `json:"name"`
	Type    string `json:"type"`
	Healthy bool   `json:"healthy"`
	Detail  string `json:"detail,omitempty"`
}

type CatalogEntry struct {
	Name         string   `json:"name"`
	Description  string   `json:"description,omitempty"`
	Kind         string   `json:"kind,omitempty"`
	Tags         []string `json:"tags,omitempty"`
	RepoURL      string   `json:"repo_url"`
	DefaultRef   string   `json:"default_ref,omitempty"`
	Skills       []string `json:"skills,omitempty"`
	Provides     []string `json:"provides,omitempty"`
	InstallType  string   `json:"install_type,omitempty"`
	Command      string   `json:"command,omitempty"`
	ProjectPath  string   `json:"project_path,omitempty"`
	ManifestPath string   `json:"manifest_path,omitempty"`
}

func configDir() string {
	dir, err := os.UserConfigDir()
	if err != nil {
		home, _ := os.UserHomeDir()
		dir = filepath.Join(home, ".config")
	}
	return filepath.Join(dir, "c9s")
}

func registryPath() string {
	return filepath.Join(configDir(), "tools.json")
}

func catalogPath() string {
	return filepath.Join(configDir(), "tool_catalog.json")
}

func pluginConfigPath() string {
	return filepath.Join(configDir(), "plugin_config.json")
}

func corePluginsRoot() string {
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		return ""
	}
	return filepath.Clean(filepath.Join(filepath.Dir(file), "..", "..", "core_plugins"))
}

func installRoot() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return filepath.Join(os.TempDir(), "c9s-tools")
	}
	return filepath.Join(home, ".local", "share", "c9s", "tools")
}

func sourceRoot() string {
	return filepath.Join(installRoot(), "sources")
}

func skillsRoot() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return filepath.Join(os.TempDir(), "c9s-skills")
	}
	return filepath.Join(home, ".codex", "skills")
}

func LoadRegistry() (*Registry, error) {
	reg := &Registry{Tools: map[string]Record{}}
	data, err := os.ReadFile(registryPath())
	if err != nil {
		if os.IsNotExist(err) {
			return reg, nil
		}
		return nil, err
	}
	if err := json.Unmarshal(data, reg); err != nil {
		return nil, err
	}
	if reg.Tools == nil {
		reg.Tools = map[string]Record{}
	}
	return reg, nil
}

func SaveRegistry(reg *Registry) error {
	if reg.Tools == nil {
		reg.Tools = map[string]Record{}
	}
	if err := os.MkdirAll(configDir(), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(reg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(registryPath(), data, 0o644)
}

func LoadCatalogCache() (*CatalogCache, error) {
	cache := &CatalogCache{}
	data, err := os.ReadFile(catalogPath())
	if err != nil {
		if os.IsNotExist(err) {
			return cache, nil
		}
		return nil, err
	}
	if err := json.Unmarshal(data, cache); err != nil {
		return nil, err
	}
	return cache, nil
}

func SaveCatalogCache(cache *CatalogCache) error {
	if err := os.MkdirAll(configDir(), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(cache, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(catalogPath(), data, 0o644)
}

func LoadPluginConfigStore() (*PluginConfigStore, error) {
	store := &PluginConfigStore{Plugins: map[string]map[string]string{}}
	data, err := os.ReadFile(pluginConfigPath())
	if err != nil {
		if os.IsNotExist(err) {
			return store, nil
		}
		return nil, err
	}
	if err := json.Unmarshal(data, store); err != nil {
		return nil, err
	}
	if store.Plugins == nil {
		store.Plugins = map[string]map[string]string{}
	}
	return store, nil
}

func SavePluginConfigStore(store *PluginConfigStore) error {
	if store.Plugins == nil {
		store.Plugins = map[string]map[string]string{}
	}
	if err := os.MkdirAll(configDir(), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(store, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(pluginConfigPath(), data, 0o600)
}

func ListRecords() ([]Record, error) {
	reg, err := LoadRegistry()
	if err != nil {
		return nil, err
	}
	out := make([]Record, 0, len(reg.Tools))
	for _, record := range reg.Tools {
		out = append(out, record)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out, nil
}

func InstalledToolBinDirs() []string {
	records, err := ListRecords()
	if err != nil {
		return nil
	}
	seen := map[string]struct{}{}
	var dirs []string
	for _, record := range records {
		if record.CommandPath == "" {
			continue
		}
		if _, err := os.Stat(record.CommandPath); err != nil {
			continue
		}
		dir := filepath.Dir(record.CommandPath)
		if _, ok := seen[dir]; ok {
			continue
		}
		seen[dir] = struct{}{}
		dirs = append(dirs, dir)
	}
	sort.Strings(dirs)
	return dirs
}

func InstallToolFromSource(opts InstallOptions) (*Record, error) {
	resolved, err := ResolveSource(opts.Source)
	if err != nil {
		return nil, err
	}

	toolDir := filepath.Join(installRoot(), resolved.Manifest.Name)
	venvDir := filepath.Join(toolDir, "venv")
	if err := os.MkdirAll(toolDir, 0o755); err != nil {
		return nil, err
	}
	if err := os.RemoveAll(venvDir); err != nil {
		return nil, fmt.Errorf("failed to reset existing venv at %q: %w", venvDir, err)
	}

	commandPath, err := installRuntime(resolved, venvDir)
	if err != nil {
		return nil, err
	}

	record := Record{
		Name:         resolved.Manifest.Name,
		Kind:         resolved.Manifest.Kind,
		Tags:         append([]string(nil), resolved.Manifest.Tags...),
		RepoURL:      firstNonEmpty(resolved.RepoURL, resolved.Manifest.RepoURL),
		SourcePath:   resolved.Resolved,
		InstallDir:   toolDir,
		CommandPath:  commandPath,
		ManifestPath: filepath.Join(resolved.Resolved, manifestFileName),
		Provides:     append([]string(nil), resolved.Manifest.Provides...),
		Requires:     append([]Capability(nil), resolved.Manifest.Requires...),
		InstalledAt:  time.Now().UTC().Format(time.RFC3339),
	}

	if opts.InstallSkill {
		skillPaths, err := SyncSkillsFromSource(record.SourcePath, record.Name)
		if err != nil {
			return nil, err
		}
		record.SkillPaths = skillPaths
	}

	reg, err := LoadRegistry()
	if err != nil {
		return nil, err
	}
	reg.Tools[record.Name] = record
	if err := SaveRegistry(reg); err != nil {
		return nil, err
	}
	return &record, nil
}

func InspectInstalledTool(name string) (*ToolInspection, error) {
	reg, err := LoadRegistry()
	if err != nil {
		return nil, err
	}
	record, ok := reg.Tools[name]
	if !ok {
		return nil, fmt.Errorf("tool %q is not installed", name)
	}

	manifest, err := discoverManifest(record.SourcePath, record.RepoURL)
	if err != nil {
		return nil, err
	}
	specs, err := externalSkillSpecs(record.SourcePath, record.Name)
	if err != nil {
		return nil, err
	}
	previews := make(map[string][]string, len(specs))
	for _, spec := range specs {
		preview, err := PreviewSkill(spec.SourcePath, 12)
		if err != nil {
			return nil, err
		}
		previews[spec.Name] = preview
	}
	configValues, _ := PluginConfigValues(record.Name)
	return &ToolInspection{
		Record:       &record,
		Manifest:     manifest,
		SkillSpecs:   specs,
		Previews:     previews,
		ConfigValues: configValues,
		SourceExists: true,
	}, nil
}

func DoctorInstalledTool(name string) DoctorResult {
	result := DoctorResult{Tool: name, Healthy: true}
	reg, err := LoadRegistry()
	if err != nil {
		result.Issues = append(result.Issues, "failed to read tool registry: "+err.Error())
		result.Healthy = false
		return result
	}
	record, ok := reg.Tools[name]
	if !ok {
		result.Issues = append(result.Issues, "tool is not installed")
		result.Healthy = false
		return result
	}
	result.Record = &record
	manifest, manifestErr := discoverManifest(record.SourcePath, record.RepoURL)
	if manifestErr != nil {
		result.Issues = append(result.Issues, "failed to load manifest: "+manifestErr.Error())
	} else {
		result.Checks = append(result.Checks, fmt.Sprintf("manifest kind %s loaded", manifest.Kind))
	}

	if _, err := os.Stat(record.SourcePath); err != nil {
		result.Issues = append(result.Issues, "source checkout missing: "+record.SourcePath)
	}
	if strings.TrimSpace(record.CommandPath) == "" {
		switch record.Kind {
		case "auth-provider":
			result.Checks = append(result.Checks, "provider does not require a managed command")
		case "skill-pack":
			result.Checks = append(result.Checks, "skill pack does not require a managed command")
		}
	} else if _, err := os.Stat(record.CommandPath); err != nil {
		result.Issues = append(result.Issues, "installed command missing: "+record.CommandPath)
	} else {
		result.Checks = append(result.Checks, "command present at "+record.CommandPath)
	}

	specs, err := externalSkillSpecs(record.SourcePath, record.Name)
	if err != nil {
		result.Issues = append(result.Issues, err.Error())
	} else {
		result.Checks = append(result.Checks, fmt.Sprintf("source exports %d external skill(s)", len(specs)))
		result.Issues = append(result.Issues, compareSkillSpecs(specs)...)
	}

	if len(record.SkillPaths) == 0 {
		result.Issues = append(result.Issues, "no imported skills recorded")
	} else {
		for _, skillPath := range record.SkillPaths {
			if _, err := os.Stat(skillPath); err != nil {
				result.Issues = append(result.Issues, "skill missing: "+skillPath)
				continue
			}
			result.Checks = append(result.Checks, "skill present at "+skillPath)
		}
	}

	if manifestErr == nil {
		configChecks, configIssues := evaluateConfigureInputs(*manifest)
		result.Checks = append(result.Checks, configChecks...)
		result.Issues = append(result.Issues, configIssues...)
		testResults := evaluatePluginTests(*manifest)
		result.Tests = append(result.Tests, testResults...)
		for _, test := range testResults {
			if !test.Healthy {
				result.Issues = append(result.Issues, "test failed: "+test.Name+" ("+test.Detail+")")
			} else {
				result.Checks = append(result.Checks, "test passed: "+test.Name)
			}
		}
		if len(manifest.Configure.Inputs) > 0 && len(manifest.Tests) == 0 {
			result.Issues = append(result.Issues, "plugins with configure.inputs must declare at least one test")
		}
	}

	if len(result.Issues) > 0 {
		result.Healthy = false
	}
	return result
}

func evaluateConfigureInputs(manifest Manifest) ([]string, []string) {
	checks := make([]string, 0, len(manifest.Configure.Inputs))
	issues := make([]string, 0)
	for _, input := range manifest.Configure.Inputs {
		label := firstNonEmpty(strings.TrimSpace(input.Label), strings.TrimSpace(input.Name), strings.TrimSpace(input.Env))
		if strings.TrimSpace(label) == "" {
			continue
		}
		if strings.TrimSpace(input.Env) == "" {
			checks = append(checks, "configure input declared: "+label)
			continue
		}
		if value, _ := authConfiguredValue(input.Env); value != "" {
			checks = append(checks, fmt.Sprintf("config present: %s via %s", label, input.Env))
			continue
		}
		if input.Required {
			issues = append(issues, fmt.Sprintf("config missing: %s via %s", label, input.Env))
			continue
		}
		checks = append(checks, fmt.Sprintf("optional config: %s via %s", label, input.Env))
	}
	return checks, issues
}

func evaluatePluginTests(manifest Manifest) []PluginTestResult {
	results := make([]PluginTestResult, 0, len(manifest.Tests))
	for _, test := range manifest.Tests {
		label := firstNonEmpty(strings.TrimSpace(test.Name), strings.TrimSpace(test.Capability), strings.TrimSpace(test.Env), strings.TrimSpace(test.Type))
		result := PluginTestResult{Name: label, Type: strings.TrimSpace(test.Type)}
		switch strings.TrimSpace(test.Type) {
		case "capability":
			if strings.TrimSpace(test.Capability) == "" {
				result.Detail = "missing capability"
				results = append(results, result)
				continue
			}
			if _, err := auth.ResolveCapability(test.Capability); err != nil {
				result.Detail = err.Error()
			} else {
				result.Healthy = true
				result.Detail = "capability resolved"
			}
		case "env":
			if strings.TrimSpace(test.Env) == "" {
				result.Detail = "missing env"
				results = append(results, result)
				continue
			}
			if value, _ := authConfiguredValue(test.Env); value == "" {
				result.Detail = "set " + test.Env
			} else {
				result.Healthy = true
				result.Detail = test.Env + " present"
			}
		case "git_https", "git_ssh":
			repoURL := strings.TrimSpace(test.RepoURL)
			if repoURL == "" {
				result.Detail = "missing repo_url"
				results = append(results, result)
				continue
			}
			if _, err := run("git", "ls-remote", "--heads", repoURL); err != nil {
				result.Detail = err.Error()
			} else {
				result.Healthy = true
				result.Detail = "git reachable"
			}
		case "http":
			target := strings.TrimSpace(test.URL)
			if target == "" {
				result.Detail = "missing url"
				results = append(results, result)
				continue
			}
			method := strings.ToUpper(strings.TrimSpace(test.Method))
			if method == "" {
				method = http.MethodGet
			}
			timeout := test.TimeoutSec
			if timeout <= 0 {
				timeout = 8
			}
			req, err := http.NewRequest(method, target, nil)
			if err != nil {
				result.Detail = err.Error()
				results = append(results, result)
				continue
			}
			client := &http.Client{Timeout: time.Duration(timeout) * time.Second}
			resp, err := client.Do(req)
			if err != nil {
				result.Detail = err.Error()
			} else {
				_ = resp.Body.Close()
				if resp.StatusCode >= 200 && resp.StatusCode < 400 {
					result.Healthy = true
					result.Detail = resp.Status
				} else {
					result.Detail = resp.Status
				}
			}
		case "":
			result.Detail = "missing type"
		default:
			result.Detail = "unsupported type " + test.Type
		}
		results = append(results, result)
	}
	return results
}

func SyncInstalledTool(name string) (*Record, error) {
	reg, err := LoadRegistry()
	if err != nil {
		return nil, err
	}
	record, ok := reg.Tools[name]
	if !ok {
		return nil, fmt.Errorf("tool %q is not installed", name)
	}
	skillPaths, err := SyncSkillsFromSource(record.SourcePath, record.Name)
	if err != nil {
		return nil, err
	}
	record.SkillPaths = skillPaths
	record.InstalledAt = time.Now().UTC().Format(time.RFC3339)
	reg.Tools[name] = record
	if err := SaveRegistry(reg); err != nil {
		return nil, err
	}
	return &record, nil
}

func PluginConfigValues(toolName string) (map[string]string, error) {
	store, err := LoadPluginConfigStore()
	if err != nil {
		return nil, err
	}
	values := store.Plugins[toolName]
	if values == nil {
		return map[string]string{}, nil
	}
	out := make(map[string]string, len(values))
	for key, value := range values {
		out[key] = value
	}
	return out, nil
}

func SetPluginConfigValues(toolName string, values map[string]string) error {
	store, err := LoadPluginConfigStore()
	if err != nil {
		return err
	}
	if store.Plugins == nil {
		store.Plugins = map[string]map[string]string{}
	}
	clean := map[string]string{}
	for key, value := range values {
		key = strings.TrimSpace(key)
		value = strings.TrimSpace(value)
		if key == "" || value == "" {
			continue
		}
		clean[key] = value
	}
	if len(clean) == 0 {
		delete(store.Plugins, toolName)
	} else {
		store.Plugins[toolName] = clean
	}
	return SavePluginConfigStore(store)
}

func ConfiguredEnvVars() map[string]string {
	store, err := LoadPluginConfigStore()
	if err != nil || store.Plugins == nil {
		return nil
	}
	out := map[string]string{}
	for _, plugin := range store.Plugins {
		for key, value := range plugin {
			key = strings.TrimSpace(key)
			value = strings.TrimSpace(value)
			if key == "" || value == "" {
				continue
			}
			if _, exists := out[key]; exists {
				continue
			}
			out[key] = value
		}
	}
	return out
}

func SyncSkillsFromSource(sourcePath, toolName string) ([]string, error) {
	specs, err := externalSkillSpecs(sourcePath, toolName)
	if err != nil {
		return nil, err
	}
	var skillPaths []string
	for _, spec := range specs {
		data, err := os.ReadFile(spec.SourcePath)
		if err != nil {
			return nil, fmt.Errorf("failed to read skill %q: %w", spec.SourcePath, err)
		}
		if err := os.MkdirAll(filepath.Dir(spec.DestPath), 0o755); err != nil {
			return nil, err
		}
		if err := os.WriteFile(spec.DestPath, data, 0o644); err != nil {
			return nil, err
		}
		skillPaths = append(skillPaths, spec.DestPath)
	}
	sort.Strings(skillPaths)
	return skillPaths, nil
}

func PreviewSkill(path string, maxLines int) ([]string, error) {
	if maxLines <= 0 {
		maxLines = 12
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	lines := strings.Split(strings.ReplaceAll(string(data), "\r\n", "\n"), "\n")
	if len(lines) > maxLines {
		lines = lines[:maxLines]
	}
	return lines, nil
}

func ResolveSource(input string) (*ResolvedSource, error) {
	source := strings.TrimSpace(input)
	if source == "" {
		return nil, fmt.Errorf("tool source is required: pass a local repo path or git URL")
	}

	info := &ResolvedSource{Input: source}
	switch {
	case isGitURL(source):
		repoURL, ref := splitGitSource(source)
		info.Kind = "git"
		info.RepoURL = repoURL
		info.Ref = ref
		checkoutDir := filepath.Join(sourceRoot(), repoDirName(repoURL, ref))
		if err := ensureGitCheckout(repoURL, ref, checkoutDir); err != nil {
			return nil, err
		}
		info.Resolved = checkoutDir
	default:
		clean := filepath.Clean(source)
		if _, err := os.Stat(clean); err != nil {
			return nil, fmt.Errorf("source %q is not a readable local directory or git URL", source)
		}
		info.Kind = "local"
		info.Resolved = clean
	}

	manifest, err := discoverManifest(info.Resolved, info.RepoURL)
	if err != nil {
		return nil, err
	}
	info.Manifest = *manifest
	info.PythonSpec = manifest.Install.Python
	if manifest.Install.Type == "python_editable" {
		pythonCmd, err := choosePythonInterpreter(info.PythonSpec)
		if err != nil {
			return nil, err
		}
		info.PythonCmd = pythonCmd
	}
	return info, nil
}

func discoverManifest(sourcePath, repoURL string) (*Manifest, error) {
	manifestPath := filepath.Join(sourcePath, manifestFileName)
	if data, err := os.ReadFile(manifestPath); err == nil {
		var manifest Manifest
		if err := json.Unmarshal(data, &manifest); err != nil {
			return nil, fmt.Errorf("failed to parse %s: %w", manifestPath, err)
		}
		if manifest.Name == "" {
			return nil, fmt.Errorf("%s must declare a tool name", manifestPath)
		}
		if manifest.Kind == "" {
			manifest.Kind = "tool"
		}
		if len(manifest.Tags) > 0 {
			sort.Strings(manifest.Tags)
		}
		if manifest.SkillsDir == "" {
			manifest.SkillsDir = "external_skills"
		}
		if manifest.Install.Type == "" {
			switch manifest.Kind {
			case "skill-pack", "auth-provider":
				manifest.Install.Type = "noop"
			default:
				return nil, fmt.Errorf("%s must declare install.type", manifestPath)
			}
		}
		return &manifest, nil
	}

	pyprojectPath := filepath.Join(sourcePath, "pyproject.toml")
	if _, err := os.Stat(pyprojectPath); err == nil {
		name := discoverPyprojectName(pyprojectPath)
		if name == "" {
			name = filepath.Base(sourcePath)
		}
		command := discoverPyprojectCommand(pyprojectPath)
		if command == "" {
			command = name
		}
		return &Manifest{
			Name:      name,
			Kind:      "tool",
			RepoURL:   repoURL,
			Tags:      nil,
			SkillsDir: "external_skills",
			Install: InstallSpec{
				Type:          "python_editable",
				Command:       command,
				Python:        detectPythonRequirement(pyprojectPath),
				InstallTarget: ".",
			},
		}, nil
	}

	return nil, fmt.Errorf("tool source %q is missing %s and no supported fallback contract was detected", sourcePath, manifestFileName)
}

func installRuntime(resolved *ResolvedSource, venvDir string) (string, error) {
	switch resolved.Manifest.Install.Type {
	case "noop":
		command := resolved.Manifest.Install.Command
		if command == "" {
			return "", nil
		}
		return command, nil
	case "python_editable":
		if _, err := run(resolved.PythonCmd, "-m", "venv", venvDir); err != nil {
			return "", err
		}
		pipPath := filepath.Join(venvDir, "bin", "pip")
		target := resolved.Manifest.Install.InstallTarget
		if target == "" {
			target = "."
		}
		sourceTarget := filepath.Join(resolved.Resolved, target)
		if _, err := run(pipPath, "install", "-e", sourceTarget); err != nil {
			return "", err
		}
		command := resolved.Manifest.Install.Command
		if command == "" {
			return "", fmt.Errorf("tool manifest for %q is missing install.command", resolved.Manifest.Name)
		}
		return filepath.Join(venvDir, "bin", command), nil
	default:
		return "", fmt.Errorf("unsupported install type %q for tool %q", resolved.Manifest.Install.Type, resolved.Manifest.Name)
	}
}

func externalSkillSpecs(sourcePath, toolName string) ([]SkillSpec, error) {
	manifest, err := discoverManifest(sourcePath, "")
	if err != nil {
		return nil, err
	}
	skillsDir := manifest.SkillsDir
	if skillsDir == "" {
		skillsDir = "external_skills"
	}
	externalRoot := filepath.Join(sourcePath, skillsDir)
	entries, err := os.ReadDir(externalRoot)
	if err != nil {
		return nil, fmt.Errorf("failed to read external skills from %q: %w", externalRoot, err)
	}

	var specs []SkillSpec
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		srcSkillPath := filepath.Join(externalRoot, entry.Name(), "SKILL.md")
		if _, err := os.Stat(srcSkillPath); err != nil {
			if os.IsNotExist(err) {
				continue
			}
			return nil, fmt.Errorf("failed to stat skill %q: %w", srcSkillPath, err)
		}
		destDir := filepath.Join(skillsRoot(), toolName+"-"+entry.Name())
		specs = append(specs, SkillSpec{
			Name:       entry.Name(),
			SourcePath: srcSkillPath,
			DestPath:   filepath.Join(destDir, "SKILL.md"),
		})
	}
	if len(specs) == 0 {
		return nil, fmt.Errorf("no skills found under %q", externalRoot)
	}
	sort.Slice(specs, func(i, j int) bool { return specs[i].Name < specs[j].Name })
	return specs, nil
}

func compareSkillSpecs(specs []SkillSpec) []string {
	var issues []string
	for _, spec := range specs {
		src, err := os.ReadFile(spec.SourcePath)
		if err != nil {
			issues = append(issues, "failed to read source skill: "+spec.SourcePath)
			continue
		}
		dest, err := os.ReadFile(spec.DestPath)
		if err != nil {
			issues = append(issues, "managed skill missing or unreadable: "+spec.DestPath)
			continue
		}
		if !bytes.Equal(src, dest) {
			issues = append(issues, fmt.Sprintf("managed skill out of sync: %s -> %s", spec.SourcePath, spec.DestPath))
		}
	}
	return issues
}

func isGitURL(value string) bool {
	v := strings.TrimSpace(strings.ToLower(value))
	return strings.HasPrefix(v, "http://") ||
		strings.HasPrefix(v, "https://") ||
		strings.HasPrefix(v, "ssh://") ||
		strings.HasPrefix(v, "git@")
}

func repoDirName(value, ref string) string {
	base := filepath.Base(strings.TrimSuffix(value, "/"))
	base = strings.TrimSuffix(base, ".git")
	base = strings.TrimSpace(base)
	if base == "" || base == "." || base == string(filepath.Separator) {
		return "imported-tool"
	}
	if ref != "" {
		safeRef := strings.NewReplacer("/", "-", ":", "-", "@", "-", "#", "-").Replace(ref)
		base += "-" + safeRef
	}
	return base
}

func ensureGitCheckout(repoURL, ref, dest string) error {
	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		return err
	}
	if _, err := os.Stat(filepath.Join(dest, ".git")); err == nil {
		if _, err := run("git", "-C", dest, "remote", "set-url", "origin", repoURL); err != nil {
			return fmt.Errorf("failed to update git remote for %q: %w", dest, err)
		}
		if _, err := run("git", "-C", dest, "fetch", "--all", "--tags"); err != nil {
			return fmt.Errorf("failed to fetch managed checkout from %q: %w", repoURL, err)
		}
		if ref != "" {
			if _, err := run("git", "-C", dest, "checkout", ref); err != nil {
				if _, retryErr := run("git", "-C", dest, "checkout", "-B", ref, "origin/"+ref); retryErr != nil {
					return fmt.Errorf("failed to checkout ref %q from %q: %w", ref, repoURL, err)
				}
			}
			if _, err := run("git", "-C", dest, "pull", "--ff-only", "origin", ref); err != nil {
				return fmt.Errorf("failed to update managed checkout for ref %q from %q: %w", ref, repoURL, err)
			}
		} else if _, err := run("git", "-C", dest, "pull", "--ff-only"); err != nil {
			return fmt.Errorf("failed to update managed checkout from %q: %w", repoURL, err)
		}
		return nil
	}
	if _, err := os.Stat(dest); err == nil {
		return fmt.Errorf("managed source directory %q exists but is not a git checkout", dest)
	}
	cloneArgs := []string{"clone", "--depth", "1"}
	if ref != "" {
		cloneArgs = append(cloneArgs, "--branch", ref)
	}
	cloneArgs = append(cloneArgs, repoURL, dest)
	if _, err := run("git", cloneArgs...); err != nil {
		return fmt.Errorf("failed to clone %q: %w", repoURL, err)
	}
	return nil
}

func splitGitSource(value string) (repoURL, ref string) {
	trimmed := strings.TrimSpace(value)
	if idx := strings.LastIndex(trimmed, "@"); idx > strings.LastIndex(trimmed, "/") {
		return trimmed[:idx], trimmed[idx+1:]
	}
	if idx := strings.Index(trimmed, "#"); idx >= 0 {
		return trimmed[:idx], trimmed[idx+1:]
	}
	return trimmed, ""
}

func detectPythonRequirement(pyprojectPath string) string {
	data, err := os.ReadFile(pyprojectPath)
	if err != nil {
		return ""
	}
	matches := regexp.MustCompile(`(?m)requires-python\s*=\s*"([^"]+)"`).FindStringSubmatch(string(data))
	if len(matches) < 2 {
		return ""
	}
	return strings.TrimSpace(matches[1])
}

func discoverPyprojectName(pyprojectPath string) string {
	data, err := os.ReadFile(pyprojectPath)
	if err != nil {
		return ""
	}
	matches := regexp.MustCompile(`(?m)^name\s*=\s*"([^"]+)"`).FindStringSubmatch(string(data))
	if len(matches) < 2 {
		return ""
	}
	return strings.TrimSpace(matches[1])
}

func discoverPyprojectCommand(pyprojectPath string) string {
	data, err := os.ReadFile(pyprojectPath)
	if err != nil {
		return ""
	}
	lines := strings.Split(string(data), "\n")
	inScripts := false
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		switch {
		case trimmed == "[project.scripts]":
			inScripts = true
		case strings.HasPrefix(trimmed, "[") && trimmed != "[project.scripts]":
			inScripts = false
		case inScripts && strings.Contains(trimmed, "="):
			key := strings.TrimSpace(strings.SplitN(trimmed, "=", 2)[0])
			if key != "" {
				return key
			}
		}
	}
	return ""
}

func choosePythonInterpreter(spec string) (string, error) {
	minor := requiredPythonMinor(spec)
	candidates := []string{"python3.13", "python3.12", "python3.11", "python3.10", "python3"}
	for _, candidate := range candidates {
		path, err := exec.LookPath(candidate)
		if err != nil {
			continue
		}
		version, err := pythonVersion(path)
		if err != nil {
			continue
		}
		if minor > 0 && version < minor {
			continue
		}
		return path, nil
	}
	if minor > 0 {
		return "", fmt.Errorf("no compatible Python found for requires-python %q; install python3.%d or adjust PATH", spec, minor)
	}
	return "", fmt.Errorf("no usable python3 interpreter found on PATH")
}

func requiredPythonMinor(spec string) int {
	matches := regexp.MustCompile(`>=\s*3\.(\d+)`).FindStringSubmatch(spec)
	if len(matches) < 2 {
		return 0
	}
	minor, _ := strconv.Atoi(matches[1])
	return minor
}

func pythonVersion(cmd string) (int, error) {
	out, err := run(cmd, "--version")
	if err != nil {
		return 0, err
	}
	matches := regexp.MustCompile(`Python\s+3\.(\d+)`).FindStringSubmatch(out)
	if len(matches) < 2 {
		return 0, fmt.Errorf("could not parse python version from %q", out)
	}
	minor, err := strconv.Atoi(matches[1])
	if err != nil {
		return 0, err
	}
	return minor, nil
}

func run(name string, args ...string) (string, error) {
	cmd := exec.Command(name, args...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = strings.TrimSpace(stdout.String())
		}
		if msg == "" {
			msg = err.Error()
		}
		return "", fmt.Errorf("%s %s: %s", name, strings.Join(args, " "), msg)
	}
	return strings.TrimSpace(stdout.String()), nil
}

func ListProviderRecords() ([]Record, error) {
	records, err := ListRecords()
	if err != nil {
		return nil, err
	}
	out := make([]Record, 0)
	for _, record := range records {
		if record.Kind == "auth-provider" {
			out = append(out, record)
		}
	}
	return out, nil
}

func init() {
	auth.SetConfigValueResolver(func(key string) (string, bool) {
		store, err := LoadPluginConfigStore()
		if err != nil || store.Plugins == nil {
			return "", false
		}
		for _, plugin := range store.Plugins {
			if value := strings.TrimSpace(plugin[key]); value != "" {
				return value, true
			}
		}
		return "", false
	})
	auth.SetInstalledProviderLister(func() ([]auth.InstalledProvider, error) {
		records, err := ListProviderRecords()
		if err != nil {
			return nil, err
		}
		out := make([]auth.InstalledProvider, 0, len(records))
		for _, record := range records {
			manifest, err := discoverManifest(record.SourcePath, record.RepoURL)
			if err != nil {
				continue
			}
			capabilities := make([]auth.InstalledCapability, 0, len(manifest.Install.Capabilities))
			for _, spec := range manifest.Install.Capabilities {
				if strings.TrimSpace(spec.Name) == "" {
					continue
				}
				capabilities = append(capabilities, auth.InstalledCapability{
					Name:       spec.Name,
					TokenEnv:   spec.TokenEnv,
					BaseURLEnv: spec.BaseURLEnv,
				})
			}
			out = append(out, auth.InstalledProvider{
				Name:         record.Name,
				Provides:     append([]string(nil), record.Provides...),
				CommandPath:  record.CommandPath,
				TokenEnv:     manifest.Install.TokenEnv,
				BaseURLEnv:   manifest.Install.BaseURLEnv,
				Capabilities: capabilities,
			})
		}
		return out, nil
	})
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func RefreshCatalog() (*CatalogCache, error) {
	entries, err := listLocalCoreCatalogEntries()
	if err != nil {
		return nil, err
	}

	projects, err := listMembershipProjects()
	if err != nil {
		if len(entries) == 0 {
			return nil, err
		}
		cache := &CatalogCache{
			Entries:     entries,
			RefreshedAt: time.Now().UTC().Format(time.RFC3339),
		}
		if saveErr := SaveCatalogCache(cache); saveErr != nil {
			return nil, saveErr
		}
		return cache, nil
	}

	for _, project := range projects {
		ref := project.DefaultBranch
		if ref == "" {
			ref = "main"
		}

		provider, err := auth.ResolveCapability("gitlab.api_token")
		if err != nil {
			return nil, err
		}
		manifestData, err := gitLabAPIGet(provider, fmt.Sprintf("/projects/%d/repository/files/%s/raw?ref=%s",
			project.ID,
			url.PathEscape(manifestFileName),
			url.QueryEscape(ref),
		))
		if err != nil {
			continue
		}

		var manifest Manifest
		if err := json.Unmarshal(manifestData, &manifest); err != nil {
			continue
		}
		if manifest.Name == "" {
			continue
		}

		skillsDir := manifest.SkillsDir
		if skillsDir == "" {
			skillsDir = "external_skills"
		}
		skills, _ := listRemoteSkillNames(project.ID, ref, skillsDir)
		entry := CatalogEntry{
			Name:         manifest.Name,
			Description:  manifest.Description,
			Kind:         manifest.Kind,
			Tags:         append([]string(nil), manifest.Tags...),
			RepoURL:      firstNonEmpty(manifest.RepoURL, project.HTTPURLToRepo),
			DefaultRef:   ref,
			Skills:       skills,
			Provides:     append([]string(nil), manifest.Provides...),
			InstallType:  manifest.Install.Type,
			Command:      manifest.Install.Command,
			ProjectPath:  project.PathWithNamespace,
			ManifestPath: manifestFileName,
		}
		entries = append(entries, entry)
	}

	entries = dedupeCatalogEntries(entries)
	sort.Slice(entries, func(i, j int) bool {
		if entries[i].Name == entries[j].Name {
			return entries[i].RepoURL < entries[j].RepoURL
		}
		return entries[i].Name < entries[j].Name
	})

	cache := &CatalogCache{
		Entries:     entries,
		RefreshedAt: time.Now().UTC().Format(time.RFC3339),
	}
	if err := SaveCatalogCache(cache); err != nil {
		return nil, err
	}
	return cache, nil
}

func listLocalCoreCatalogEntries() ([]CatalogEntry, error) {
	root := corePluginsRoot()
	if strings.TrimSpace(root) == "" {
		return nil, nil
	}
	entries, err := os.ReadDir(root)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}

	out := make([]CatalogEntry, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		sourcePath := filepath.Join(root, entry.Name())
		manifest, err := discoverManifest(sourcePath, "")
		if err != nil {
			continue
		}
		skillNames := discoverLocalSkillNames(sourcePath, manifest.SkillsDir)
		out = append(out, CatalogEntry{
			Name:         manifest.Name,
			Description:  manifest.Description,
			Kind:         manifest.Kind,
			Tags:         append([]string(nil), manifest.Tags...),
			RepoURL:      sourcePath,
			DefaultRef:   "local",
			Skills:       skillNames,
			Provides:     append([]string(nil), manifest.Provides...),
			InstallType:  manifest.Install.Type,
			Command:      manifest.Install.Command,
			ProjectPath:  filepath.Base(sourcePath),
			ManifestPath: filepath.Join(sourcePath, manifestFileName),
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out, nil
}

func discoverLocalSkillNames(sourcePath, skillsDir string) []string {
	if strings.TrimSpace(skillsDir) == "" {
		skillsDir = "external_skills"
	}
	root := filepath.Join(sourcePath, skillsDir)
	entries, err := os.ReadDir(root)
	if err != nil {
		return nil
	}
	out := make([]string, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		if _, err := os.Stat(filepath.Join(root, entry.Name(), "SKILL.md")); err == nil {
			out = append(out, entry.Name())
		}
	}
	sort.Strings(out)
	return out
}

func dedupeCatalogEntries(entries []CatalogEntry) []CatalogEntry {
	seen := map[string]struct{}{}
	out := make([]CatalogEntry, 0, len(entries))
	for _, entry := range entries {
		key := entry.Name + "|" + entry.RepoURL
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, entry)
	}
	return out
}

func authConfiguredValue(key string) (string, bool) {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value, true
	}
	store, err := LoadPluginConfigStore()
	if err != nil || store.Plugins == nil {
		return "", false
	}
	for _, plugin := range store.Plugins {
		if value := strings.TrimSpace(plugin[key]); value != "" {
			return value, true
		}
	}
	return "", false
}

type gitlabProject struct {
	ID                int    `json:"id"`
	PathWithNamespace string `json:"path_with_namespace"`
	HTTPURLToRepo     string `json:"http_url_to_repo"`
	DefaultBranch     string `json:"default_branch"`
}

func listMembershipProjects() ([]gitlabProject, error) {
	provider, err := auth.ResolveCapability("gitlab.api_token")
	if err != nil {
		return nil, err
	}
	var all []gitlabProject
	page := 1
	for {
		data, err := gitLabAPIGet(provider, fmt.Sprintf("/projects?membership=true&simple=true&archived=false&per_page=100&page=%d", page))
		if err != nil {
			return nil, err
		}
		var projects []gitlabProject
		if err := json.Unmarshal(data, &projects); err != nil {
			return nil, err
		}
		if len(projects) == 0 {
			break
		}
		all = append(all, projects...)
		if len(projects) < 100 {
			break
		}
		page++
	}
	return all, nil
}

func listRemoteSkillNames(projectID int, ref, skillsDir string) ([]string, error) {
	provider, err := auth.ResolveCapability("gitlab.api_token")
	if err != nil {
		return nil, err
	}
	data, err := gitLabAPIGet(provider, fmt.Sprintf("/projects/%d/repository/tree?path=%s&ref=%s&per_page=100",
		projectID,
		url.QueryEscape(skillsDir),
		url.QueryEscape(ref),
	))
	if err != nil {
		return nil, err
	}
	var tree []struct {
		Name string `json:"name"`
		Type string `json:"type"`
	}
	if err := json.Unmarshal(data, &tree); err != nil {
		return nil, err
	}
	var skills []string
	for _, item := range tree {
		if item.Type == "tree" {
			skills = append(skills, item.Name)
		}
	}
	sort.Strings(skills)
	return skills, nil
}

func gitLabAPIGet(provider auth.ProviderToken, path string) ([]byte, error) {
	baseURL := strings.TrimRight(provider.BaseURL, "/")
	req, err := http.NewRequest(http.MethodGet, baseURL+path, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("PRIVATE-TOKEN", provider.Token)
	client := &http.Client{Timeout: 20 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 300 {
		msg := strings.TrimSpace(string(body))
		if msg == "" {
			msg = resp.Status
		}
		return nil, fmt.Errorf("gitlab api %s via %s: %s", path, provider.Source, msg)
	}
	return body, nil
}

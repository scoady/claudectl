package tui

import (
	"fmt"
	"strings"
)

// ── Cost estimation ────────────────────────────────────────────────────────────
//
// Rough estimates based on average token usage per turn:
//   - Input:  ~2000 tokens/turn
//   - Output: ~800 tokens/turn
//
// Model pricing (per million tokens):
//   - gpt-5-codex:      $1.25 input / $10 output
//   - gpt-5:            $1.25 input / $10 output
//   - codex-mini:       $1.50 input / $6 output

const (
	avgInputTokensPerTurn  = 2000
	avgOutputTokensPerTurn = 800
)

type modelPricing struct {
	inputPerMTok  float64
	outputPerMTok float64
}

var pricingTable = map[string]modelPricing{
	"gpt-5-codex":       {1.25, 10.0},
	"gpt-5":             {1.25, 10.0},
	"codex-mini":        {1.50, 6.0},
	"codex-mini-latest": {1.50, 6.0},
}

// defaultPricing is used when the model is unknown (assume gpt-5-codex).
var defaultPricing = modelPricing{1.25, 10.0}

// lookupPricing finds the best matching pricing for a model string.
func lookupPricing(model string) modelPricing {
	if model == "" {
		return defaultPricing
	}
	m := strings.ToLower(model)

	// Exact match
	if p, ok := pricingTable[m]; ok {
		return p
	}

	// Substring match
	for key, p := range pricingTable {
		if strings.Contains(m, key) {
			return p
		}
	}

	// Check for known keywords
	if strings.Contains(m, "codex-mini") {
		return pricingTable["codex-mini"]
	}
	if strings.Contains(m, "gpt-5") {
		return pricingTable["gpt-5"]
	}

	return defaultPricing
}

// EstimateCost returns estimated cost in USD for a given model and turn count.
func EstimateCost(model string, turnCount int) float64 {
	if turnCount <= 0 {
		return 0
	}
	p := lookupPricing(model)
	inputTokens := float64(turnCount * avgInputTokensPerTurn)
	outputTokens := float64(turnCount * avgOutputTokensPerTurn)
	cost := (inputTokens/1_000_000)*p.inputPerMTok + (outputTokens/1_000_000)*p.outputPerMTok
	return cost
}

// FormatCost formats a dollar amount as "~$X.XX".
func FormatCost(cost float64) string {
	if cost < 0.01 {
		return "~$0.00"
	}
	return fmt.Sprintf("~$%.2f", cost)
}

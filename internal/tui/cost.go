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
//   - claude-sonnet-4:  $3 input / $15 output
//   - claude-opus-4:    $15 input / $75 output
//   - claude-haiku-3.5: $0.80 input / $4 output

const (
	avgInputTokensPerTurn  = 2000
	avgOutputTokensPerTurn = 800
)

type modelPricing struct {
	inputPerMTok  float64
	outputPerMTok float64
}

var pricingTable = map[string]modelPricing{
	"sonnet":           {3.0, 15.0},
	"claude-sonnet-4":  {3.0, 15.0},
	"claude-sonnet":    {3.0, 15.0},
	"opus":             {15.0, 75.0},
	"claude-opus-4":    {15.0, 75.0},
	"claude-opus":      {15.0, 75.0},
	"haiku":            {0.80, 4.0},
	"claude-haiku-3.5": {0.80, 4.0},
	"claude-haiku":     {0.80, 4.0},
}

// defaultPricing is used when the model is unknown (assume sonnet).
var defaultPricing = modelPricing{3.0, 15.0}

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
	if strings.Contains(m, "opus") {
		return pricingTable["opus"]
	}
	if strings.Contains(m, "haiku") {
		return pricingTable["haiku"]
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

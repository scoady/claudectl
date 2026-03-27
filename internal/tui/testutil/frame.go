package testutil

import (
	"regexp"
	"strings"
)

var ansiRE = regexp.MustCompile(`\x1b\[[0-9;]*[A-Za-z]`)

func StripANSI(s string) string {
	return ansiRE.ReplaceAllString(s, "")
}

func NormalizeFrame(s string) string {
	s = strings.ReplaceAll(s, "\r\n", "\n")
	s = StripANSI(s)
	return strings.TrimRight(s, "\n")
}

func LineCount(s string) int {
	s = NormalizeFrame(s)
	if s == "" {
		return 0
	}
	return strings.Count(s, "\n") + 1
}

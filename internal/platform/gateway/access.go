package gateway

import (
	"net"
	"net/http"
	"strings"
)

// AccessControl enforces optional IP allow and deny lists (exact IP or CIDR).
type AccessControl struct {
	Allow []string
	Deny  []string
}

func (a AccessControl) allowed(r *http.Request) bool {
	ip := clientIP(r)
	if ip == nil {
		return false
	}
	for _, rule := range a.Deny {
		if matchIPRule(ip, rule) {
			return false
		}
	}
	if len(a.Allow) == 0 {
		return true
	}
	for _, rule := range a.Allow {
		if matchIPRule(ip, rule) {
			return true
		}
	}
	return false
}

func clientIP(r *http.Request) net.IP {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		if ip := net.ParseIP(strings.TrimSpace(parts[0])); ip != nil {
			return ip
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return net.ParseIP(r.RemoteAddr)
	}
	return net.ParseIP(host)
}

func matchIPRule(ip net.IP, rule string) bool {
	rule = strings.TrimSpace(rule)
	if rule == "" {
		return false
	}
	if strings.Contains(rule, "/") {
		_, network, err := net.ParseCIDR(rule)
		return err == nil && network.Contains(ip)
	}
	return ip.Equal(net.ParseIP(rule))
}

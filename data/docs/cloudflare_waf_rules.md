# Cloudflare WAF Custom Rules

## Overview
Cloudflare WAF (Web Application Firewall) custom rules allow you to create tailored security rules to protect your web applications from various threats.

## Rule Components

### Expression
The expression field uses Cloudflare's Rules language to define when a rule should match. Common fields include:

- `http.request.uri.path` - The request path
- `http.request.uri.query` - The query string
- `http.request.method` - HTTP method (GET, POST, etc.)
- `ip.src` - Source IP address
- `ip.geoip.country` - Country of origin
- `ip.geoip.asnum` - ASN (Autonomous System Number)
- `cf.threat_score` - Cloudflare threat score (0-100)
- `cf.bot_management.score` - Bot detection score

### Actions
Available actions for custom rules:

1. **Log** - Record the request without taking action
2. **Challenge** - Present a CAPTCHA challenge
3. **JS Challenge** - JavaScript-based challenge
4. **Managed Challenge** - Smart challenge based on client reputation
5. **Block** - Block the request completely

### Best Practices

1. **Start with Log Mode**
   - Always test rules in log mode first
   - Monitor for false positives
   - Gradually escalate to challenge/block

2. **Use Specific Expressions**
   - Target specific patterns rather than broad rules
   - Combine multiple conditions for accuracy
   - Consider geo-blocking carefully (compliance!)

3. **Rate Limiting**
   - Implement rate limits for high-risk endpoints
   - Use appropriate thresholds (10-1000 req/min)
   - Consider legitimate burst traffic

4. **Security Patterns**

   **SQL Injection:**
   ```
   (http.request.uri.query contains "union select" or 
    http.request.uri.query contains "drop table")
   ```

   **Path Traversal:**
   ```
   (http.request.uri.path contains ".." or 
    http.request.uri.path contains "%2e%2e")
   ```

   **XSS:**
   ```
   (http.request.uri.query contains "<script" or 
    http.request.uri.query contains "javascript:")
   ```

## Rate Limiting

Cloudflare Rate Limiting allows you to protect your application from abuse:

### Configuration
- **Threshold**: Number of requests per period
- **Period**: Time window (10s, 1m, 1h, etc.)
- **Action**: Challenge, block, or log
- **Characteristics**: Match by IP, headers, or other fields

### Example Rate Limits
- API endpoints: 100 requests/10s per IP
- Login pages: 5 requests/1m per IP
- Search endpoints: 50 requests/10s per IP

## Documentation References
- [Cloudflare Firewall Rules](https://developers.cloudflare.com/firewall/)
- [Rate Limiting](https://developers.cloudflare.com/waf/rate-limiting/)
- [Rules Language](https://developers.cloudflare.com/ruleset-engine/rules-language/)

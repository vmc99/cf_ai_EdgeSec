# Security Runbook: SQL Injection Response

## Threat Overview
SQL Injection (SQLi) is a critical security vulnerability where attackers inject malicious SQL code into application queries to:
- Extract sensitive data
- Modify database contents
- Execute administrative operations
- Bypass authentication

## Detection Indicators
- Query strings containing SQL keywords: `UNION`, `SELECT`, `DROP`, `INSERT`, `UPDATE`
- SQL comment patterns: `--`, `/*`, `*/`
- String terminators: `'`, `"`
- Logic operators: `OR '1'='1'`, `AND 1=1`
- Encoded variations: `%27` ('), `%2D` (-)

## Immediate Response Steps

### 1. Identify Affected Resources
- Review firewall events for SQL injection patterns
- Identify targeted endpoints (commonly: login, search, API endpoints)
- Document attacking IP addresses and ASNs
- Check for successful exploits in application logs

### 2. Immediate Mitigation
**Deploy WAF Rule (Priority: CRITICAL)**

```
Expression: 
(http.request.uri.query contains "union select" or
 http.request.uri.query contains "drop table" or
 http.request.uri.query contains "' or '1'='1'" or
 http.request.uri.query contains "-- ")

Action: BLOCK
Priority: HIGH
```

**Rate Limiting:**
- Apply aggressive rate limiting to affected endpoints
- Threshold: 10 requests/minute per IP for suspected IPs

### 3. Investigation
- Pull full access logs for last 24 hours
- Identify all requests from attacking IPs
- Check application logs for database errors
- Review database audit logs for unauthorized queries
- Assess data exfiltration risk

### 4. Containment
- Block attacking IP ranges if pattern is clear
- Temporarily disable vulnerable endpoints if needed
- Enable database query logging
- Implement additional monitoring

### 5. Remediation
**Application Level:**
- Implement parameterized queries/prepared statements
- Add input validation and sanitization
- Enable SQL error suppression in production
- Update ORM/framework to latest version

**WAF Configuration:**
- Deploy custom rule for specific attack patterns
- Enable Cloudflare's SQL Injection managed ruleset
- Configure alerts for SQL injection attempts

### 6. Post-Incident
- Conduct security audit of database access
- Review all application code for SQLi vulnerabilities
- Update security documentation
- Schedule penetration testing
- File incident report

## False Positive Handling
Some legitimate queries may trigger SQL injection rules:

**Common FPs:**
- Search queries with SQL-like terms
- Developer tools and debugging
- Legitimate API calls with complex parameters

**Solution:**
- Whitelist known good IPs (office, development)
- Create exceptions for specific endpoints
- Use challenge instead of block for borderline cases

## Prevention Checklist
- [ ] Use parameterized queries everywhere
- [ ] Implement input validation
- [ ] Apply principle of least privilege to DB users
- [ ] Enable WAF with SQL injection ruleset
- [ ] Monitor and alert on SQLi patterns
- [ ] Regular security training for developers
- [ ] Automated security testing in CI/CD

## Escalation
**Severity: CRITICAL**
- Security team: immediate notification
- Development team: within 1 hour
- Management: if data breach suspected
- Legal/Compliance: if PII accessed

## References
- [OWASP SQL Injection](https://owasp.org/www-community/attacks/SQL_Injection)
- [Cloudflare SQL Injection Protection](https://developers.cloudflare.com/waf/managed-rules/)
- Internal security policy: SEC-001

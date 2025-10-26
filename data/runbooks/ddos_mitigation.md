# Security Runbook: DDoS Mitigation

## Threat Overview
Distributed Denial of Service (DDoS) attacks overwhelm your infrastructure with massive traffic volumes, making services unavailable to legitimate users.

## Attack Types
1. **Volumetric**: Floods bandwidth (UDP floods, ICMP floods)
2. **Protocol**: Exploits protocol weaknesses (SYN floods, fragmented packets)
3. **Application Layer**: Targets web application (HTTP floods, slowloris)

## Detection Indicators
- Sudden traffic spike (>500% normal)
- High request rate from limited IP ranges
- Abnormal geographic traffic patterns
- Increased error rates (503, 504)
- Slow response times
- Resource exhaustion alerts

## Immediate Response Steps

### 1. Verify Attack
- Check Cloudflare Analytics dashboard
- Identify traffic patterns (requests/second)
- Analyze source IPs, ASNs, countries
- Determine attack vector (L3/L4 vs L7)

### 2. Activate Cloudflare DDoS Protection
**Enable "I'm Under Attack Mode"**
- Activates aggressive challenge for all visitors
- Temporary measure (5-15 minutes)
- Allows time for investigation

**Configure Rate Limiting:**
```
Threshold: 100 requests per 10 seconds
Scope: Per IP address
Action: Challenge (escalate to Block if needed)
```

### 3. Identify Attack Characteristics
**High-Volume from Few IPs:**
```
WAF Rule:
Expression: ip.src in {<attacking_ips>}
Action: BLOCK
```

**Geographic Concentration:**
```
Expression: ip.geoip.country in {"CN" "RU" "KP"}
Action: Challenge
Note: Use carefully, ensure compliance!
```

**Specific ASN:**
```
Expression: ip.geoip.asnum eq AS12345
Action: BLOCK
Duration: 24 hours
```

**Bot-driven:**
```
Expression: cf.bot_management.score lt 30
Action: Managed Challenge
```

### 4. Application-Layer DDoS
**API Endpoint Abuse:**
```
Expression: http.request.uri.path eq "/api/search"
Rate Limit: 10 requests/10s per IP
Action: Block on exceed
```

**POST Flood:**
```
Expression: http.request.method eq "POST" and 
            http.request.uri.path eq "/login"
Rate Limit: 5 requests/minute per IP
Action: Challenge
```

### 5. Advanced Mitigation
**Cloudflare Features to Enable:**
- [x] Caching (aggressive for static content)
- [x] Page Rules (cache everything on specific paths)
- [x] Firewall Rules (block malicious patterns)
- [x] Rate Limiting (per endpoint)
- [x] Bot Management (if available)
- [x] DDoS managed ruleset

**Load Balancer:**
- Enable health checks
- Implement failover to backup origins
- Use load balancing for traffic distribution

### 6. Monitoring & Adjustment
**Track Metrics:**
- Requests per second (target: back to baseline)
- Origin load (CPU, memory, connections)
- Error rate (target: <1%)
- Response time (target: <500ms)

**Iterate:**
- Adjust rate limits based on effectiveness
- Refine WAF rules to reduce false positives
- Gradually disable "Under Attack Mode" after stabilization

## Post-Attack Actions

### 1. Incident Analysis
- Document attack timeline
- Calculate impact (downtime, traffic volume)
- Identify attack attribution if possible
- Review effectiveness of mitigations

### 2. Infrastructure Hardening
- Increase origin capacity if needed
- Implement auto-scaling
- Review and optimize application performance
- Enable additional Cloudflare features

### 3. Update Response Plan
- Document lessons learned
- Update escalation procedures
- Conduct team post-mortem
- Update monitoring thresholds

## Prevention Strategies

**Ongoing:**
- Monitor traffic patterns for anomalies
- Set up alerts for traffic spikes
- Maintain updated contact lists
- Regular DDoS simulation drills

**Cloudflare Configuration:**
- Always-on DDoS protection (enabled by default)
- Proper DNS configuration (proxied through CF)
- Rate limiting on critical endpoints
- WAF rules for common attack patterns

## Escalation Path
1. **Tier 1 (0-5 min)**: DevOps/SRE team
2. **Tier 2 (5-15 min)**: Security team + Management
3. **Tier 3 (15-30 min)**: Cloudflare Enterprise Support
4. **Tier 4 (30+ min)**: Executive team, PR if public-facing

## Contact Information
- Cloudflare Support: https://dash.cloudflare.com/support
- Emergency Hotline: [Your emergency contact]
- Security Team: security@company.com
- DevOps On-Call: [PagerDuty link]

## Success Criteria
- [ ] Traffic back to normal levels
- [ ] Error rate <1%
- [ ] Origin load <70%
- [ ] No legitimate user complaints
- [ ] Incident documented
- [ ] Preventive measures implemented

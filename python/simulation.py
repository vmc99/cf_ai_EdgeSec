"""
WAF Rule Simulator - Python Utility
Simulates rule impact on historical traffic
"""

import json
import re
from typing import List, Dict, Any
from datetime import datetime


class RuleSimulator:
    """Simulate WAF rule impact on traffic logs"""
    
    def __init__(self, logs: List[Dict[str, Any]], rule: Dict[str, Any]):
        self.logs = logs
        self.rule = rule
        self.results = {
            'total_requests': len(logs),
            'matched': 0,
            'would_block': 0,
            'would_challenge': 0,
            'would_log': 0,
            'matched_requests': [],
            'false_positive_candidates': [],
        }
    
    def simulate(self) -> Dict[str, Any]:
        """Run simulation"""
        expression = self.rule.get('expression', '')
        action = self.rule.get('action', 'log')
        
        for log in self.logs:
            if self._evaluate_expression(expression, log):
                self.results['matched'] += 1
                
                # Track by action
                if action == 'block':
                    self.results['would_block'] += 1
                elif action in ['challenge', 'js_challenge', 'managed_challenge']:
                    self.results['would_challenge'] += 1
                else:
                    self.results['would_log'] += 1
                
                # Store matched request details
                self.results['matched_requests'].append({
                    'timestamp': log.get('timestamp'),
                    'ip': log.get('clientIP'),
                    'path': log.get('path'),
                    'method': log.get('method'),
                    'statusCode': log.get('statusCode'),
                })
                
                # Detect potential false positives
                if self._is_potential_false_positive(log):
                    self.results['false_positive_candidates'].append(log)
        
        # Calculate rates
        total = self.results['total_requests']
        self.results['match_rate'] = round(self.results['matched'] / total * 100, 2) if total > 0 else 0
        self.results['false_positive_rate_estimate'] = round(
            len(self.results['false_positive_candidates']) / self.results['matched'] * 100, 2
        ) if self.results['matched'] > 0 else 0
        
        return self.results
    
    def _evaluate_expression(self, expression: str, log: Dict[str, Any]) -> bool:
        """Evaluate Cloudflare expression against log entry"""
        # Simplified expression evaluation
        # In production, use proper Cloudflare expression parser
        
        path = log.get('path', '').lower()
        query = log.get('query', '').lower()
        full_url = f"{path}?{query}"
        
        # Path traversal
        if 'contains ".."' in expression or 'contains "%2e%2e"' in expression:
            if '..' in full_url or '%2e%2e' in full_url:
                return True
        
        # SQL injection
        if 'union select' in expression or 'drop table' in expression:
            if any(pattern in full_url for pattern in ['union select', 'drop table', "' or '1'='1"]):
                return True
        
        # XSS
        if '<script' in expression or 'javascript:' in expression:
            if any(pattern in full_url for pattern in ['<script', 'javascript:', 'onerror=']):
                return True
        
        # Threat score (mock)
        if 'cf.threat_score' in expression:
            # Simulate threat score based on heuristics
            threat_score = self._calculate_mock_threat_score(log)
            if 'gt 10' in expression and threat_score > 10:
                return True
        
        # Bot score (mock)
        if 'cf.bot_management.score' in expression:
            bot_score = self._calculate_mock_bot_score(log)
            if 'lt 30' in expression and bot_score < 30:
                return True
        
        # Country filter
        if 'ip.geoip.country' in expression:
            country_match = re.search(r'eq "([A-Z]{2})"', expression)
            if country_match:
                target_country = country_match.group(1)
                if log.get('country') == target_country:
                    return True
        
        return False
    
    def _calculate_mock_threat_score(self, log: Dict[str, Any]) -> int:
        """Calculate mock threat score"""
        score = 0
        
        path = log.get('path', '').lower()
        if any(suspicious in path for suspicious in ['admin', 'wp-', 'phpmyadmin', '.env']):
            score += 20
        
        if log.get('statusCode', 200) >= 400:
            score += 10
        
        user_agent = log.get('userAgent', '').lower()
        if 'bot' in user_agent or 'curl' in user_agent:
            score += 15
        
        return score
    
    def _calculate_mock_bot_score(self, log: Dict[str, Any]) -> int:
        """Calculate mock bot score (0-100, lower = more bot-like)"""
        user_agent = log.get('userAgent', '').lower()
        
        if any(bot in user_agent for bot in ['bot', 'crawler', 'spider']):
            return 10
        elif 'curl' in user_agent or 'wget' in user_agent:
            return 5
        elif len(user_agent) < 20:
            return 25
        else:
            return 80  # Likely human
    
    def _is_potential_false_positive(self, log: Dict[str, Any]) -> bool:
        """Detect potential false positives"""
        # Heuristics for legitimate traffic
        path = log.get('path', '')
        status = log.get('statusCode', 200)
        
        # Successful requests to common paths might be legitimate
        if status == 200 and any(common in path for common in ['/api/', '/static/', '/assets/']):
            return True
        
        # Check if user agent looks legitimate
        user_agent = log.get('userAgent', '')
        if any(browser in user_agent for browser in ['Chrome/', 'Firefox/', 'Safari/']):
            # Check for version numbers (legitimate browsers have them)
            if re.search(r'\d+\.\d+', user_agent):
                return True
        
        return False
    
    def generate_report(self) -> str:
        """Generate simulation report"""
        report = []
        report.append("=" * 80)
        report.append("WAF RULE SIMULATION REPORT")
        report.append("=" * 80)
        report.append("")
        
        report.append("RULE DETAILS")
        report.append("-" * 80)
        report.append(f"Expression: {self.rule.get('expression')}")
        report.append(f"Action: {self.rule.get('action')}")
        report.append(f"Description: {self.rule.get('description')}")
        report.append("")
        
        report.append("SIMULATION RESULTS")
        report.append("-" * 80)
        report.append(f"Total Requests Analyzed: {self.results['total_requests']}")
        report.append(f"Matched Requests: {self.results['matched']} ({self.results['match_rate']}%)")
        report.append(f"Would Block: {self.results['would_block']}")
        report.append(f"Would Challenge: {self.results['would_challenge']}")
        report.append(f"Would Log: {self.results['would_log']}")
        report.append("")
        
        report.append("FALSE POSITIVE ANALYSIS")
        report.append("-" * 80)
        report.append(f"Potential False Positives: {len(self.results['false_positive_candidates'])}")
        report.append(f"Estimated FP Rate: {self.results['false_positive_rate_estimate']}%")
        
        if self.results['false_positive_rate_estimate'] > 10:
            report.append("\n⚠️  WARNING: High false positive rate detected!")
            report.append("Consider refining the rule expression before deployment.")
        else:
            report.append("\n✓ False positive rate is acceptable")
        
        report.append("")
        report.append("=" * 80)
        
        return "\n".join(report)


def main():
    """Main entry point"""
    import sys
    
    if len(sys.argv) < 3:
        print("Usage: python simulation.py <log_file.json> <rule_file.json>")
        sys.exit(1)
    
    log_file = sys.argv[1]
    rule_file = sys.argv[2]
    
    try:
        with open(log_file, 'r') as f:
            logs = json.load(f)
        
        with open(rule_file, 'r') as f:
            rule = json.load(f)
        
        if not isinstance(logs, list):
            logs = [logs]
        
        simulator = RuleSimulator(logs, rule)
        results = simulator.simulate()
        
        print(simulator.generate_report())
        
        # Save detailed results
        output_file = rule_file.replace('.json', '_simulation_results.json')
        with open(output_file, 'w') as f:
            json.dump(results, f, indent=2)
        
        print(f"\nDetailed results saved to: {output_file}")
        
    except Exception as e:
        print(f"Error: {str(e)}")
        sys.exit(1)


if __name__ == '__main__':
    main()

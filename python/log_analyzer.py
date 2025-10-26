"""
Traffic Log Analyzer - Python Utility
Analyzes log files and generates detailed security reports
"""

import json
import re
from collections import Counter, defaultdict
from datetime import datetime
from typing import List, Dict, Any
import sys


class TrafficAnalyzer:
    """Analyzes traffic logs for security anomalies"""
    
    # Attack pattern regexes
    PATTERNS = {
        'path_traversal': re.compile(r'\.\.[/\\]|\.\.%2[fF]|%2e%2e'),
        'sql_injection': re.compile(
            r'(\bunion\b|\bselect\b|\binsert\b|\bdrop\b|\bdelete\b|\bupdate\b).+(\bfrom\b|\bwhere\b|\btable\b)|'
            r'[\'\"]\s*(or|and)\s*[\'\"]\s*=\s*[\'\"]',
            re.IGNORECASE
        ),
        'xss': re.compile(r'<script|javascript:|onerror=|onload=', re.IGNORECASE),
        'command_injection': re.compile(r'[;&|`$()]|\bsh\b|\bbash\b|\bexec\b', re.IGNORECASE),
        'xxe': re.compile(r'<!ENTITY|SYSTEM|PUBLIC', re.IGNORECASE),
    }
    
    def __init__(self, logs: List[Dict[str, Any]]):
        self.logs = logs
        self.analysis = {
            'total_requests': len(logs),
            'time_window': self._calculate_time_window(),
            'patterns': defaultdict(int),
            'ip_stats': Counter(),
            'path_stats': Counter(),
            'status_code_stats': Counter(),
            'country_stats': Counter(),
            'asn_stats': Counter(),
            'user_agent_stats': Counter(),
            'anomalies': [],
            'recommendations': [],
        }
    
    def _calculate_time_window(self) -> Dict[str, str]:
        """Calculate time window of logs"""
        if not self.logs:
            return {}
        
        timestamps = [
            datetime.fromisoformat(log.get('timestamp', '').replace('Z', '+00:00'))
            for log in self.logs
            if log.get('timestamp')
        ]
        
        if not timestamps:
            return {}
        
        return {
            'start': min(timestamps).isoformat(),
            'end': max(timestamps).isoformat(),
            'duration_seconds': (max(timestamps) - min(timestamps)).total_seconds(),
        }
    
    def analyze(self) -> Dict[str, Any]:
        """Run comprehensive analysis"""
        for log in self.logs:
            self._analyze_log_entry(log)
        
        self._detect_anomalies()
        self._generate_recommendations()
        
        return self.analysis
    
    def _analyze_log_entry(self, log: Dict[str, Any]):
        """Analyze individual log entry"""
        path = log.get('path', '')
        ip = log.get('clientIP', '')
        status = log.get('statusCode', 0)
        country = log.get('country', 'Unknown')
        asn = log.get('asn', 'Unknown')
        user_agent = log.get('userAgent', '')
        
        # Count statistics
        self.analysis['ip_stats'][ip] += 1
        self.analysis['path_stats'][path] += 1
        self.analysis['status_code_stats'][status] += 1
        self.analysis['country_stats'][country] += 1
        self.analysis['asn_stats'][asn] += 1
        
        # Detect patterns
        for pattern_name, regex in self.PATTERNS.items():
            if regex.search(path) or regex.search(log.get('query', '')):
                self.analysis['patterns'][pattern_name] += 1
        
        # Bot detection
        if self._is_bot(user_agent):
            self.analysis['user_agent_stats']['bot'] += 1
        else:
            self.analysis['user_agent_stats']['human'] += 1
    
    def _is_bot(self, user_agent: str) -> bool:
        """Simple bot detection"""
        bot_indicators = ['bot', 'crawler', 'spider', 'scraper', 'curl', 'wget']
        return any(indicator in user_agent.lower() for indicator in bot_indicators) or len(user_agent) < 10
    
    def _detect_anomalies(self):
        """Detect security anomalies"""
        total = self.analysis['total_requests']
        
        # Pattern-based anomalies
        for pattern, count in self.analysis['patterns'].items():
            if count > 0:
                severity = 'CRITICAL' if pattern in ['sql_injection', 'command_injection'] else 'HIGH'
                self.analysis['anomalies'].append({
                    'type': pattern,
                    'count': count,
                    'percentage': round(count / total * 100, 2),
                    'severity': severity,
                    'description': f"Detected {count} {pattern.replace('_', ' ')} attempts",
                })
        
        # DDoS detection (high request rate from few IPs)
        top_ips = self.analysis['ip_stats'].most_common(10)
        avg_requests_per_ip = total / len(self.analysis['ip_stats']) if self.analysis['ip_stats'] else 0
        
        ddos_ips = []
        for ip, count in top_ips:
            if count > avg_requests_per_ip * 5:
                ddos_ips.append({'ip': ip, 'requests': count})
        
        if ddos_ips:
            self.analysis['anomalies'].append({
                'type': 'potential_ddos',
                'count': len(ddos_ips),
                'severity': 'CRITICAL',
                'description': f"Potential DDoS: {len(ddos_ips)} IPs with abnormally high request rates",
                'details': ddos_ips[:5],  # Top 5
            })
        
        # Bot spike
        bot_percentage = (self.analysis['user_agent_stats']['bot'] / total * 100) if total > 0 else 0
        if bot_percentage > 30:
            self.analysis['anomalies'].append({
                'type': 'bot_spike',
                'count': self.analysis['user_agent_stats']['bot'],
                'percentage': round(bot_percentage, 2),
                'severity': 'MEDIUM',
                'description': f"High bot traffic: {round(bot_percentage, 2)}% of requests",
            })
        
        # Error rate
        error_count = sum(
            count for status, count in self.analysis['status_code_stats'].items()
            if status >= 400
        )
        error_rate = (error_count / total * 100) if total > 0 else 0
        
        if error_rate > 20:
            self.analysis['anomalies'].append({
                'type': 'high_error_rate',
                'count': error_count,
                'percentage': round(error_rate, 2),
                'severity': 'MEDIUM',
                'description': f"High error rate: {round(error_rate, 2)}% of requests returning 4xx/5xx",
            })
    
    def _generate_recommendations(self):
        """Generate mitigation recommendations"""
        for anomaly in self.analysis['anomalies']:
            anomaly_type = anomaly['type']
            
            if anomaly_type in ['sql_injection', 'xss', 'path_traversal']:
                self.analysis['recommendations'].append({
                    'for': anomaly_type,
                    'action': 'block',
                    'rule_type': 'waf_custom_rule',
                    'priority': 'HIGH',
                    'description': f"Block {anomaly_type.replace('_', ' ')} patterns immediately",
                })
            
            elif anomaly_type == 'potential_ddos':
                self.analysis['recommendations'].append({
                    'for': anomaly_type,
                    'action': 'rate_limit',
                    'rule_type': 'rate_limiting',
                    'priority': 'CRITICAL',
                    'description': "Apply aggressive rate limiting per IP/ASN",
                    'params': {
                        'rate': '100 requests per 10 seconds',
                        'scope': 'ip.src',
                    },
                })
            
            elif anomaly_type == 'bot_spike':
                self.analysis['recommendations'].append({
                    'for': anomaly_type,
                    'action': 'challenge',
                    'rule_type': 'bot_management',
                    'priority': 'MEDIUM',
                    'description': "Enable Bot Management or add JavaScript challenge",
                })
    
    def generate_report(self) -> str:
        """Generate human-readable report"""
        report = []
        report.append("=" * 80)
        report.append("EDGESEC TRAFFIC ANALYSIS REPORT")
        report.append("=" * 80)
        report.append("")
        
        # Summary
        report.append("SUMMARY")
        report.append("-" * 80)
        report.append(f"Total Requests: {self.analysis['total_requests']}")
        report.append(f"Unique IPs: {len(self.analysis['ip_stats'])}")
        report.append(f"Unique Paths: {len(self.analysis['path_stats'])}")
        report.append(f"Time Window: {self.analysis['time_window'].get('duration_seconds', 0):.0f} seconds")
        report.append("")
        
        # Anomalies
        if self.analysis['anomalies']:
            report.append("DETECTED ANOMALIES")
            report.append("-" * 80)
            for anomaly in sorted(self.analysis['anomalies'], key=lambda x: x['severity'], reverse=True):
                report.append(f"[{anomaly['severity']}] {anomaly['description']}")
                if 'details' in anomaly:
                    for detail in anomaly['details']:
                        report.append(f"  - {detail}")
            report.append("")
        
        # Recommendations
        if self.analysis['recommendations']:
            report.append("RECOMMENDATIONS")
            report.append("-" * 80)
            for rec in self.analysis['recommendations']:
                report.append(f"[{rec['priority']}] {rec['description']}")
                report.append(f"  Action: {rec['action']}")
                report.append(f"  Rule Type: {rec['rule_type']}")
                if 'params' in rec:
                    report.append(f"  Parameters: {rec['params']}")
            report.append("")
        
        # Top IPs
        report.append("TOP 10 IPS BY REQUEST COUNT")
        report.append("-" * 80)
        for ip, count in self.analysis['ip_stats'].most_common(10):
            report.append(f"{ip}: {count} requests")
        report.append("")
        
        report.append("=" * 80)
        
        return "\n".join(report)


def main():
    """Main entry point"""
    if len(sys.argv) < 2:
        print("Usage: python log_analyzer.py <log_file.json>")
        sys.exit(1)
    
    log_file = sys.argv[1]
    
    try:
        with open(log_file, 'r') as f:
            logs = json.load(f)
        
        if not isinstance(logs, list):
            logs = [logs]
        
        analyzer = TrafficAnalyzer(logs)
        analysis = analyzer.analyze()
        
        # Print report
        print(analyzer.generate_report())
        
        # Save detailed analysis
        output_file = log_file.replace('.json', '_analysis.json')
        with open(output_file, 'w') as f:
            json.dump(analysis, f, indent=2)
        
        print(f"\nDetailed analysis saved to: {output_file}")
        
    except FileNotFoundError:
        print(f"Error: File '{log_file}' not found")
        sys.exit(1)
    except json.JSONDecodeError:
        print(f"Error: Invalid JSON in '{log_file}'")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {str(e)}")
        sys.exit(1)


if __name__ == '__main__':
    main()

export interface NetworkStats {
  timestamp: string;
  uptime: {
    seconds: number
    since: string
  }
  network: {
    gateway_ip: string
    latency_ms: number
  }
  concentrator: {
    ip: string
    isp: string
    region: string
    asn: string
  }
}

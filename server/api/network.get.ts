import si from 'systeminformation';

export default defineEventHandler(async (event) => {
  try {
    // 1. Uptime (Server Host)
    const time = si.time();

    // 2. Gateway IP & Interface
    const networkInterface = await si.networkInterfaces();
    const defaultGateway = await si.networkGatewayDefault();

    // 3. Latency to Gateway
    const latency = await si.inetLatency(defaultGateway);

    // 4. Concentrator (Public IP & ISP Info)
    const publicNetwork = await $fetch('http://ip-api.com/json/');

    // Mask IP Helper
    const maskIp = (ip: string) => {
      if (!ip) return ''
      return ip.replace(/\d+\.\d+$/, 'x.x')
    }

    return {
      uptime: {
        seconds: time.uptime,
        since: new Date(Date.now() - (time.uptime * 1000)).toISOString(),
      },
      network: {
        gateway_ip: defaultGateway,
        latency_ms: latency,
      },
      concentrator: {
        ip: maskIp(publicNetwork.query),     // Public IP (Masked)
        isp: publicNetwork.isp,       // Azure / Microsoft
        region: publicNetwork.regionName, // Lokasi Data Center
        asn: publicNetwork.as         // Autonomous System Number
      }
    };
  } catch (error) {
    return createError({
      statusCode: 500,
      statusMessage: 'Failed to retrieve network stats: ' + error.message,
    });
  }
});
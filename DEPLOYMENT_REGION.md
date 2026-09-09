# Infrastructure Datacenter & Latency Configuration Guidance

## Overview
To achieve sub-second conversational voice latency (<300ms round-trip) when routing telephony media with Vobiz and Google Gemini Live AI, backend servers must be deployed in geographical proximity to the carrier's media gateway endpoints.

## Recommended Data Center Deployment
- **Target Region**: Asia-South (Mumbai, India / `ap-south-1` / `asia-south1`)
- **Render / AWS / GCP Region**: Mumbai (`ap-south-1`)
- **Vobiz DID Gateway**: India DIDs route through Vobiz's Mumbai / Singapore SIP proxies.

## Network & WebSocket Optimization Rules
1. **Co-location**: Keep Express backend worker nodes in the same region as the Vobiz SIP WebSocket ingress.
2. **TLS Session Resumption**: Enable TLS 1.3 session tickets on Render / Cloudflare ingress to eliminate TLS handshake latency on media streams.
3. **Buffer Management**: Audio packets are streamed in 20ms L16 PCM chunks at 16kHz to maintain fluid turn-taking and Voice Activity Detection (VAD).

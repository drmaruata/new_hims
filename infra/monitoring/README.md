# HIMS local observability baseline

This profile provides the Phase 0 observability control plane:

- OpenTelemetry Collector for OTLP traces/metrics.
- Prometheus for metrics retention and querying.
- Grafana for dashboards and operational investigation.
- Tempo for distributed traces.

Start it with the root Compose file plus the observability override.

Endpoints:

- Grafana: http://localhost:3002
- Prometheus: http://localhost:9090
- Tempo: http://localhost:3200
- OTLP HTTP: http://localhost:4318
- OTLP gRPC: localhost:4317

Set GRAFANA_ADMIN_PASSWORD before use. Never use the example password outside local development.

The API should send OTLP telemetry to http://localhost:4318 in local development. Production deployments must place the collector behind the hospital network boundary and protect Grafana, Prometheus and Tempo with authentication and network policy.

The collector is intentionally a local profile rather than a mandatory dependency of the application. API availability must not depend on the observability backend.

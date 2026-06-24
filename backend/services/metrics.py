"""
Prometheus metrics definitions for CCM.
Tracks HTTP requests, jobs, webhooks, emails, and AI operations.
"""
from prometheus_client import Counter, Histogram, Gauge, generate_latest, REGISTRY
from prometheus_client.openmetrics import exposition

# Counters
http_requests_total = Counter(
    'ccm_http_requests_total',
    'Total HTTP requests',
    ['method', 'path', 'status_code'],
)

jobs_queued_total = Counter(
    'ccm_jobs_queued_total',
    'Jobs enqueued',
    ['job_type'],
)

jobs_completed_total = Counter(
    'ccm_jobs_completed_total',
    'Jobs completed',
    ['job_type'],
)

jobs_failed_total = Counter(
    'ccm_jobs_failed_total',
    'Jobs failed',
    ['job_type'],
)

webhooks_dispatched_total = Counter(
    'ccm_webhooks_dispatched_total',
    'Webhooks fired',
    ['event', 'success'],
)

emails_sent_total = Counter(
    'ccm_emails_sent_total',
    'Emails sent',
    ['template'],
)

# Histograms
http_request_duration_seconds = Histogram(
    'ccm_http_request_duration_seconds',
    'HTTP request duration in seconds',
    ['path'],
    buckets=(0.01, 0.05, 0.1, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0),
)

draft_generation_duration_seconds = Histogram(
    'ccm_draft_generation_duration_seconds',
    'Draft generation time in seconds',
    buckets=(1.0, 2.5, 5.0, 10.0, 30.0, 60.0, 120.0),
)

kb_search_duration_seconds = Histogram(
    'ccm_kb_search_duration_seconds',
    'KB vector search time in seconds',
    buckets=(0.01, 0.05, 0.1, 0.5, 1.0, 2.5, 5.0),
)

# Gauges
active_letters_by_status = Gauge(
    'ccm_active_letters_by_status',
    'Letters count by status',
    ['status'],
)

db_pool_checked_out = Gauge(
    'ccm_db_pool_checked_out',
    'SQLAlchemy pool connections in use',
)


async def get_metrics() -> str:
    """Generate Prometheus metrics exposition format."""
    return generate_latest(REGISTRY).decode('utf-8')

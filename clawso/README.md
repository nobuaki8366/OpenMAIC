# OpenMAIC clawso adapter

This adapter exposes the hosted OpenMAIC API at `https://open.maic.chat` through a clawso-compatible `execute` entrypoint.

Supported actions:

- `health`: verify the hosted API and access code
- `submit`: create a classroom generation job
- `status`: poll an existing generation job

Required params:

- `access_code`: OpenMAIC hosted access code from `open.maic.chat`

Action params:

- `submit`: `requirement`, optional `language`, optional `pdf_content`
- `status`: `job_id` or `poll_url`

Examples:

```json
{
  "action": "submit",
  "access_code": "sk-xxx",
  "requirement": "Create a beginner classroom on quantum mechanics"
}
```

```json
{
  "action": "status",
  "access_code": "sk-xxx",
  "job_id": "abc123"
}
```

const HOSTED_BASE_URL = 'https://open.maic.chat';
const DEFAULT_POLL_INTERVAL_MS = 5000;
const REQUEST_TIMEOUT_MS = 20000;
const SUPPORTED_ACTIONS = ['health', 'submit', 'status'];

function fail(error, details = {}) {
  return {
    success: false,
    error,
    ...details,
  };
}

function toTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveAction(params) {
  return toTrimmedString(params?.action || params?.operation || 'submit').toLowerCase();
}

function resolveAccessCode(params) {
  return toTrimmedString(params?.access_code || params?.accessCode);
}

function resolvePollUrl(params) {
  const explicit = toTrimmedString(params?.poll_url || params?.pollUrl);
  if (explicit) {
    return explicit;
  }

  const jobId = toTrimmedString(params?.job_id || params?.jobId);
  if (!jobId) {
    return '';
  }

  return `${HOSTED_BASE_URL}/api/generate-classroom/${encodeURIComponent(jobId)}`;
}

function makeHeaders(accessCode) {
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${accessCode}`,
    'Content-Type': 'application/json',
  };
}

async function requestJson(url, init = {}) {
  try {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const text = await response.text();
    let data = null;

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
    }

    if (!response.ok) {
      return fail('OpenMAIC request failed', {
        http_status: response.status,
        response: data,
      });
    }

    return {
      success: true,
      http_status: response.status,
      data,
    };
  } catch (error) {
    return fail('Network request to OpenMAIC failed', {
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

function formatStatusResult(payload, pollUrl) {
  const classroomId = payload?.result?.classroomId || null;
  const classroomUrl =
    payload?.result?.url ||
    (classroomId ? `${HOSTED_BASE_URL}/classroom/${encodeURIComponent(classroomId)}` : null);

  return {
    success: true,
    provider: 'openmaic',
    mode: 'hosted',
    action: 'status',
    base_url: HOSTED_BASE_URL,
    poll_url: pollUrl,
    job_id: payload?.jobId || null,
    status: payload?.status || null,
    step: payload?.step || null,
    progress: payload?.progress ?? null,
    message: payload?.message || null,
    result: payload?.result || null,
    classroom_id: classroomId,
    classroom_url: classroomUrl,
    raw: payload,
  };
}

export async function execute(params = {}) {
  const action = resolveAction(params);

  if (!SUPPORTED_ACTIONS.includes(action)) {
    return fail('Unsupported action', {
      supported_actions: SUPPORTED_ACTIONS,
      received_action: action,
    });
  }

  const accessCode = resolveAccessCode(params);
  if (!accessCode) {
    return fail('access_code is required for hosted OpenMAIC requests', {
      supported_actions: SUPPORTED_ACTIONS,
    });
  }

  if (action === 'health') {
    const result = await requestJson(`${HOSTED_BASE_URL}/api/health`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessCode}`,
      },
    });

    if (!result.success) {
      return {
        ...result,
        action,
        provider: 'openmaic',
        mode: 'hosted',
        base_url: HOSTED_BASE_URL,
      };
    }

    return {
      success: true,
      provider: 'openmaic',
      mode: 'hosted',
      action,
      base_url: HOSTED_BASE_URL,
      status: result.data?.status || null,
      version: result.data?.version || null,
      raw: result.data,
    };
  }

  if (action === 'submit') {
    const requirement = toTrimmedString(params?.requirement);
    if (!requirement) {
      return fail('requirement is required for action=submit');
    }

    const body = {
      requirement,
      ...(toTrimmedString(params?.language) ? { language: toTrimmedString(params.language) } : {}),
      ...(params?.pdf_content ? { pdfContent: params.pdf_content } : {}),
      ...(params?.pdfContent ? { pdfContent: params.pdfContent } : {}),
    };

    const result = await requestJson(`${HOSTED_BASE_URL}/api/generate-classroom`, {
      method: 'POST',
      headers: makeHeaders(accessCode),
      body: JSON.stringify(body),
    });

    if (!result.success) {
      return {
        ...result,
        action,
        provider: 'openmaic',
        mode: 'hosted',
        base_url: HOSTED_BASE_URL,
      };
    }

    const payload = result.data || {};
    const pollUrl =
      payload.pollUrl ||
      (payload.jobId
        ? `${HOSTED_BASE_URL}/api/generate-classroom/${encodeURIComponent(payload.jobId)}`
        : null);

    return {
      success: true,
      provider: 'openmaic',
      mode: 'hosted',
      action,
      base_url: HOSTED_BASE_URL,
      job_id: payload.jobId || null,
      status: payload.status || null,
      step: payload.step || null,
      message: payload.message || null,
      poll_url: pollUrl,
      poll_interval_ms: payload.pollIntervalMs || DEFAULT_POLL_INTERVAL_MS,
      raw: payload,
    };
  }

  const pollUrl = resolvePollUrl(params);
  if (!pollUrl) {
    return fail('job_id or poll_url is required for action=status');
  }

  const result = await requestJson(pollUrl, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessCode}`,
    },
  });

  if (!result.success) {
    return {
      ...result,
      action,
      provider: 'openmaic',
      mode: 'hosted',
      base_url: HOSTED_BASE_URL,
      poll_url: pollUrl,
    };
  }

  return formatStatusResult(result.data || {}, pollUrl);
}

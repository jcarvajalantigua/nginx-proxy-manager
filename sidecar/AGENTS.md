# NPM gateway sidecar

The sidecar controls infrastructure integrations. Keep its API and provider
boundaries server-side, avoid logging secrets, and use dry-run or read-only
validation unless a production change is explicitly authorized.

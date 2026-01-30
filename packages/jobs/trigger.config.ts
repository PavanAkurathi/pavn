{
  "project": "proj_workershive",
  "triggerDirectories": ["packages/jobs/src"],
  "triggerUrl": "https://api.trigger.dev",
  "retries": {
    "enabledInDev": false,
    "default": {
      "maxAttempts": 3,
      "minTimeoutInMs": 1000,
      "maxTimeoutInMs": 10000,
      "factor": 2,
      "randomize": true
    }
  }
}
